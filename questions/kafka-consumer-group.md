---
id: kafka-consumer-group
title: "Kafka 파티션이 3개인데 같은 그룹의 소비자를 5개로 늘렸습니다. 왜 일부 소비자는 일을 하지 않으며 언제 확장이 도움이 되나요?"
answerMinutes: 5
followups: [{"id":"kafka-rebalance-processing","prompt":"처리 중 partition을 잃으면 연속 완료 offset과 외부 작업을 어떤 순서로 정리하나요?"},{"id":"kafka-partition-offset","prompt":"읽은 위치가 아니라 어느 offset까지만 commit할 수 있나요?"},{"id":"kafka-partition-expansion","prompt":"partition 수를 늘리면 같은 키 순서가 왜 깨지나요?"}]
difficulty: 하
category: 분산 시스템
tags: ["Kafka","consumer group","병렬성"]
related: ["kafka-partition-offset"]
---

# Kafka 파티션이 3개인데 같은 그룹의 소비자를 5개로 늘렸습니다. 왜 일부 소비자는 일을 하지 않으며 언제 확장이 도움이 되나요?

## 구두 답변

Kafka consumer group에서는 한 시점에 한 partition을 같은 group의 한 consumer가 소유합니다. partition 3개에 consumer 5개면 최대 3개만 일하고 2개는 유휴입니다. 다른 group은 같은 레코드를 독립적으로 읽습니다.

### 병목을 먼저 찾는다

키 해시가 한 partition에 몰리거나 그 partition의 처리 비용이 크면 consumer를 늘려도 lag가 줄지 않습니다. partition별 lag·처리율·가장 오래된 레코드·키 분포와 하위 DB의 CPU·락·연결을 확인합니다. partition 내부 워커 병렬화는 처리량을 늘릴 수 있지만 완료 순서를 섞습니다. 10번이 미완료인데 11번 완료만으로 offset 12를 commit하면 10번을 건너뜁니다.

따라서 외부 효과가 성공한 가장 긴 연속 구간까지만 commit하고 뒤의 완료는 기록해 앞 구간 완료 후 전진시킵니다. partition 수를 늘리면 병렬성은 커지지만 키 목적지와 순서·파일·복구 비용이 바뀔 수 있습니다. consumer 추가·제거의 rebalance는 외부 효과 중복을 만들 수 있어 멱등성이 필요합니다.

검증은 consumer 1·3·5, 키 편중, 느린 메시지, scale-in·재시작을 시험하고 partition별 lag와 DB 포화·누락·중복을 확인합니다.

### 소유권과 실제 실행은 다릅니다

일반적인 consumer group에서 partition 하나의 할당 소유자는 한 consumer이지만 이전 소유자가 이미 시작한 외부 DB 작업은 rebalance 직후에도 계속될 수 있습니다. 브로커가 새 owner를 지정하는 것과 옛 작업의 중단이 동시에 일어나는 것은 아닙니다. 이벤트 ID의 고유 제약과 상태 버전 검사를 저장 지점에 두어 옛 완료가 새 상태를 덮지 않게 해야 합니다.

poll 스레드가 레코드를 가져오고 별도 워커가 처리하면 네트워크 소비와 계산을 분리할 수 있습니다. 그러나 큐가 무한하면 lag만 낮아 보이고 애플리케이션 안에 미처리 작업이 쌓입니다. partition별로 처리 가능한 양만 수락하고 포화 시 pause하며, poll과 heartbeat의 클라이언트 계약을 지키면서 재개합니다. fetch 위치·커밋 위치·외부 효과 완료 위치를 각각 계측합니다.

### 확장 전에 편중을 측정합니다

partition이 12개여도 한 partition이 전체 요청의 90%를 가지면 워커를 12개로 늘린 효과는 제한적입니다. 키를 나누면 부하는 줄 수 있지만 같은 계정의 순서와 원자성 범위도 바뀝니다. 순서가 필요 없는 독립 이벤트만 병렬화하고 동일 키는 직렬화하는 등 요구에 맞는 구조를 선택하겠습니다.

다른 group은 같은 로그를 별도의 offset으로 읽습니다. 검색·분석·알림이 각각 모든 이벤트를 읽어야 하면 group을 분리하고, 한 서비스 인스턴스끼리만 같은 group을 씁니다. 그룹 이름 변경은 단순 배포 라벨 변경이 아니라 새 소비 상태를 만드는 변경이므로 시작 위치와 중복 재처리를 검토합니다. 장애 시험에서는 인스턴스 수 증가·감소와 가장 느린 partition을 분리하고 외부 DB 포화가 새 병목인지 함께 확인하겠습니다.

## 득점 포인트

- partition이 병렬성 상한임을 숫자로 말한다.
- 키 편중과 하위 DB 병목을 분리한다.
- 연속 완료 offset을 설명한다.
- rebalance와 멱등성을 연결한다.

## 감점 포인트

- consumer 수만큼 처리량이 증가한다.
- 다른 group이 레코드를 나눠 가진다.
- 뒤 완료 offset을 바로 commit한다.

## 더 파고들 거리

- 완료 watermark
- 핫키 처리
- pause와 탈퇴
