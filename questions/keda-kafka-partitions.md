---
id: keda-kafka-partitions
title: "Kafka consumer group의 파티션 수보다 KEDA가 소비자 Pod를 많이 만들 때 처리량이 늘지 않는 이유는 무엇인가요?"
difficulty: 중하
category: 인프라
tags: ["KEDA","Kafka","자동 확장"]
related: ["kafka-consumer-group"]
---

# Kafka consumer group의 파티션 수보다 KEDA가 소비자 Pod를 많이 만들 때 처리량이 늘지 않는 이유는 무엇인가요?

## 구두 답변

같은 Kafka consumer group에서는 일반적으로 한 partition을 동시에 한 consumer가 소유합니다. 따라서 partition이 4개인데 consumer를 8개로 만들면 최대 4개만 partition을 받아 나머지는 유휴 상태가 됩니다. KEDA의 Kafka scaler(메시지 지연을 읽어 Pod 수를 조절하는 구성)에는 lag를 해석하고 유휴 consumer를 허용하는 옵션이 있지만, 옵션을 켠다고 한 partition이 자동으로 여러 consumer의 순차 처리 단위로 쪼개지는 것은 아닙니다. 즉 유휴 Pod를 미리 띄울 수 있어도 한 partition의 처리 한계 자체가 사라지지는 않습니다. 실제 scaler와 클라이언트 계약을 확인해야 합니다.

전체 lag가 커도 한 핫키가 한 partition을 막고 있다면 추가 Pod가 도움 되지 않습니다. 파티션별 lag·키 분포·처리 시간과 하위 DB 포화를 확인하고, scale-out 뒤 소비자 소유권을 다시 나누는 리밸런싱으로 오히려 처리율이 흔들리지 않는지 보겠습니다. 한 핫키가 한 partition에 남아 있으면 Pod를 더 띄워도 그 병목은 그대로입니다. 커밋 전 처리 중 레코드가 lag에 포함되는지, 새 group에 committed offset이 없을 때 `earliest`/`latest` 정책이 무엇인지도 운영 결과를 바꿉니다.

목표 lag는 “Pod 몇 개”가 아니라 허용 메시지 나이와 consumer 한 개의 처리 능력으로 정하겠습니다. 파티션 수를 증설하는 작업과 consumer 확장을 동시에 하면 키 순서와 재할당을 별도 검증해야 합니다. 버스트, offset 초기화, 메트릭 장애를 시험해 Pod 수가 아닌 가장 오래된 메시지의 지연과 실제 업무 완료가 개선되는지 확인합니다.

## 득점 포인트

- partition당 consumer 한 개라는 병렬성 상한을 설명한다.
- allow-idle 설정과 실제 partition 분할을 구분한다.
- offset 초기 상태·키 편중·하위 병목을 확장 판단에 포함한다.

## 감점 포인트

- lag가 크면 Pod를 partition 수와 무관하게 계속 늘린다.
- 유휴 consumer가 한 partition을 자동으로 나눠 처리한다고 말한다.
- offset 없는 새 group을 정상 steady state와 동일하게 해석한다.

## 더 파고들 거리

- allowIdleConsumers를 사용할 때 얻는 선점 효과와 유휴 비용은 무엇인가요?
- partition 증설과 KEDA 확장을 함께 진행할 때 키별 순서 전환을 어떻게 보장할까요?
- 커밋 간격으로 lag가 출렁일 때 cooldown과 stabilization을 어떻게 정할까요?
