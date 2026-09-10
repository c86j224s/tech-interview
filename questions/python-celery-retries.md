---
id: python-celery-retries
title: "Celery 작업이 DB를 변경한 뒤 워커가 종료돼 같은 작업이 다시 실행됩니다. ACK·재시도·처리 완료를 어떻게 구분하고 중복 반영을 막나요?"
answerMinutes: 5
followups: [{"id":"message-consumer-idempotency","prompt":"Celery 작업 ID와 도메인 멱등 키가 다를 때 포인트 지급 중복을 어느 저장소에서 막을까요?"},{"id":"transactional-outbox","prompt":"DB 변경과 후속 메시지 발행을 Celery 재시도와 함께 묶을 때 outbox는 어느 실패를 보완할까요?"},{"id":"request-timeout-idempotency","prompt":"작업 호출 응답이 끊긴 뒤 외부 효과 여부를 모를 때 retry 전에 어떤 결과 조회를 할까요?"}]
difficulty: 중하
category: 언어·런타임
tags: ["Python","Celery","ACK","재시도","멱등성"]
related: ["message-consumer-idempotency"]
---

# Celery 작업이 DB를 변경한 뒤 워커가 종료돼 같은 작업이 다시 실행됩니다. ACK·재시도·처리 완료를 어떻게 구분하고 중복 반영을 막나요?

## 구두 답변

Celery에서 브로커 메시지를 워커가 예약했다는 사실, 작업 함수가 성공적으로 반환했다는 사실, ACK가 브로커에 반영됐다는 사실은 서로 다릅니다. 기본적으로는 작업 실행 전에 ACK하는 설정이 있어, 실행 중 워커가 죽으면 재전달되지 않을 수 있습니다. `task_acks_late=True`를 사용하면 실행 뒤 ACK하도록 바꿀 수 있지만, 장애 시 같은 메시지가 다시 실행될 가능성을 받아들이는 계약입니다.

### 전달 확인과 효과 완료

재시도도 원래 호출이 성공했다는 뜻이 아닙니다. `self.retry()`나 `autoretry_for`는 재시도 작업을 예약하고 현재 시도를 RETRY 상태로 남기는 흐름이며, 네트워크 단절처럼 결과가 불확정한 순간에는 이전 시도의 외부 효과가 이미 반영됐을 수 있습니다. late ACK를 써도 실패·타임아웃 시 ACK할지(`task_acks_on_failure_or_timeout`), 워커 프로세스 손실 시 재큐잉할지(`task_reject_on_worker_lost`)에 따라 동작이 달라지므로 기본값을 추측하지 말고 명시적으로 고정하겠습니다.

### 멱등 처리의 저장 경계

Celery의 task state나 ACK만으로 주문 생성 같은 변경이 한 번만 반영된다고 보장할 수 없습니다. 주문 ID 같은 멱등 키를 DB의 고유 제약·상태 전이와 함께 사용하고, 외부 API도 제공되는 멱등 키를 전달하겠습니다. 재시도 가능한 오류와 영구 오류를 구분하고 최대 시도 횟수·backoff·jitter·dead-letter 또는 수동 보류를 정합니다. 테스트는 정상 완료뿐 아니라 ACK 전 프로세스 종료, 타임아웃, 결과 유실, 외부 효과 후 재실행을 재현해 중복과 복구 경로를 확인해야 합니다.

### 선택 기준과 검증

멱등 키만 먼저 기록하고 DB 변경을 나중에 하면 중간 장애에서 키만 남아 재처리가 막힐 수 있습니다. 키와 도메인 변경을 한 DB 트랜잭션에 묶거나 `started`·`applied` 상태를 저장해 재시작 때 판정하겠습니다. Celery task ID와 도메인 멱등 키의 범위는 별도로 정해야 합니다.

Celery의 task ID는 논리 태스크를 식별하고 self.retry는 보통 같은 task ID로 다시 메시지를 보냅니다. 따라서 ID 하나가 물리적인 실행 시도 하나라고 일반화해서는 안 됩니다. 반대로 사용자가 같은 주문을 두 번 태스크로 만들면 서로 다른 ID가 생길 수 있으므로 주문 ID 등 도메인 중복 방지 키가 필요합니다. 시도 횟수와 최종 반영 여부도 각각 기록하겠습니다.

acks_late를 켜도 실행 자식 프로세스의 종료나 hard time limit에서 부모 워커가 ACK하는 정책이 관여할 수 있습니다. 설정 하나만으로 모든 종료를 재전달한다고 설명하지 않고 실제 브로커·worker pool·손실 설정으로 시험해야 합니다. poison task를 무한 재큐잉하면 다른 태스크가 밀리므로 시도 상한과 격리 경로를 둡니다. 외부 상태를 바꾼 뒤 started 기록만 남은 경우에는 상태 이름만 보고 재실행하지 말고 실제 반영을 조회해야 합니다.

## 득점 포인트

- 예약·실행·ACK·task state·DB 효과를 분리한다.
- late ACK와 재전달 가능성을 멱등 저장 규칙과 연결한다.
- backoff·dead-letter·불확실한 외부 효과를 운영한다.

## 감점 포인트

- ACK나 task state가 DB 효과의 exactly-once를 보장한다고 말한다.
- 재시도가 이전 외부 효과를 되돌린다고 설명한다.
- acks_late 하나로 중복·무한 재시도·브로커 차이가 사라진다고 가정한다.

## 더 파고들 거리

- visibility timeout과 late ACK가 함께 있을 때 재전달 시점을 어떻게 계산할까요?
- 외부 효과 후 worker lost를 재현해 멱등 레코드와 도메인 변경을 어떻게 검증할까요?
- 재시도 폭주를 backoff·jitter·dead-letter 지표로 어떻게 제한할까요?
