---
id: game-float-iteration-order
title: 같은 entity 집합을 순회해 합산하는데 iteration 순서가 바뀌면 왜 결과가 달라질 수 있나요?
difficulty: 중하
category: 게임 서버
tags:
  - 결정성
  - 합산
  - iteration order
related:
  - cpu-cache-false-sharing
---
# 같은 entity 집합을 순회해 합산하는데 iteration 순서가 바뀌면 왜 결과가 달라질 수 있나요?

## 구두 답변

부동소수점 덧셈은 유한 정밀도에서 결합법칙이 성립하지 않습니다. 설명용 binary32 trace `[1e8,-1e8,1]`에서는 `((1e8+-1e8)+1)=1`이지만 `1e8+((-1e8)+1)=0`입니다. 반대로 `[1e8,1,-1e8]`는 두 grouping이 모두 0이 될 수 있으므로 차이의 반례로 쓰지 않습니다. entity 순서가 ID에서 chunk 순서로 바뀌거나 worker partial sum을 합치는 reduction tree가 바뀌면 같은 문제가 생깁니다.

권위 결과라면 entity 정렬과 reduction tree를 고정하고, 정수 damage는 정수 누적을 검토합니다. 실수 impulse에는 고정 tree나 pairwise sum을 쓸 수 있지만 병렬성·메모리 비용이 늘어납니다. 합산 순서를 고정해도 system 실행 순서, RNG 소비, async completion이 남으면 전체 replay는 갈라질 수 있으므로 subsystem hash로 분리해 확인합니다. 수치는 설명용이므로 target compiler의 실제 결과도 검산해야 합니다.

정렬 자체도 비용과 의미를 확인해야 합니다. ID 오름차순은 안정적이지만 entity가 삭제·재사용되면 ID generation을 함께 정렬해야 할 수 있고, worker별 partial sum은 shard 순서를 고정해야 합니다. 정수로 바꿀 수 없는 값을 억지로 양자화하면 오차가 누적되므로, 허용 오차 모델과 bitwise replay 중 어느 계약이 필요한지 먼저 선택합니다.

 실수 합산을 허용 오차로 비교하는 설계는 화면용 값에는 쓸 수 있지만 소유권·체력·충돌 같은 권위 분기에는 위험합니다. 그 경우에는 합산 결과를 바로 분기에 쓰기보다 고정 순서 또는 정수화된 규칙 값으로 경계를 옮겨야 합니다.

 특히 reduction tree를 고정할 때 각 worker의 partial sum을 어떤 shard 순서로 합칠지도 기록해야 합니다. 그렇지 않으면 entity 정렬은 같아도 worker 수를 바꾼 빌드에서 결과가 다시 달라집니다.

## 득점 포인트

- binary32 합산에서 큰 값의 상쇄 순서가 결과를 바꾸는 예를 계산합니다.
- 엔티티 순서와 worker reduction tree를 함께 고정합니다.

## 감점 포인트

- 정렬한 엔티티를 비결정적인 병렬 합산으로 처리해도 결과가 같다고 합니다.
- 부동소수점 덧셈에 실수의 결합법칙을 그대로 적용합니다.

## 더 파고들 거리

- 보상 합산은 정확도와 bitwise 결정성에 각각 어떤 영향을 주나요?
- worker 수가 바뀌어도 동일한 reduction tree를 유지하는 비용은 무엇인가요?
