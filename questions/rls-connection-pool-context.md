---
id: rls-connection-pool-context
title: >-
  PostgreSQL의 permissive RLS policy 두 개는 OR로 결합됩니다. 테넌트 조건과 공개 조건을 따로 두면 어떤 행이
  노출될 수 있나요?
difficulty: 중하
category: 보안
tags:
  - RLS
  - connection pool
  - tenant
related:
  - db-connection-session-state
---
# PostgreSQL의 permissive RLS policy 두 개는 OR로 결합됩니다. 테넌트 조건과 공개 조건을 따로 두면 어떤 행이 노출될 수 있나요?

## 구두 답변

permissive policy 여러 개는 허용 조건을 OR로 합칩니다. 행 A는 `tenant_id='t1'`, 행 B는 `tenant_id='t2' AND is_public=true`라고 하겠습니다. t1 API role에 `tenant_id=current_setting('app.tenant_id')` 정책과 `is_public=true` 정책을 각각 permissive로 주면, context가 t1일 때 A뿐 아니라 B도 보입니다. 이것이 전역 공개 행이라는 제품 의도라면 명시된 결과지만, “t1 안에서 공개 행만”이 의도였다면 `(tenant=t1) AND public` 또는 적절히 분리된 restrictive 조건으로 다시 써야 합니다. restrictive policy는 허용된 permissive 결과를 AND로 좁히지만 role·command에 실제 적용되는지 확인해야 합니다.

pool은 이 논리를 자동 격리하지 않습니다. 요청 A가 물리 연결에 `SET app.tenant_id='t1'`를 남기고 반환한 뒤 요청 B가 context 설정을 건너뛰면 B의 쿼리가 t1로 평가될 수 있습니다. 반대로 context가 없는 경우 기본 tenant를 쓰면 누락을 데이터 노출로 바꿉니다. 공통 adapter가 transaction 시작 직후 검증된 tenant를 `SET LOCAL`로 설정하고 commit·rollback 뒤 reset을 확인하며, reset 실패 연결은 pool에 재투입하지 않게 합니다. 한 연결을 t1·t2 요청이 번갈아 쓰는 fixture로 SELECT와 UPDATE를 검증하고, worker·export 경로도 API middleware 없이 같은 권위 검사를 거치게 합니다.

## 득점 포인트

- permissive OR가 tenant 조건과 public 조건을 넓히는 구체 행 집합을 계산합니다.
- 전역 공개와 tenant 내부 공개의 의도를 식으로 구분합니다.
- transaction-local context·reset 실패 폐기·재사용 테스트를 연결합니다.

## 감점 포인트

- 두 policy가 항상 AND로 합쳐진다고 합니다.
- pool 재사용이 session 변수를 자동 격리한다고 가정합니다.

## 더 파고들 거리

- restrictive policy가 role·command 범위 때문에 예상과 달라지는 사례를 들어 보세요.
- worker가 API middleware 없이 tenant 권위를 확인하는 방법은 무엇입니까?
