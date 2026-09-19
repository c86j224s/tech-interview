---
id: rls-bypass-role
title: RLS를 적용한 테이블에서 관리자와 migration role은 어떻게 다뤄야 하나요?
difficulty: 중하
category: 보안
tags:
  - RLS
  - PostgreSQL
  - 최소 권한
related:
  - authentication-vs-authorization
---
# RLS를 적용한 테이블에서 관리자와 migration role은 어떻게 다뤄야 하나요?

## 구두 답변

일반 API role은 RLS가 실제로 적용되는 최소 권한 role로 유지하고, 관리자와 migration은 별도의 실행 identity·승인·감사 경계를 둡니다. PostgreSQL에서는 table owner, `BYPASSRLS` 속성이 있는 role, superuser가 일반 role과 다른 적용 범위를 가질 수 있으므로 “관리자 화면이 필요하다”는 이유로 웹 API 연결 계정에 bypass를 부여하지 않습니다. 먼저 읽기 전용 전체 조회가 정말 필요한지, 특정 tenant만 필요한지, 데이터 수정까지 필요한지를 나누고 짧은 자격과 대상 tenant를 기록합니다.

예를 들어 API는 tenant context를 설정하는 `app_runtime` role을 사용하고, 전체 export는 승인된 job이 제한된 `maintenance_read` identity로 생성한 뒤 결과 파일을 별도 download 권한으로 보호할 수 있습니다. schema migration과 대규모 backfill은 다시 다른 role과 배포 단계로 분리해 구버전 앱이 새 정책과 충돌하지 않는지 dry-run 합니다. bypass를 써도 SQL 자체에 작업 범위·변경량·snapshot·검증 query를 두고, 누가 언제 어떤 정책을 우회했는지 감사합니다. 권한 점검은 CI에서 `pg_roles`와 table owner를 확인하고 실제 SELECT/UPDATE fixture를 실행합니다. 목표 PostgreSQL 버전의 owner·BYPASSRLS 동작은 고정해야 하며, bypass가 애플리케이션 인가와 복구·감사를 대신한다는 결론은 내리지 않습니다.

## 득점 포인트

- API·관리자·migration identity의 권한·수명·감사 경계를 분리합니다.
- owner·BYPASSRLS·superuser 예외와 최소 권한을 설명합니다.
- export·backfill의 승인·범위·dry-run·복구 근거를 제시합니다.

## 감점 포인트

- admin이면 운영 코드 전체가 superuser여도 된다고 합니다.
- bypass가 애플리케이션 인가와 감사를 대신한다고 봅니다.

## 더 파고들 거리

- 전체 tenant export 결과 파일의 다운로드 권한을 어떻게 분리하겠습니까?
- 정책 변경 migration을 구버전 앱과 어떤 순서로 배포하겠습니까?
