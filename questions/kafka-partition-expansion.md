---
id: kafka-partition-expansion
title: "Kafka topic의 파티션 수를 늘린 뒤 같은 키의 이전 이벤트와 새 이벤트 순서가 깨질 수 있는 이유는 무엇인가요?"
answerMinutes: 5
followups: [{"id":"message-ordering-scope","prompt":"한 partition의 전달 순서를 여러 워커의 적용 순서로 유지하려면 어떻게 하나요?"},{"id":"kafka-partition-offset","prompt":"partition 변경 뒤 offset이 논리 버전이 될 수 없는 이유는 무엇인가요?"},{"id":"kafka-consumer-group","prompt":"특정 핫키가 한 partition에 몰릴 때 consumer 확장이 왜 충분하지 않나요?"}]
difficulty: 중하
category: 분산 시스템
tags: ["Kafka","파티션 확장","키 순서"]
related: ["message-ordering-scope","kafka-partition-offset"]
---

# Kafka topic의 파티션 수를 늘린 뒤 같은 키의 이전 이벤트와 새 이벤트 순서가 깨질 수 있는 이유는 무엇인가요?

## 구두 답변

일반 키 파티셔너는 현재 partition 수를 반영해 목적지를 계산합니다. partition이 3개일 때 partition 1로 간 키가 6개로 늘어난 뒤 partition 4로 갈 수 있습니다. 이전 이벤트와 이후 이벤트가 서로 다른 partition에 있으면 각 로그의 소비 순서가 독립적이라 같은 키의 전역 순서가 깨집니다.

### 이벤트 종류와 전환

조건부 차감이나 상태 전이는 새 이벤트가 먼저 적용되면 결과가 달라질 수 있지만 전체 상태 이벤트는 더 높은 버전으로 낮은 상태를 버릴 수 있습니다. 순서가 필수면 생산을 멈추고 옛 partition 처리 완료 후 전환하거나, generation·sequence·소유권 전환으로 이전 세대 완료를 확인하게 합니다. 논리 bucket을 고정하면 물리 partition 변경과 순서를 분리하지만 비용이 늘어납니다.

사용자 정의 파티셔너는 다국어 client의 정규화·해시를 고정해야 합니다. 기존 topic 증설과 새 topic cutover·이중 발행의 대사 비용을 비교합니다. 검증은 증설 전후 같은 키 발행, 옛 partition 지연, producer 재시작과 rebalance를 주입해 sequence·중복·늦은 이벤트 거부를 확인합니다.

### 같은 키가 다른 로그로 이동합니다

단순한 `hash(key) mod N` 예에서 해시값 4는 N=3일 때 partition 1, N=6일 때 partition 4로 갑니다. 새 메시지가 partition 4에서 먼저 소비되고 옛 메시지는 partition 1에서 지연되면 생산 시각과 적용 시각의 순서가 뒤집힙니다. 파티션 수 증설은 기존 레코드를 새 partition으로 재배치하지 않으므로, 옛 로그를 모두 읽었다는 조건 없이 새 로그의 위치만 보고 전환 완료를 판단할 수 없습니다.

순서 역전이 항상 산술 합계를 바꾸는 것은 아닙니다. 독립적인 +10과 +20만 정확히 한 번 적용하면 교환 가능하지만, 잔액 검사·차감·환불·상태 전이는 순서에 따라 결과가 달라집니다. 더 높은 버전의 전체 상태는 낮은 상태를 버릴 수 있어도 증분 이벤트를 버리면 합계 자체가 누락될 수 있으므로 이벤트 표현부터 구분합니다.

### 전환 세대와 완료 지점

짧은 생산 중단이 가능하면 옛 라우팅의 마지막 이벤트 위치를 확정하고 소비자가 그 위치까지 실제 효과를 적용한 뒤 새 partition 배치로 전환할 수 있습니다. producer 일부가 옛 metadata를 갖는 기간도 고려해야 합니다. 무중단이면 논리 키별 sequence와 세대, 옛 세대 완료 장벽을 두고 새 이벤트를 버퍼링하거나 재정렬합니다. 브로커 offset 하나가 두 partition을 관통하는 논리 순번이 되지는 않습니다.

논리 bucket을 고정해 물리 partition 매핑을 별도로 관리하면 변경을 좁힐 수 있지만 bucket 이동에도 소유권 전환이 필요합니다. 새 topic으로 옮기는 방법은 설정·보관 정책을 명확히 나누지만 이중 발행·이중 소비 기간과 복구 비용이 생깁니다. 실제 사용 중인 다국어 producer의 키 직렬화와 파티셔너가 동일한지도 테스트하겠습니다. 증설 목적이 단일 핫키라면 partition만 늘려서는 부하가 그대로일 수 있습니다.

## 득점 포인트

- 키 해시와 수 변화의 관계를 설명한다.
- 증분과 전체 상태를 나눈다.
- 중단·generation·논리 bucket을 비교한다.
- 전환 장애를 시험한다.

## 감점 포인트

- 같은 키의 partition이 항상 같다.
- 버전이 높으면 증분도 버린다.
- 새 메시지만 검사한다.

## 더 파고들 거리

- 무중단 완료 증명
- 다국어 파티셔너
- 새 topic cutover
