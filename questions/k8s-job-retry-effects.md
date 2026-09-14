---
id: "k8s-job-retry-effects"
title: "Kubernetes Job이 실패해 Pod를 다시 실행했습니다. 작업이 한 번만 처리됐다고 볼 수 있나요?"
answerMinutes: 5
followups: [{"id": "message-consumer-idempotency", "prompt": "처리 성공 뒤 ACK가 유실돼 다시 받은 이벤트를 원장에 한 번만 반영하려면 어떻게 하나요?"}, {"id": "scheduler-missed-runs", "prompt": "정지 중 놓친 회차를 모두 보충할지 최신 한 번만 실행할지 어떤 업무 의미로 정하나요?"}, {"id": "sqs-visibility-timeout", "prompt": "메시지 숨김 시간이 끝나도 옛 워커가 실행 중일 때 중복 효과를 어떻게 막나요?"}]
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes", "인프라"]
related: ["message-consumer-idempotency", "scheduler-missed-runs", "sqs-visibility-timeout"]
---

# Kubernetes Job이 실패해 Pod를 다시 실행했습니다. 작업이 한 번만 처리됐다고 볼 수 있나요?

## 구두 답변

Job의 재시도·완료 관리는 컨테이너 실행 수명에 대한 것이며 외부 DB·결제 효과의 한 번 실행을 자동 보장하지 않습니다. Pod가 성공 표시 전에 종료되면 이미 적용된 작업을 다시 할 수 있습니다.

### 동작 원리와 전제

논리 작업 ID를 입력으로 유지하고 처리 기록과 DB 변경을 같은 transaction에 넣습니다. backoffLimit·activeDeadlineSeconds·restartPolicy 등은 실제 버전과 요구에 맞춰 설정합니다. 재시도가 언제 같은 프로세스인지 새 Pod인지도 확인합니다.

### 선택과 실패 처리

CronJob의 동시 실행 정책은 일정 중첩을 줄일 수 있지만 모든 중복 원인을 제거하지 않습니다. 긴 작업의 checkpoint·취소·부분 완료와 보관 기간을 설계합니다. 외부 API가 멱등성을 제공하지 않으면 결과 조회·대사가 필요합니다.

### 구체적인 사례와 검증

Pod가 DB에 포인트를 지급하고 exit code 0을 남기기 전에 노드가 사라지면 Job은 실패로 보고 다시 실행할 수 있습니다. 작업 결과의 권위는 Pod 상태만이 아니라 처리 ID 원장에 있어야 합니다. 재실행은 같은 논리 키로 기존 결과를 확인하고 완료 상태를 복구합니다. 작업 안에서 새 UUID를 만들면 같은 입력도 새 작업으로 처리될 수 있어 ID 발급 위치가 중요합니다. 큰 배치는 checkpoint를 사용하되 실제 변경과 진행 위치의 원자 경계를 맞춥니다. Job history 정리는 운영 기록 보존과 구분하고 원장·오류·미완료 상태를 조회할 경로를 유지합니다.

외부 commit 후 종료·노드 손실·중복 Job 생성·deadline을 시험합니다. Pod 완료 수와 실제 원장 효과 수를 따로 봅니다. 오케스트레이터가 성공했다고 실행 결과의 업무 불변식까지 확인한 것은 아닙니다.

## 득점 포인트

- 핵심 구분: Job의 재시도·완료 관리는 컨테이너 실행 수명에 대한 것이며 외부 DB·결제 효과의 한 번 실행을 자동 보장하지 않습니다.
- 선택 조건: CronJob의 동시 실행 정책은 일정 중첩을 줄일 수 있지만 모든 중복 원인을 제거하지 않습니다.
- 검증 기준: 외부 commit 후 종료·노드 손실·중복 Job 생성·deadline을 시험합니다.

## 감점 포인트

- Kubernetes Job의 성공·재시도 관리가 외부 효과를 한 번만 실행하게 한다.

## 더 파고들 거리

- 처리 성공 뒤 ACK가 유실돼 다시 받은 이벤트를 원장에 한 번만 반영하려면 어떻게 하나요?
- 정지 중 놓친 회차를 모두 보충할지 최신 한 번만 실행할지 어떤 업무 의미로 정하나요?
- 메시지 숨김 시간이 끝나도 옛 워커가 실행 중일 때 중복 효과를 어떻게 막나요?
