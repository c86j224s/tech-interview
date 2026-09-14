---
id: "stream-state-checkpoint"
title: "스트림 집계가 재시작하면서 중복 합계가 생깁니다. 입력 위치와 집계 상태의 checkpoint는 어떻게 맞추나요?"
answerMinutes: 5
followups: [{"id": "kafka-transactions-external-db", "prompt": "스트림 내부 transaction 밖의 DB·HTTP 효과는 어떤 별도 멱등·대사 경계가 필요한가요?"}, {"id": "message-consumer-idempotency", "prompt": "처리 성공 뒤 ACK가 유실돼 다시 받은 이벤트를 원장에 한 번만 반영하려면 어떻게 하나요?"}, {"id": "event-time-watermark", "prompt": "발생 시각과 도착 시각이 어긋나면 윈도 확정·늦은 정정은 어떻게 나누나요?"}]
difficulty: "중하"
category: "분산 시스템"
tags: ["분산 시스템", "stream state checkpoint"]
related: ["kafka-transactions-external-db", "message-consumer-idempotency", "event-time-watermark"]
---

# 스트림 집계가 재시작하면서 중복 합계가 생깁니다. 입력 위치와 집계 상태의 checkpoint는 어떻게 맞추나요?

## 구두 답변

집계 상태와 어디까지 입력을 반영했는지가 같은 복구 기준을 가리켜야 합니다. 상태는 100번까지 반영했는데 위치를 90으로 복구하면 다시 더할 수 있고 반대면 누락됩니다.

### 동작 원리와 전제

엔진이 상태 snapshot과 입력 offset을 일관되게 저장하는 계약을 제공하는지 확인합니다. 외부 DB나 메일 출력은 checkpoint 내부에 자동 포함되지 않을 수 있어 transaction sink·멱등 key·outbox 같은 별도 경계가 필요합니다.

### 선택과 실패 처리

checkpoint가 자주 실패하면 정상 처리량이 높아도 복구 시 재작업 범위가 커집니다. 상태 크기·저장 대역폭·checkpoint 시간·입력 보관 한도를 관리합니다. 스키마·연산 코드 변경 뒤 옛 상태를 읽을 수 있는지도 확인합니다.

### 구체적인 사례와 검증

state snapshot과 입력 위치를 같은 기준으로 복구해도 외부 알림은 다시 나갈 수 있습니다. 엔진 내부 상태의 exactly-once와 sink의 transaction·멱등 계약을 따로 확인합니다. checkpoint가 성공했다는 상태도 저장소의 내구화·가용성 가정에 의존하므로 별도 복구 환경에서 실제 읽어 봐야 합니다. 코드 업데이트로 state serializer가 달라지면 이전 snapshot을 못 읽을 수 있어 migration과 rollback을 검증합니다. 복구 후 입력 보관 범위를 이미 벗어났다면 단순 offset 재생으로 해결되지 않고 원본 snapshot과 대사가 필요합니다. 저장 위치와 상태·외부 효과의 경계를 명확히 하겠습니다.

snapshot 중 중단·offset 기록 전후·외부 출력 성공 직후 실패를 시험합니다. 최종 합계와 원본 이벤트를 대조하고 처리 엔진의 exactly-once 범위를 명시합니다. 내부 상태 일관성과 외부 효과의 단일 적용을 같은 표현으로 과장하지 않겠습니다.

## 득점 포인트

- 핵심 구분: 집계 상태와 어디까지 입력을 반영했는지가 같은 복구 기준을 가리켜야 합니다.
- 선택 조건: checkpoint가 자주 실패하면 정상 처리량이 높아도 복구 시 재작업 범위가 커집니다.
- 검증 기준: snapshot 중 중단·offset 기록 전후·외부 출력 성공 직후 실패를 시험합니다.

## 감점 포인트

- 내부 checkpoint가 있으면 모든 외부 출력도 exactly-once라고 한다.

## 더 파고들 거리

- 스트림 내부 transaction 밖의 DB·HTTP 효과는 어떤 별도 멱등·대사 경계가 필요한가요?
- 처리 성공 뒤 ACK가 유실돼 다시 받은 이벤트를 원장에 한 번만 반영하려면 어떻게 하나요?
- 발생 시각과 도착 시각이 어긋나면 윈도 확정·늦은 정정은 어떻게 나누나요?
