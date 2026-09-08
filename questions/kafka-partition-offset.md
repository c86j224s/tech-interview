---
id: kafka-partition-offset
title: "Kafka에서 topic, partition, offset은 각각 어떤 범위의 이름과 순서를 나타내며, offset은 왜 업무 완료가 아닌가요?"
difficulty: 하
category: 분산 시스템
tags: ["Kafka","partition","offset"]
related: ["message-ordering-scope"]
---

# Kafka에서 topic, partition, offset은 각각 어떤 범위의 이름과 순서를 나타내며, offset은 왜 업무 완료가 아닌가요?

## 구두 답변

Topic은 관련 레코드를 묶는 논리적 이름이고, partition은 topic 안에서 독립적으로 append되는 순서 있는 로그입니다. Offset은 그 partition 안에서 레코드를 식별하는 위치이므로 서로 다른 partition의 offset 숫자를 비교해 전역 순서를 만들 수 없습니다. 예를 들어 partition 0의 offset 10과 partition 1의 offset 3은 어느 레코드가 먼저 업무상 발생했는지를 알려 주지 않습니다.

계정별 순서가 필요하면 계정 키를 같은 partition으로 보내는 것이 출발점입니다. 그러나 파티션 수나 파티셔너가 바뀌면 목적지가 바뀔 수 있으므로 전환 기간의 순서는 별도 계약이 필요합니다. 또한 consumer가 offset을 읽었다는 것, 외부 DB에 효과를 커밋했다는 것, ACK를 보냈다는 것은 서로 다른 상태입니다. 장애 시 재처리를 안전하게 하려면 offset과 업무 ID·버전을 함께 설계해야 합니다.

파티션 수는 필요한 병렬성뿐 아니라 키 편중, 브로커 메타데이터, 파일·복구·운영 비용을 고려해 정하겠습니다. 파티션별 처리 속도가 다른 상황과 재시도를 재현해 필요한 범위의 순서만 보장되는지 확인합니다. offset은 업무 ID나 전역 시각이 아니므로 재생·중복 판별에 별도의 키가 필요한지 답변에 명시하겠습니다.

## 득점 포인트

- topic·partition·offset의 논리 범위와 순서 범위를 분리한다.
- 읽기 위치와 외부 업무 효과를 별도 상태로 설명한다.
- 파티션 수 선택을 병렬성 외 운영 비용까지 확장한다.

## 감점 포인트

- offset을 topic 전체의 전역 순서로 해석한다.
- 파티션 증설 뒤 키 목적지가 항상 유지된다고 말한다.
- offset 커밋이 외부 업무 성공을 자동 의미한다고 말한다.

## 더 파고들 거리

- offset 번호 사이에 빈 번호처럼 보이는 구간이 생길 수 있는 이유는 무엇인가요?
- 키 없는 레코드의 파티션 선택은 어떤 순서 계약을 확인해야 하나요?
- 파티션 변경 전에 재처리와 순서 정책을 어떤 테스트로 고정할까요?
