---
id: keda-kafka-partitions
title: "Kafka consumer group의 파티션 수보다 KEDA가 소비자 Pod를 많이 만들 때 처리량이 늘지 않는 이유는 무엇인가요?"
answerMinutes: 5
followups: [{"id":"kafka-consumer-group","prompt":"partition 3개에 consumer 5개를 배치했을 때 유휴 consumer와 리밸런싱 비용을 실제 assignment와 처리율로 어떻게 확인하겠습니까?"},{"id":"kafka-partition-expansion","prompt":"키별 순서가 중요한 topic의 partition을 늘려야 한다면 기존 이벤트와 새 이벤트의 순서 전환을 어떤 기준으로 보장하겠습니까?"},{"id":"keda-hpa-role","prompt":"lag를 KEDA 입력으로 사용하되 커밋 간격 때문에 값이 출렁인다면 target·cooldown·stabilization을 어떻게 조정하겠습니까?"}]
difficulty: 중하
category: 인프라
tags: ["KEDA","Kafka","자동 확장"]
related: ["kafka-consumer-group"]
---

# Kafka consumer group의 파티션 수보다 KEDA가 소비자 Pod를 많이 만들 때 처리량이 늘지 않는 이유는 무엇인가요?

## 구두 답변

같은 Kafka consumer group에서는 일반적으로 하나의 partition을 한 시점에 하나의 consumer가 소유합니다. 그래서 partition이 4개인데 consumer Pod가 8개라면 동시에 partition을 할당받아 처리하는 Pod는 최대 4개이고 나머지는 유휴 상태가 됩니다. KEDA가 lag를 보고 Pod 수를 늘리는 것은 수요에 맞춘 실행 용량을 준비하는 동작이지, Kafka partition 하나를 여러 consumer가 병렬로 쪼개는 기능이 아닙니다.

`allowIdleConsumers` 같은 설정으로 partition 수보다 많은 consumer를 미리 둘 수는 있지만, 이것은 향후 partition 증설이나 재할당 시 프로세스 시작 시간을 줄일 여지가 있을 뿐, 그룹 조정과 할당 지연까지 없애지는 않으며 현재 partition의 처리 한계를 높이지 않습니다. 실제 KEDA 버전과 scaler 옵션, consumer client의 group 동작을 함께 확인해야 하며, 옵션 이름을 외우는 것보다 현재 partition assignment와 처리율을 관찰하는 것이 중요합니다.

### Pod 수와 Kafka 병렬성을 나눕니다

전체 lag가 커졌다고 Pod를 계속 늘리기 전에 partition별 lag, 각 partition의 초당 처리율, 메시지 키 분포, consumer assignment, 리밸런싱 시간, 하위 DB·외부 API 대기를 확인하겠습니다. 한 hot key가 한 partition에 몰려 있고 그 partition의 consumer가 느리다면 다른 Pod를 20개로 늘려도 그 키의 순서와 처리 한계는 그대로입니다. 반대로 여러 partition에 lag가 고르게 쌓이고 각 consumer가 CPU·DB 여유 없이 처리 중이라면 partition 수 이내에서 consumer를 늘리는 것이 도움이 됩니다.

consumer 수를 늘리거나 줄일 때 리밸런싱이 발생해 기존 소비자가 partition을 놓고 새 소비자가 이어받습니다. 처리 중인 레코드가 있는 동안 assignment가 바뀌면 offset 커밋 순서와 중복 처리 문제가 생길 수 있습니다. 커밋 전 작업이 재실행 가능해야 하고, 처리 완료보다 offset을 먼저 커밋하면 유실될 수 있습니다. 처리량 개선만 보지 말고 rebalance 동안 메시지 나이와 중복·유실 여부를 확인하겠습니다.

새 consumer group을 처음 만들 때 committed offset이 없으면 `earliest`나 `latest` 정책에 따라 읽기 시작 위치가 달라집니다. 새 group의 lag가 갑자기 전체 보존 메시지 수처럼 크게 보이는 것은 steady state에서 새로 쌓인 lag와 다른 현상일 수 있습니다. offset 초기 상태를 모른 채 scale 정책을 튜닝하면 불필요한 Pod 폭증이 일어납니다.

### partition을 늘리는 것은 별도 변경입니다

현재 4 partition의 병렬성 상한이 부족하면 topic partition을 증설할 수 있지만, 키의 해시 결과가 새 partition 수에 따라 달라져 같은 키의 이후 이벤트가 다른 partition으로 갈 수 있습니다. 그러면 기존 이벤트와 새 이벤트의 순서가 깨질 수 있으므로, 파티션 증설은 단순한 autoscaling과 다른 데이터 계약 변경입니다. 키별 순서가 중요하면 파티션 증설 전후 전환 기준, producer·consumer 재배치, 상태 버전 검증을 마련해야 합니다.

목표는 Pod 수가 아니라 허용 가능한 메시지 나이와 처리 회복 시간으로 정하겠습니다. burst, 한 hot partition, partition 증설, offset 없는 group, scaler 메트릭 장애를 각각 시험하고, 최대 consumer 수를 partition 수와 하위 시스템 용량 중 더 작은 병렬성 기준에 맞춥니다. partition당 consumer 한 개라는 제약과 그 위의 자동 확장 판단을 함께 다루는 것이 **partition 병렬성 상한**(partition parallelism ceiling)입니다.

## 득점 포인트

- consumer group에서 partition당 동시 consumer 한 개라는 병렬성 상한을 설명한다.
- 유휴 consumer 선점과 한 partition을 실제로 쪼개는 병렬 처리를 구분한다.
- hot partition·offset 초기화·rebalance·partition 증설을 확장 판단의 별도 변수로 둔다.

## 감점 포인트

- lag가 크면 partition 수와 무관하게 consumer Pod를 늘리면 처리량이 오른다고 말한다.
- 유휴 consumer 허용 옵션이 한 partition을 자동으로 여러 consumer에게 나눈다고 설명한다.
- 새 group의 초기 offset lag를 정상적인 지속 부하와 동일하게 해석한다.

## 더 파고들 거리

- allowIdleConsumers가 주는 재할당 선점 효과와 유휴 비용을 어떤 운영 조건에서 허용할까요.
- partition 증설이 키별 순서를 바꿀 수 있는 이유와 전환 검증 방법을 설명해 보세요.
- 커밋 간격으로 lag가 출렁일 때 autoscaling이 진동하지 않게 어떤 관찰 창을 둘까요.
