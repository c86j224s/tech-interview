---
id: rls-using-with-check
title: PostgreSQL RLS의 USING과 WITH CHECK는 각각 무엇을 제한하나요?
difficulty: 중하
category: 보안
tags:
  - RLS
  - PostgreSQL
  - 멀티테넌트
related:
  - authentication-vs-authorization
---
# PostgreSQL RLS의 USING과 WITH CHECK는 각각 무엇을 제한하나요?

## 구두 답변

`USING`은 명령이 기존 행을 결과나 대상으로 삼을 수 있는지를 제한하고, `WITH CHECK`는 INSERT 또는 UPDATE 후의 새 행이 정책 범위 안에 남는지를 검사합니다. t1 context에서 SELECT를 실행하면 `USING tenant_id = 't1'`을 만족하는 기존 행만 보입니다. UPDATE에서는 먼저 기존 t1 행을 대상으로 삼을 수 있어야 하고, 새 값도 `WITH CHECK`를 만족해야 합니다. 따라서 t1 사용자가 자기 행의 `tenant_id`를 t2로 바꾸는 UPDATE는 새 행 검사가 실패해야 저장되지 않습니다. INSERT는 기존 행이 없으므로 주로 WITH CHECK가 새 tenant 값을 제한합니다.

다만 `WITH CHECK`를 생략한 의미를 정확히 말해야 합니다. SELECT-only 정책은 쓰기 권한을 만들지 않으므로 별도 INSERT·UPDATE 정책이 없다면 기본 deny 또는 role 권한 실패가 됩니다. 반대로 수정 명령에 적용되는 정책에서 check를 생략하면 PostgreSQL이 USING 식을 암묵적인 WITH CHECK로 사용할 수 있습니다. 그러므로 “check를 빠뜨리면 무조건 cross-tenant write”라는 설명은 틀립니다. 실제 write가 통과하려면 permissive 쓰기 정책이 넓거나 RLS가 꺼져 있거나 owner·BYPASSRLS 경로여야 합니다. `current_setting('app.tenant_id')`는 요청 body가 아니라 인증된 membership에서 transaction-local로 설정하고, role·command별 SELECT/INSERT/UPDATE/DELETE와 tenant_id 변경 테스트를 각각 둡니다.

## 득점 포인트

- USING은 기존 행의 visibility·target, WITH CHECK는 새 행의 write 조건으로 구분합니다.
- SELECT-only 정책과 수정 정책의 implicit check 동작을 함께 설명합니다.
- tenant_id 변경 UPDATE와 cross-tenant INSERT를 실행 상태로 추적합니다.

## 감점 포인트

- WITH CHECK 생략 자체가 항상 cross-tenant write라고 합니다.
- SELECT 필터만 있으면 쓰기 격리까지 끝났다고 봅니다.

## 더 파고들 거리

- RLS 실패를 403·404 중 무엇으로 매핑할지 정보 노출 기준을 말해 보세요.
- role과 command별 정책을 어떤 fixture로 검증하겠습니까?
