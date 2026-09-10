---
id: kafka-rebalance-processing
title: "Kafka 소비자가 메시지를 처리하는 동안 리밸런싱으로 파티션을 잃으면, 작업과 offset을 어떤 순서로 정리해야 하나요?"
answerMinutes: 5
followups: [{"id":"kafka-consumer-group","prompt":"consumer 확장 뒤 partition 병렬성과 키 편중을 어떻게 진단하나요?"},{"id":"kafka-partition-offset","prompt":"읽은 위치와 외부 완료 위치가 다르면 어디까지만 commit할 수 있나요?"},{"id":"message-consumer-idempotency","prompt":"옛 consumer의 늦은 DB 쓰기가 새 결과를 덮지 않게 어떤 버전 정책을 쓰나요?"}]
difficulty: 중하
category: 분산 시스템
tags: ["Kafka","리밸런싱","offset"]
related: ["kafka-consumer-group"]
---

# Kafka 소비자가 메시지를 처리하는 동안 리밸런싱으로 파티션을 잃으면, 작업과 offset을 어떤 순서로 정리해야 하나요?

## 구두 답변

Kafka rebalance는 partition 소유자가 바뀌는 사건이므로 이전 consumer의 외부 작업과 새 소유자의 작업이 겹칠 수 있습니다. 마지막으로 읽은 offset을 무조건 commit하면 처리 중 레코드를 건너뜁니다. 새 작업 투입을 멈추고 진행 중 작업을 완료·취소·재시도 중 하나로 정한 뒤 외부 효과가 성공한 가장 긴 연속 구간까지만 commit합니다.

### 연속 완료

10·11을 병렬 처리해 11만 먼저 끝나면 12를 commit할 수 없습니다. 11 완료를 기록하되 10이 끝날 때까지 커밋 위치를 다음 미처리 레코드인 10에 두고, 둘이 연속 완료되면 12로 전진합니다. 옛 consumer의 늦은 commit·외부 쓰기는 세대·버전·멱등 ID로 제한합니다.

`max.poll.interval.ms`를 넘으면 heartbeat와 작업이 어긋나 rebalance가 반복됩니다. poll과 worker를 분리하되 큐를 제한합니다. cooperative rebalance와 static membership은 중단 범위를 줄일 수 있지만 실행 중 외부 작업을 자동으로 안전하게 끝내지는 않습니다. 검증은 scale-out·scale-in·consumer 중단·느린 DB를 주입해 연속 위치·중복·누락을 확인합니다.

### revoke와 lost를 다르게 다룹니다

정상적인 partition 반납 통지가 오면 새 작업 투입을 막고 가능한 기한 안에서 진행 중 작업을 끝낸 뒤 연속 완료 위치를 커밋합니다. 이미 소유권을 잃은 통지라면 늦은 커밋이 거절될 수 있으므로 '마지막으로 한 번 커밋하면 안전하다'고 하지 않습니다. 그룹 세대는 Kafka의 offset 소유권을 보호하지만 이전 워커가 외부 DB에 보내는 쓰기까지 자동으로 차단하지는 않습니다.

예를 들어 10과 11을 병렬 처리하는데 11만 완료됐다면 10부터 다시 읽을 수 있는 커밋 위치를 유지합니다. 새 소유자는 10과 11을 다시 받아도 처리 ID 고유 제약으로 이미 끝난 11의 효과를 중복시키지 않습니다. 10이 늦게 완료될 때 새 상태를 덮는 문제는 이벤트 중복과 별개이므로 계정 상태 버전·허용 전이 조건을 함께 검사합니다.

### poll 수명과 워커 예산

느린 DB 호출 때문에 poll 간격이 max.poll.interval.ms를 넘으면 heartbeat가 별도로 살아 있어도 그룹 프로토콜상 재할당이 발생할 수 있습니다. poll과 worker를 분리하면 간격을 유지하기 쉽지만 무제한 수신 큐가 되지 않도록 partition을 pause하고, 완료 상태를 poll 소유 스레드로 전달하는 구조를 둡니다. 클라이언트 객체의 스레드 안전성도 확인해야 합니다.

cooperative rebalance는 모든 partition을 한 번에 반납하는 범위를 줄일 수 있고 static membership은 일시 재시작 때 불필요한 재할당을 줄일 수 있습니다. 어느 쪽도 처리 중 외부 효과의 원자성을 대신하지 않습니다. 할당 버전과 작업 ID를 로그에 남기고 scale-out, scale-in, 긴 GC 정지, DB timeout에서 옛·새 소유자의 실행이 겹치는지 시험합니다.

완료되지 않은 작업을 큐에서 버릴 수 있는 것은 원본 로그와 커밋 위치로 다시 받을 수 있다는 조건 아래에서입니다. offset을 먼저 전진시킨 뒤 메모리 큐를 폐기하면 영구 누락이 됩니다. 큐 정리·커밋·소유권 반환의 순서를 한 계약으로 검증하겠습니다.

## 득점 포인트

- 반납과 외부 작업을 연결한다.
- 연속 완료 offset을 예로 든다.
- 세대·멱등성으로 늦은 작업을 제한한다.
- poll 설정과 rebalance 효과를 구분한다.

## 감점 포인트

- 마지막 읽은 offset을 무조건 commit한다.
- heartbeat가 외부 처리를 안전하게 한다.
- 옛 쓰기를 그대로 수용한다.

## 더 파고들 거리

- 완료 watermark
- cooperative 범위
- 워커 큐 폐기 내구화
