---
id: mlsearch-hnsw-m-memory
title: HNSW M을 키우면 왜 graph memory와 build cost가 늘어나나요?
difficulty: 중하
category: 머신러닝
tags:
  - HNSW
  - M
  - memory
related:
  - graph-representation
  - query-memory-grant-over-under
---
# HNSW M을 키우면 왜 graph memory와 build cost가 늘어나나요?

## 구두 답변

`M`은 HNSW에서 한 정점이 유지할 수 있는 근접 이웃 연결 수의 핵심 상한입니다. M을 키우면 더 많은 link ID와 메타데이터를 저장하고, 삽입 중에는 후보에서 선택할 연결을 더 많이 유지·평가하므로 graph memory와 build cost가 함께 증가합니다. 대신 연결 경로가 풍부해져 같은 `efSearch`에서 품질이 좋아질 여지는 있습니다. 하지만 모든 데이터셋에서 recall이 단조 증가한다고 말하지 않고 M과 `efConstruction`을 다시 빌드해 품질·메모리·build 시간을 교차 비교합니다.

설명용으로 1M 정점, 4바이트 ID, 평균 degree를 M으로 근사하면 M=16 링크 ID는 약 64MB, M=48은 약 192MB입니다. 실제 index에는 vector, layer metadata, 양방향 링크, allocator 여유, 삭제 상태가 들어가므로 전체 메모리의 정확한 값은 아닙니다. 링크를 더 많이 저장하면 query traversal 때 읽을 이웃 수도 늘어나며, 캐시를 벗어나면 평균보다 p99가 악화될 수 있습니다.

또 M만 키우고 build exploration을 고정하면 좋은 이웃을 선택할 후보가 충분하지 않을 수 있습니다. M=16/48과 efConstruction=64/512를 별도 index로 조합해 exact recall@10, build 시간, resident memory, p99를 비교하고, 링크 수 증가가 실제 품질 이득으로 이어졌는지 확인하겠습니다.


링크 비용과 build 탐색 비용도 분리해 기록해야 합니다. 1M 정점에서 ID만 계산하면 M=16은 64,000,000바이트, M=48은 192,000,000바이트지만, 실제 양방향 adjacency와 layer별 배열은 이보다 큽니다. 같은 M=16에서 efConstruction을 64에서 512로 바꾸면 저장 link 상한은 그대로이고 삽입 시 후보 거리 계산과 임시 heap만 증가합니다. 반대로 M을 48로 올리고 efConstruction을 64로 고정하면 저장 공간은 늘어도 선택 후보가 좁아 품질 이득이 작을 수 있습니다. 따라서 네 조합을 새 index로 만들고 resident memory와 build time뿐 아니라 cache miss와 p99를 기록합니다. 숫자는 엔진 실행 결과가 아니라 ID 하한의 설명용 계산입니다.
## 득점 포인트

- M을 최종 graph degree·link 저장량의 핵심 상한으로 설명한다.
- 단순 링크 ID 계산과 실제 전체 memory를 구분하고 양방향·metadata·vector 비용을 언급한다.
- M과 efConstruction, efSearch를 별도 축으로 sweep해 품질과 비용을 함께 본다.

## 감점 포인트

- M을 키우면 모든 데이터셋에서 recall이 반드시 증가한다고 단정한다.
- M을 query 후보 수 또는 efSearch와 같은 파라미터로 설명한다.
- 링크 메모리의 단순 계산을 전체 index 메모리라고 보고한다.

## 더 파고들 거리

- 같은 M에서 efConstruction을 키울 때 graph quality와 build 시간이 어떻게 달라지는지 어떻게 검증하겠습니까?
- 링크 수 증가가 recall보다 p99를 먼저 악화시키는 cache 상태를 어떻게 관찰하겠습니까?
- 삭제·갱신이 많은 index에서 M 증가와 tombstone compaction 비용을 어떤 지표로 비교하겠습니까?
