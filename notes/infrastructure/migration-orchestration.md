---
id: migration-orchestration
title: GitOps Hook의 배포 순서와 Migration 소유권
topic: 인프라
summary: phase·wave와 데이터 호환성을 구분하고 확장·백필·전환·축소·공유 DB 조정·재실행 원장·hook 증거 보존을 설명합니다.
questionIds: [argocd-sync-waves-hooks, shared-db-migration-owner, gitops-hook-evidence-retention]
---

# GitOps Hook의 배포 순서와 Migration 소유권

## Hook 실행 순서와 DB 호환성

새 앱이 새 컬럼을 읽어야 하므로 migration Job을 먼저 실행한다고 합시다. 컬럼 추가는 구 앱과 공존할 수 있지만 옛 컬럼 삭제나 값 형식의 파괴적 변환은 아직 실행 중인 구 앱을 깨뜨릴 수 있습니다. Argo CD의 순서 제어와 DB 호환성은 별도입니다.

예를 들어 같은 Application에서 migration Job을 `PreSync`에, 앱 Deployment를 `Sync`에 연결했다면 실제 배포 기록에서 Job이 완료된 뒤 Deployment가 적용되는지 먼저 대조합니다. `PreSync`·`Sync`·`PostSync` 같은 phase와 wave뿐 아니라 리소스 종류·이름과 health 처리의 정확한 정렬 순서, 선택적 sync에서 hook이 실행되는지를 사용 버전·운영 방식의 규칙과 배포 결과로 확인합니다.

서로 다른 Application의 wave 숫자만으로 전역 DB 순서가 생기지는 않으므로, 공유 DB는 별도 실행 조정 없이는 순서를 보장하지 않습니다.

배포 도구의 실행 순서는 애플리케이션이 혼합 버전으로 실행되는 동안에도 데이터가 호환된다는 사실을 대신 보장하지 않습니다. migration은 스키마 확장, 데이터 준비, 읽기·쓰기 전환, 축소를 서로 다른 완료 조건으로 나누고 각 조건의 증거를 남겨야 합니다.

배포 중 실제 상태를 `schema=expanded, backfill=40%, app={old,new}, readMode=old`처럼 분리해 기록하면 hook 성공을 과대해석하기 어렵습니다. DDL 커밋 뒤 Job 응답이 끊긴 경우 다음 실행은 Job Pod의 종료 코드가 아니라 schema 원장과 실제 컬럼·제약을 대조해야 합니다. 연습에서는 백필 40%에서 중단하고 sync controller를 재시작해 checkpoint 뒤 범위만 처리하되 경계 행이 중복·누락되지 않는지 확인합니다. hook이 성공했어도 백필 완료 증거가 없으면 전환 단계로 이동시키지 않습니다.

## 확장·백필·전환·축소와 혼합 버전 구간

| 단계 | DB·앱 상태 | 다음 단계의 근거 |
| --- | --- | --- |
| 확장 | 옛 코드가 읽고 쓸 수 있는 새 구조 추가 | 호환 DDL 완료 |
| 백필 | 새 구조의 과거 데이터를 채움 | 범위·버전·누락 검증 |
| 전환 | 새 읽기·쓰기 경로 점진 적용 | 구·신 경로 결과 일치 |
| 옛 경로 종료 | 배치·ETL·관리 SQL까지 사용 중단 | 모든 소비자 확인 |
| 축소 | 더 이상 쓰지 않는 구조 제거 | 별도 승인·복구 경계 |

백필 대상이 많다면 짧은 PreSync Job이 한 번에 모든 행을 처리하지 않도록 구조 준비와 대량 이관을 별도 내구 작업으로 나눕니다. 이관 작업은 처리한 범위와 행 버전 기준을 checkpoint에 기록하고, 중단되면 그 기록을 기준으로 재개하되 경계에서 중복·누락이 없는지 검증합니다. 종료 조건에서는 대상 범위와 처리 결과를 대조해 누락을 찾고, sync를 오래 붙잡는 시간과 재시도 부하를 줄이되 hook 성공이 DDL 존재까지만 증명한다면 백필 검증 완료로 보고하지 않습니다.

```diagram
{"title":"배포의 단계 완료와 데이터의 준비를 연결합니다","caption":"화살표는 전환 조건입니다. 실패하면 다음 단계를 막지만 이미 커밋된 DB 변경을 자동으로 되돌리는 것은 아닙니다.","rows":[[{"id":"expand","label":"호환 스키마 확장"}],[{"id":"backfill","label":"재개 가능한 백필·검증"}],[{"id":"switch","label":"구·신 앱 공존·읽기 전환"}],[{"id":"contract","label":"옛 경로 종료 후 축소"}]],"edges":[{"from":"expand","to":"backfill","label":"구조 준비"},{"from":"backfill","to":"switch","label":"데이터 조건 충족"},{"from":"switch","to":"contract","label":"모든 소비자 전환"}]}
```

## 공유 DB Migration과 앱별 Hook의 실행 책임

여러 앱이 같은 migration을 자기 PreSync에서 동시에 실행하면 충돌·중복·부분 변경이 생길 수 있습니다. migration 버전 원장과 단일 실행 조정자를 두고 DB가 지원하는 잠금·조건 전진을 사용합니다. 잠금은 중복 실행을 줄이지만 구 앱 호환성을 만들어 주지는 않습니다.

웹 앱 외에 배치·관리 SQL·ETL·오래된 worker까지 스키마 소비자를 조사합니다. 한 앱의 rollback이 다른 앱이 이미 요구하는 새 컬럼을 삭제하면 안 됩니다. 정상적인 앱 rollback에서는 호환 확장 구조를 남겨 두고, 데이터 역변환이 필요하면 독립 복구 절차로 다룹니다.

## Hook 재실행과 실제 DB 상태 판정

Job이 DDL을 커밋한 뒤 응답·상태 반영 전에 중단될 수 있습니다. 다음 실행은 원장을 확인하고 이미 적용된 단계면 결과를 재사용해야 합니다. `IF NOT EXISTS`만으로 잘못된 기존 스키마까지 올바르다고 보지 말고 컬럼 타입·제약·버전을 대조합니다. DDL transaction·lock·재시도 의미는 DB 제품별로 다릅니다.

PreSync 실패로 새 앱 적용을 막아도 DB 일부 변경은 이미 남을 수 있습니다. 상태를 조사해 재개·보정·수동 복구를 선택합니다. app revision과 schema version·backfill 위치·read mode를 함께 기록해야 재시작 후 판단이 가능합니다.

## Hook 실행 증거와 Pod 삭제 이후 보존

hook execution ID·Git revision·이미지 digest·migration version·시작/종료·오류·실제 DB 결과를 연결합니다. hook-delete-policy나 TTL로 Job·Pod를 삭제해도 필요한 감사·진단 기록과 원장은 별도 내구 저장소에 남깁니다. 로그에는 비밀·원문 데이터 대신 단계·오류 코드·추적 ID를 기록합니다.

외부 로그 sink가 실패했을 때도 migration의 성공 여부는 DB 원장에서 판별할 수 있어야 합니다. 반대로 원장에 started만 있다고 성공이나 미실행으로 단정하지 않습니다. 외부 효과·DB 현재 상태를 대사합니다. 관측 기록과 실행 권위는 각각의 책임입니다.

## 부분 성공과 앱별 Rollback 조합 시험

완료된 hook 재실행, DDL 커밋 후 연결 유실, 일부 백필 중단, 두 앱 동시 배포, 한 앱만 rollback, hook Pod 삭제와 controller 재시작을 테스트합니다. sync 표시뿐 아니라 실제 schema·행 불변식·구·신 앱 요청·쿼리 부하를 봅니다.

현재 작업에서는 Argo CD hook이나 DB migration을 실행하지 않았습니다. 이 노트는 배포 조정의 설계이며 제품별 DDL·백필 검증은 별도입니다.
