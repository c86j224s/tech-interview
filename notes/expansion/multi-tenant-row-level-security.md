---
id: multi-tenant-row-level-security
title: 멀티테넌트 Row-Level Security 정책
topic: 보안
summary: DB 세션 문맥과 RLS 정책으로 tenant 행 범위를 강제하고 connection pool·우회 경로·관리자 정책을 검증합니다.
questionIds: []
prerequisites:
  - authentication
  - transactions
related:
  - authentication
  - bulkhead-fairness
  - connection-lifetime
reviewedAt: '2026-09-19'
---
# 멀티테넌트 Row-Level Security 정책

## 애플리케이션 필터와 DB RLS의 역할

멀티테넌트 API가 모든 SQL에 `WHERE tenant_id = :tenant`를 붙이는 방식만으로 격리를 구성하면, 한 번의 누락된 목록·관리 쿼리·백그라운드 경로가 다른 tenant 행을 노출할 수 있습니다. PostgreSQL Row-Level Security(RLS)는 테이블에 정책을 선언하고 DB 실행 경계에서 행의 가시성과 기록 가능 범위를 제한하는 방어선입니다. 이것이 애플리케이션 인가를 없애는 것은 아닙니다. API는 누가 어떤 행동을 요청했는지 판단하고, DB는 최종 행 경계를 강제합니다.

RLS를 도입할 때 먼저 tenant context의 권위를 정합니다. 요청 body의 `tenant_id`나 사용자가 수정할 수 있는 헤더를 그대로 session variable에 넣으면 DB 정책이 공격자의 입력을 보호하게 됩니다. 인증 middleware가 검증한 principal과 서버가 선택한 tenant membership을 바탕으로 짧은 거래 안에서 context를 설정하고, pool 반환 시 다음 요청으로 남지 않게 합니다.

## USING과 WITH CHECK

`USING`은 기존 행이 명령의 대상이나 결과로 보일 수 있는지 제한하는 predicate입니다. SELECT에서 tenant t1 role이 t2 행을 읽지 못하게 하고, UPDATE·DELETE에서도 기존 행이 정책 범위에 들어가는지 판단하는 데 사용됩니다. `WITH CHECK`는 INSERT 또는 UPDATE 후의 새 행이 정책 범위에 남는지 검사합니다. 따라서 t1 사용자가 자기 행을 읽은 뒤 `tenant_id='t2'`로 바꾸어 다른 tenant로 이동시키는 쓰기도 별도 차단해야 합니다.

예를 들어 정책의 의도가 `tenant_id = current_setting('app.tenant_id')`라면 읽기에는 USING, 새 값에는 WITH CHECK가 모두 필요합니다. SELECT-only 정책은 INSERT·UPDATE를 허용하지 않으므로 기본 deny 또는 별도 쓰기 정책의 적용 결과를 먼저 확인해야 합니다. 반대로 INSERT·UPDATE를 허용하는 정책에서 `WITH CHECK`를 생략하면 PostgreSQL이 같은 `USING` 식을 암묵적인 check로 사용할 수 있습니다. 따라서 check 생략 자체가 cross-tenant write를 허용하는 원인은 아닙니다. cross-tenant write가 저장되려면 별도의 permissive 쓰기 정책, RLS 비활성화, table owner·BYPASSRLS 같은 우회 경로가 있어야 합니다. 명확성을 위해 tenant 경계는 USING과 WITH CHECK에 각각 적어 두고, SELECT·INSERT·UPDATE·DELETE를 분리해 테스트합니다.

## 정책 결합과 공개 행의 함정

PostgreSQL 정책은 permissive 정책과 restrictive 정책을 구분해 결합합니다. 기본 permissive 정책 여러 개는 허용 범위를 넓히는 OR처럼 결합되고, restrictive 정책은 추가 조건을 AND로 좁힙니다. 예를 들어 `tenant_id = t1` 정책과 `is_public = true` 정책을 별도의 permissive 정책으로 만들면 t1 행뿐 아니라 모든 tenant의 공개 행까지 보일 수 있습니다. “공개 또는 자기 tenant”가 의도라면 이 결과를 명시적으로 선택한 것이지만, “자기 tenant 안에서 공개 행만”이 의도라면 조건을 하나의 논리로 설계해야 합니다.

정책은 role과 command에도 적용됩니다. 일반 API role에 SELECT 정책만 있다고 해서 UPDATE가 같은 결과를 얻는 것은 아니며, role별 적용 여부와 `USING`·`WITH CHECK`를 함께 읽어야 합니다. 정책 목록을 코드 review에서 predicate 텍스트만 보는 대신 실제 role·명령·정책 결합 결과로 검증하는 이유입니다.

```diagram
{"title":"RLS는 context와 정책 결합으로 행 경계를 만듭니다","caption":"애플리케이션에서 고른 tenant context가 DB에 전달되지만, 최종 허용은 role과 명령에 맞는 USING·WITH CHECK 정책이 결정합니다.","rows":[[{"id":"principal","label":"검증된 principal","detail":["user · membership","허용 tenant"]}],[{"id":"context","label":"거래의 DB context","detail":["app.tenant_id = t1","pool 반환 전 폐기"]}],[{"id":"policy","label":"RLS policy","detail":["USING: 기존 행","WITH CHECK: 새 행"]}],[{"id":"rows","label":"테이블 행","detail":["t1은 통과","t2는 차단"]}],[{"id":"bypass","label":"별도 운영 경로","detail":["role·감사·승인"]}]],"edges":[{"from":"principal","to":"context","label":"서버가 검증해 설정"},{"from":"context","to":"policy","label":"current setting 참조"},{"from":"policy","to":"rows","label":"읽기·쓰기 범위 강제"},{"from":"bypass","to":"rows","label":"RLS 예외는 별도 권한"}]}
```

## Connection pool과 context 오염

물리 DB 연결은 pool에서 재사용되므로 세션 변수나 role을 설정한 뒤 반환하면 다음 tenant 요청이 이전 context를 볼 수 있습니다. 요청 A가 t1로 `SET`한 연결을 반환하고 B가 context를 다시 설정하지 않은 채 조회하면, SQL 텍스트에는 tenant 조건이 없어도 RLS가 t1을 기준으로 평가될 수 있습니다. 반대로 context가 비어 있거나 이전 값이 남은 실패 경로는 허용 범위가 아니라 오류로 처리해야 합니다.

가능하면 `SET LOCAL`처럼 transaction 범위 설정을 사용하고, transaction 시작과 종료를 감싼 공통 adapter에서 context를 설정합니다. commit·rollback 이후 연결 reset이 성공했는지 확인하고, reset이 실패한 연결은 정상 pool로 돌려보내지 않습니다. pool 크기를 키워 현상을 숨기지 말고 한 물리 연결로 두 요청을 번갈아 실행하는 테스트를 둡니다. 준비된 statement·임시 테이블·role·timezone 같은 다른 세션 상태도 같은 방식으로 검토합니다.

## Bypass role과 관리자 경로

테이블 owner, `BYPASSRLS` 권한 role, superuser는 일반 API role과 RLS 적용 범위가 다를 수 있습니다. 따라서 관리자 화면이 있다는 이유로 모든 운영 코드에 bypass role을 연결하면 애플리케이션 실수 한 번이 전체 tenant 데이터 읽기로 확대됩니다. API role은 RLS를 통과하는 최소 권한 role로 유지하고, migration·백업·감사 조회 등 정말 필요한 경로만 별도 role과 실행 경계로 분리합니다.

관리자에게 전체 tenant 접근이 필요한 경우에도 “admin이므로 무조건 bypass”가 아니라 승인된 작업, 요청 범위, 감사 기록, 단기 자격, 읽기와 쓰기 분리를 설계합니다. migration은 스키마 변경과 데이터 backfill이 모두 필요한지에 따라 제한된 maintenance role을 쓰고, 작업 중 테넌트 정책을 우회한다는 사실을 운영 상태로 표시합니다. 목표 버전의 PostgreSQL 문서에서 owner와 BYPASSRLS의 실제 동작을 확인해야 하며 이 노트가 모든 배포 역할 구성을 대신 정하지는 않습니다.

## Tenant context의 생성·검증·폐기

인증된 사용자가 t1과 t2 모두의 멤버라면 요청이 어느 tenant를 대상으로 하는지 별도의 membership 검사로 결정합니다. URL의 tenant slug는 대상 선택의 입력일 뿐이며, principal이 그 tenant에 속하는지 서버가 확인한 뒤 DB context를 만듭니다. context 값의 형식과 길이를 제한하고, 사용자가 보낸 임의 설정 이름으로 `current_setting`을 만들지 않습니다.

거래가 시작된 뒤 context를 바꾸지 못하게 하거나, 바꿀 때 새 membership과 명시적인 전환을 거치게 합니다. 백그라운드 worker는 사용자 요청의 DB 연결을 재사용하지 않고, job payload에 tenant를 저장하되 job 소비 시 현재 권한과 데이터 범위를 다시 확인합니다. SQL 콘솔·관리 export·배치·CDC 재적용처럼 API middleware를 거치지 않는 경로도 RLS role과 감사 정책을 별도로 적용합니다.

## 테스트·장애·마이그레이션 경계

최소 테스트 세트는 t1 role의 SELECT·INSERT·UPDATE·DELETE, t2 행에 대한 동일 동작, tenant_id 변경 UPDATE, permissive 공개 정책과의 결합, pool 연결 재사용, context 누락, bypass role 실행입니다. 기대 결과는 단순히 403이 아니라 DB가 반환한 행 수·영향 행 수·SQL 오류·감사 이벤트까지 포함해야 합니다. t1 요청이 t2 행을 업데이트하려 할 때 UPDATE가 0행인지 정책 오류인지도 API 계약에 맞춰 확인합니다.

스키마 migration에서 테이블을 잠깐 RLS 없이 만들거나 새 컬럼 정책을 먼저 열어 두는 순서를 피합니다. 새 앱과 구 앱이 함께 실행되는 동안 어떤 role과 컬럼을 사용할지, 정책을 언제 강제할지 호환 배포 계획을 둡니다. 정책 변경이 차단을 넓히거나 좁힐 수 있으므로 실제 tenant fixture로 전후 결과를 대조하고, 장애 시 “RLS가 실패했으니 모두 허용”으로 fallback하지 않습니다.

## 참고 자료와 확정이 필요한 운영 값

근거는 [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) 문서와 저장소의 [인증된 요청의 자원별 권한 검사](/tech-interview/notes/authentication/), [DB 연결의 대기·보유·취소·세션 초기화](/tech-interview/notes/connection-lifetime/)입니다. 문서가 설명하는 정책 의미와 별개로 목표 PostgreSQL 서버 버전, 드라이버의 transaction-local 설정·reset 동작, pool 구현, 관리자 role 배치는 구현자가 선택해야 합니다.

적용 순서는 일반 API role로 RLS를 강제하고, principal에서 tenant context를 서버가 만들며, policy 결합을 단일 tenant fixture로 검증한 뒤, bypass 경로를 별도 승인·감사로 여는 것입니다. 공개 행 정책, migration role, replica/읽기 전용 경로와 export는 반드시 같은 보안 경계를 실제 실행 경로로 확인해야 합니다.
