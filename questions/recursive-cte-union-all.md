---
id: recursive-cte-union-all
title: 재귀 CTE에서 UNION과 UNION ALL을 바꾸면 중복 정점과 종료 조건이 어떻게 달라지나요?
difficulty: 중하
category: 데이터베이스
tags:
  - SQL
  - recursive CTE
  - UNION
  - graph
related:
  - bfs-dfs-shortest-path
---
# 재귀 CTE에서 UNION과 UNION ALL을 바꾸면 중복 정점과 종료 조건이 어떻게 달라지나요?

## 구두 답변
`UNION ALL`은 recursive term이 만든 행을 그대로 다음 working set으로 전달합니다. A→B→C→A에서 node와 depth를 함께 출력하면 A(0), B(1), C(2), A(3), B(4)처럼 새 행이 계속 생기므로 path 검사나 depth 제한이 없으면 종료하지 않을 수 있습니다. `UNION`은 전체 출력 컬럼이 같은 행을 이미 결과에서 제거합니다. node만 출력하는 단순 도달성이라면 A를 다시 만든 행이 제거되어 이 cycle의 확장을 억제할 수 있습니다.

그러나 이것은 모든 cycle을 안전하게 해결한다는 뜻이 아닙니다. `depth`나 `path`가 출력에 포함되면 `[A]`와 `[A,B,C,A]`는 다른 행이라 UNION 중복 제거를 통과합니다. 반대로 path를 제거하면 A에 이르는 서로 다른 경로를 보존해야 하는 요구를 잃을 수 있습니다. A→B, A→C, B→D, C→D에서 정점 도달만 필요하면 D를 한 번만 두고, 경로 설명이 필요하면 두 path를 보존하는 식으로 중복 키를 먼저 정합니다.

실무에서는 도달성·경로 열거·cycle 진단을 별도 결과로 분리합니다. `UNION ALL`을 쓰면 `(tenant,node)` 방문 검사와 최대 depth를 두고 cycle 행을 보류 집합으로 남길지 결정합니다. 숫자는 설명용 상태 추적이며 PostgreSQL 서버 실행 결과로 가장하지 않습니다.

## 득점 포인트
- UNION은 전체 행, visited는 도메인 정점 기준이라는 차이를 말합니다.
- depth/path가 중복 키를 바꾸는 A→B→C→A 상태를 제시합니다.
- 도달성·경로 열거·오류 진단의 출력 계약을 분리합니다.

## 감점 포인트
- UNION이면 모든 순환이 자동으로 멈춘다고 합니다.
- UNION ALL에서 path·depth 방어 없이 정상 종료를 약속합니다.
- DAG의 같은 정점 중복과 cycle을 같은 오류로 취급합니다.

## 더 파고들 거리
- 두 부모가 D에 도달하는 DAG에서 정점 집합과 경로 집합을 각각 어떻게 만들지 비교해 보세요.
- cycle 행을 감사·보류로 남기면서 정상 도달 결과와 mutation 대상을 분리하는 방법을 설계해 보세요.
