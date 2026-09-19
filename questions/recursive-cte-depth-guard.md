---
id: recursive-cte-depth-guard
title: 조직 계층에 잘못된 cycle이 들어왔을 때 recursive CTE를 무한히 실행하지 않게 어떤 종료 방어를 두겠습니까?
difficulty: 하
category: 데이터베이스
tags:
  - SQL
  - recursive CTE
  - cycle
  - depth
related:
  - algorithm-topological-cycle
---
# 조직 계층에 잘못된 cycle이 들어왔을 때 recursive CTE를 무한히 실행하지 않게 어떤 종료 방어를 두겠습니까?

## 구두 답변
방문 경로 검사와 최대 depth를 함께 두고, cycle·depth 초과를 정상적인 하위 없음과 다른 상태로 반환하겠습니다. A→B→C→B라면 path가 `[A]`, `[A,B]`, `[A,B,C]`로 진행되고 다음 B 후보에서 `B ∈ [A,B,C]`가 참이 됩니다. 이 row를 `cycle=true`로 표시한 뒤 더 확장하지 않습니다. `depth < 100`은 재귀 폭주를 제한하는 안전망이지 방문 검사 대체물이 아닙니다.

정상 계층 최대 깊이가 12라고 관측되면 100을 운영 상한 후보로 둘 수 있지만, 100단계가 유효한 조직을 조용히 잘라내면 안 됩니다. `depth_limit_exceeded` 집합으로 반환해 검수하거나 재처리합니다. path key는 테넌트와 node를 함께 포함해야 서로 다른 조직의 ID 7을 같은 정점으로 오인하지 않습니다. NULL parent를 루트로 볼지, NULL node를 거부할지도 입력 계약에 넣습니다.

읽기 query에서 reachable, cycle, depth-exceeded를 각각 검증한 뒤 권한 계산이나 삭제에 연결합니다. 경로 배열은 깊이에 따라 행 폭과 메모리를 늘리므로 엔진의 CYCLE 지원이나 별도 visited 구조를 검토하되 버전별 문법을 확인합니다. 재귀 term 작성 순서가 BFS·DFS 실행을 보장하지 않으며, 표시가 필요하면 depth/path를 최종 ORDER BY에 둡니다.

## 득점 포인트
- A→B→C→B의 path와 cycle 판정을 회차별로 보여 줍니다.
- depth cap을 안전망으로 두되 정상 깊은 계층을 보류 상태로 보존합니다.
- tenant·node 복합 식별자와 mutation 전 보류 집합 검증을 포함합니다.

## 감점 포인트
- depth cap만 두고 초과 행을 하위 없음으로 숨깁니다.
- cycle 검사와 depth 제한을 같은 기능이라고 설명합니다.
- recursive term 순서가 실제 BFS·DFS와 종료를 보장한다고 말합니다.

## 더 파고들 거리
- path 배열이 매우 긴 계층에서 행 폭과 메모리를 어떻게 줄일지 비교해 보세요.
- 동시 간선 추가가 있을 때 snapshot과 mutation 직전 재검증 범위를 정해 보세요.
