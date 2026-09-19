---
id: recursive-cte-order-traversal
title: 재귀 CTE 결과를 계층의 깊이 우선 또는 너비 우선 순서로 표시하려면 순회 순서를 어떻게 표현하나요?
difficulty: 중하
category: 데이터베이스
tags:
  - SQL
  - recursive CTE
  - DFS
  - BFS
related:
  - bfs-dfs-shortest-path
---
# 재귀 CTE 결과를 계층의 깊이 우선 또는 너비 우선 순서로 표시하려면 순회 순서를 어떻게 표현하나요?

## 구두 답변
재귀 term이 현재 어떤 순서로 행을 내놓는지 믿지 않고 각 행에 명시적인 순서 키를 만든 뒤 최종 `ORDER BY`로 표시합니다. 루트 1, 자식 2·3, 손자 4·5라면 BFS형 키는 `depth`와 형제 키를 사용해 깊이 0의 1, 깊이 1의 2·3, 깊이 2의 4·5 순서로 정렬합니다. 예를 들어 `ORDER BY depth, path, node_id`처럼 path와 유일 tie-breaker를 함께 둘 수 있습니다.

DFS형은 path를 우선해 `[1,2]` 아래의 `[1,2,4]`가 형제 `[1,3]`보다 먼저 오도록 설계합니다. 배열 비교를 쓰면 숫자 배열의 순서를 이용할 수 있지만 문자열 `1.10`과 `1.2`는 사전식 순서가 되어 의도와 달라질 수 있습니다. 고정 폭 segment나 typed array를 선택하고 같은 키가 생기면 node ID를 추가합니다. DAG에서 한 노드에 여러 path가 있으면 path별 행을 보존할지 대표 경로만 고를지도 결과 계약입니다.

PostgreSQL의 `SEARCH DEPTH FIRST`·`SEARCH BREADTH FIRST`는 정렬에 사용할 열을 계산하는 기능으로 읽고, 최종 결과에는 그 열을 ORDER BY해야 합니다. 이것은 표시 순서와 실제 working table 평가 순서를 구분하는 장치입니다. 페이지네이션까지 동일 순서를 요구하면 cursor에 depth/path와 유일 키를 함께 넣습니다.

## 득점 포인트
- evaluation order와 presentation order를 분리합니다.
- 루트 1, 자식 2·3, 손자 4·5의 depth/path 상태를 제시합니다.
- 문자열 숫자 정렬과 DAG 다중 path, 최종 유일 ORDER BY를 다룹니다.

## 감점 포인트
- recursive term에 먼저 쓴 SELECT가 최종 출력 순서를 보장한다고 합니다.
- depth만 정렬하면 형제 순서까지 결정된다고 말합니다.
- 문자열 path의 사전식 정렬 문제를 무시합니다.

## 더 파고들 거리
- SEARCH 열을 사용하지 않고 수동 path key를 만들 때 배열·고정 폭 문자열의 비용을 비교해 보세요.
- cursor pagination에서 path가 길어질 때 안정성과 저장 크기를 함께 평가해 보세요.
