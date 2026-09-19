---
id: mlsearch-hnsw-construction-quality
title: efConstruction을 크게 한 index가 작은 efSearch에서도 항상 높은 recall을 유지하나요?
difficulty: 중하
category: 머신러닝
tags:
  - HNSW
  - efConstruction
  - recall
related:
  - bfs-dfs-shortest-path
  - ranking-global-topk
---
# efConstruction을 크게 한 index가 작은 efSearch에서도 항상 높은 recall을 유지하나요?

## 구두 답변

항상 그렇지는 않습니다. `efConstruction`은 삽입 시 이웃을 선택하기 위해 탐색하는 후보 폭이고, `efSearch`는 질의 시 그래프를 얼마나 넓게 펼칠지 정하는 runtime 폭입니다. 큰 efConstruction은 같은 M에서 더 좋은 연결을 고를 가능성을 높이지만, query가 작은 efSearch로 일부 경로만 보면 그 graph quality를 충분히 활용하지 못할 수 있습니다. 반대로 작은 build 폭으로 만든 graph를 큰 efSearch가 어느 정도 보완할 수는 있어도 놓친 연결을 복구한다는 보장은 없습니다.

검증은 build ef 64/512로 별도 index를 만들고 search ef 16/128을 교차시킨 네 조합으로 합니다. 모든 조합에서 같은 vector, query, distance metric, 필터와 exact baseline을 사용하고 recall@10, build 시간, index memory, p95/p99를 기록합니다. 예를 들어 build=512가 search=16에서 0.95, search=128에서 0.99이고 build=64가 각각 0.90, 0.97이라면 상호작용이 보입니다. 숫자는 실행 결과가 아니라 측정 설계 예시입니다.

build 시간이 늘었다는 사실만으로 query recall을 보장하지 않습니다. 데이터 분포나 M이 제한되어 있으면 후보를 많이 봐도 최종 링크가 충분하지 않을 수 있고, 필터가 graph connectivity를 깨뜨릴 수도 있습니다. 따라서 작은 ef에서의 저지연을 목표로 한다면 build 품질과 runtime 탐색 폭을 함께 고정해 선택합니다.


작은 그래프 trace를 보면 “항상”이라는 표현의 한계가 드러납니다. build ef=64에서는 entry에서 p만 저장되고 q로 가는 우회 정점 r이 link 후보에서 탈락했다고 하겠습니다. build ef=512에서는 r이 저장되어 같은 query의 경로가 entry→r→q가 됩니다. 그래도 search ef=16이면 runtime 후보 heap에 p만 남아 두 index가 모두 q를 놓칠 수 있고, ef=128에서만 r을 유지해 두 번째 index가 회복할 수 있습니다. build 64/512와 search 16/128의 네 칸에 recall@10, build time, memory, p99를 기록하고 filter별 exact oracle을 고정해야 합니다. 수치는 설명용 상태입니다.
## 득점 포인트

- build-time 후보 폭과 query-time 후보 폭의 상태·목적을 분리한다.
- 네 조합 교차 실험에서 exact recall, build cost, memory, tail latency를 비교한다.
- 큰 efConstruction이 보장을 제공하지 않으며 M·필터·데이터 분포가 경계를 만든다고 설명한다.

## 감점 포인트

- build ef가 크면 어떤 search ef에서도 높은 recall이 보장된다고 말한다.
- efConstruction과 efSearch를 동일한 후보 heap으로 설명한다.
- build 시간이 길어진 것만으로 graph quality를 증명했다고 주장한다.

## 더 파고들 거리

- M이 작을 때 build ef 증가가 더 이상 recall을 높이지 않는 징후를 어떤 표로 찾겠습니까?
- 필터 selectivity를 추가해 네 조합의 recall을 다시 측정할 때 어떤 축을 고정해야 합니까?
- graph를 재빌드하지 않고 runtime ef만 올려도 해결되지 않는 누락을 어떻게 진단하겠습니까?
