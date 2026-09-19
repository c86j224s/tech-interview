---
id: game-entity-replication-baseline-per-entity
title: entity마다 replication baseline을 따로 두는 이유는 무엇인가요?
difficulty: 중하
category: 게임 서버
tags:
  - replication
  - baseline
  - entity
related:
  - game-state-input-delivery-classes
---
# entity마다 replication baseline을 따로 두는 이유는 무엇인가요?

## 구두 답변

client가 entity를 처음 본 시점과 공개 필드가 서로 다르므로 world 전체 baseline 하나만으로는 안전한 delta가 되지 않습니다. A가 S10에서 AOI에 들어와 create를 받았고 B가 S12에서 처음 보였다면 B에게 S11 delta를 보내도 B는 source를 가지고 있지 않습니다. 더구나 S11 delta에 A에게만 공개된 필드가 들어 있으면 정보 경계도 깨집니다. 따라서 connection·entity별로 generation, spawnVersion, lastAckedVersion, 공개 field mask를 유지하고 AOI 진입에는 현재 state의 full create를 보내 새 baseline을 설치합니다. AOI 밖에 있던 위치 변경을 모두 누적하는 대신 재진입 때 현재 state로 시작하는 것이 복구와 메모리에 유리합니다. 단, 보상·전투 결과·거래처럼 반드시 보존할 사건은 snapshot delta가 아니라 ordered/durable event contract로 전달해야 합니다. 전역 baseline이 가능하려면 모든 client가 같은 entity set, schema, field permission, 시점을 실제로 보유한다는 강한 조건을 증명해야 합니다. per-entity baseline은 메모리와 ACK bookkeeping을 늘리지만 baseline 부재와 공개 누출을 진단하기 쉽습니다. 측정은 full create bytes, delta 절감, AOI churn, resync, 공개 field violation을 따로 기록합니다.


per-entity record는 실제로는 connection별 전체 객체를 모두 복사하는 방식만 뜻하지 않습니다. 동일한 AOI shard에서 같은 generation의 immutable create snapshot을 공유하고, connection마다 lastAckedVersion과 field permission만 분리하는 절충도 가능합니다. 다만 shard를 공유할수록 한 client의 공개 필드 변경이 다른 client의 baseline 의미를 바꾸지 않는지 검사해야 합니다. entity가 generation을 바꾸거나 AOI를 나가면 이전 record와 pending delta를 원자적으로 폐기하고, 재진입 create의 ACK를 새 기준으로 삼아야 합니다.
## 득점 포인트

- A=S10, B=S12 trace로 world baseline의 source 부재를 계산합니다.
- AOI 재진입 full create와 durable event channel을 구분합니다.
- per-entity memory 비용과 공개 안전성이라는 양쪽 선택 기준을 설명합니다.

## 감점 포인트

- world sequence가 크면 모든 client가 이전 delta를 복원한다고 가정합니다.
- AOI 밖 비공개 변경을 무한 누적하거나 보상 event를 snapshot처럼 버립니다.
- per-entity state의 bytes와 ACK bookkeeping 비용을 무시합니다.

## 더 파고들 거리

- hot entity가 많은 경우 per-entity record를 shard 단위로 묶을 때 잃는 공개·복구 정밀도를 비교해 보세요.
- generation 변경 시 기존 baseline을 즉시 폐기해야 하는 조건을 정의해 보세요.
