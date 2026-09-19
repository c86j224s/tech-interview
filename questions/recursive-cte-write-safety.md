---
id: recursive-cte-write-safety
title: 재귀 CTE로 계층의 모든 하위 행을 찾은 뒤 삭제하려 할 때 cycle·외래키·중복 영향을 어떻게 검증하나요?
difficulty: 중하
category: 데이터베이스
tags:
  - SQL
  - recursive CTE
  - DELETE
  - foreign key
related:
  - db-foreign-key-delete-policy
---
# 재귀 CTE로 계층의 모든 하위 행을 찾은 뒤 삭제하려 할 때 cycle·외래키·중복 영향을 어떻게 검증하나요?

## 구두 답변
재귀 SELECT의 결과를 곧바로 DELETE에 연결하지 않고, 도달 집합과 변경 대상 집합을 검증한 뒤 transaction 안에서 다시 확인합니다. A→B, A→C, B→D, C→D라면 D가 두 경로로 발견되므로 `DISTINCT tenant_id,node_id`로 실제 삭제 후보를 한 번만 만듭니다. cycle row와 depth 초과는 정상 삭제 집합에서 빼고 보류·오류 집합으로 기록합니다. path 중복과 정점 삭제 중복을 섞으면 영향 행 수가 부풀어 오릅니다.

그 다음 FK가 RESTRICT인지 CASCADE인지, 자식부터 지워야 하는지, cascade가 예상 밖 테이블까지 확장되는지 확인합니다. 권한과 테넌트 경계를 재검증하고, 다른 transaction이 간선을 추가하거나 부모를 바꾸는 경우 snapshot과 잠금 범위를 정합니다. 읽기 단계에서 시작점·reachable·cycle·depth-exceeded를 저장하고 mutation 직전에 후보와 FK 영향 범위를 확인하는 순서가 안전합니다.

부분 실패와 timeout에서 transaction rollback이 되는지, 재시도 시 이미 삭제된 행이 있어도 멱등적인지, 감사 로그가 후보·실제 삭제를 구분하는지 테스트합니다. 재귀가 종료했다는 사실은 외래키·권한·동시성 안전성을 증명하지 않습니다. 작은 fixture에서 예상 후보 3개, cascade 영향 2개 같은 수치를 먼저 검산한 뒤 승인된 사본에서 실행합니다.

## 득점 포인트
- DAG의 D 이중 경로를 DISTINCT 정점 후보로 dedupe합니다.
- cycle·depth 보류, FK 정책, 권한·잠금·snapshot을 mutation 전에 분리합니다.
- rollback·재시도·감사 로그에서 후보와 실제 삭제를 구분합니다.

## 감점 포인트
- recursive SELECT 결과를 바로 DELETE하면 항상 안전하다고 합니다.
- CASCADE를 편의 기능으로만 보고 영향 범위와 RESTRICT를 확인하지 않습니다.
- 종료 성공을 FK와 동시성 안전성의 증명으로 말합니다.

## 더 파고들 거리
- 삭제 직전 간선이 추가되는 경우 어떤 잠금과 재검증이 필요한지 설계해 보세요.
- 여러 테넌트가 같은 정수 node ID를 가질 때 path와 DISTINCT 키를 어떻게 구성할지 검토하세요.
