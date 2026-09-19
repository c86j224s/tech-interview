---
id: mlsearch-hnsw-delete-update
title: HNSW 문서를 삭제·갱신할 때 tombstone과 재삽입을 어떻게 검증하나요?
difficulty: 중하
category: 머신러닝
tags:
  - HNSW
  - deletion
  - freshness
related:
  - elasticsearch-alias-reindex-cutover
  - elasticsearch-refresh-visibility
---
# HNSW 문서를 삭제·갱신할 때 tombstone과 재삽입을 어떻게 검증하나요?

## 구두 답변

삭제·갱신은 logical visibility, graph link retention, compaction 시점을 분리해 검증하겠습니다. 삭제 직후 ID가 최종 검색 결과에서 빠지는지와 traversal 후보 내부에 tombstone link가 남아 있는지는 다른 현상입니다. 갱신이 in-place인지 새 vector 재삽입인지도 구현 계약을 읽어야 하며, 옛 vector의 stale hit, 새 vector의 fresh hit, 동일 logical ID 중복을 각각 측정합니다. 즉 “삭제 API가 성공했다”를 즉시 물리적 graph 부재나 모든 replica의 검색 부재로 확대하지 않습니다.

설명용으로 A의 old vector와 new vector를 서로 먼 위치에 둡니다. old 위치 query, new 위치 query를 삭제·갱신 전후에 실행해 결과 ID와 vector version을 기록합니다. 삭제 직후 old 위치에서 A가 결과에 나오면 visibility 차단이 실패한 것이고, traversal trace에만 남고 최종 결과에는 없으면 tombstone retention으로 분류합니다. new 위치에서 A가 안 나오면 replacement insertion 또는 refresh/visibility가 아직 완료되지 않은 것입니다.

그 뒤 compaction/rebuild를 수행하는 시점에 graph memory, visited candidate 수, stale link 비율이 줄어드는지 확인합니다. 특정 엔진의 즉시 삭제·update 보장은 버전별로 다르므로, HNSW 논문만으로 API 동작을 단정하지 않고 사용하는 저장소의 문서와 실제 테스트로 고정하겠습니다.


상태표를 만들면 진단 순서가 흔들리지 않습니다. `delete ACK`는 요청 수락일 뿐이고, `logical_deleted`는 결과 필터의 기준이며, `new_version visible`은 replacement가 검색 가능한 시점입니다. old 위치 query에서 A가 결과에 남으면 visibility 실패, traversal trace에만 남으면 tombstone retention, new 위치에서 A가 안 보이면 refresh·replica·재삽입 단계의 지연으로 분류합니다. compaction 뒤 tombstone 비율과 visited candidate 수가 감소하는지는 물리 정리 검증입니다. 이 동작의 즉시성은 엔진 버전 계약을 읽지 않은 상태에서는 unknown으로 두고, HNSW 논문에서 삭제 보장을 추론하지 않습니다.
## 득점 포인트

- 논리 삭제 결과와 graph link의 물리적 제거를 분리한다.
- old/new 위치 query, stale hit, duplicate logical ID, vector version을 구체적으로 검사한다.
- compaction·rebuild 시점과 visibility/refresh 계약을 엔진 버전 기준으로 확인한다.

## 감점 포인트

- 삭제 ACK 즉시 모든 traversal과 replica에서 흔적이 사라진다고 말한다.
- 갱신이 항상 in-place 또는 항상 재삽입이라고 구현을 확인하지 않고 단정한다.
- 새 vector가 검색되지 않는 문제를 graph recall만의 문제로 본다.

## 더 파고들 거리

- 삭제 ID가 후보에는 남지만 결과에서 제거될 때 recall 계산의 분모와 후보 trace를 어떻게 기록하겠습니까?
- replacement insertion 중 두 vector version이 함께 보이는 기간을 어떻게 제한하고 감시하겠습니까?
- tombstone 비율이 올라갈 때 rebuild와 online compaction 중 어떤 비용을 비교하겠습니까?
