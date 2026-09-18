---
id: replica-read-contract
title: 읽기 Replica의 적용 위치·본인 쓰기·승격 손실
topic: 데이터베이스
summary: commit·receive·flush·replay를 나누고 최소 읽기 토큰·timeline·bounded 원본 우회·긴 조회 충돌·승격 뒤 불확정 효과를 설명합니다.
questionIds: [db-read-replica-consistency, db-read-your-writes-token, replica-long-query-replay-conflict, replica-promotion-uncertain-write]
---

# 읽기 Replica의 적용 위치·본인 쓰기·승격 손실

## 저장 성공과 Replica 조회 시점의 구분

Replica 읽기 설계는 “얼마나 최신이어야 하는가”를 요청 종류별 계약으로 바꾸는 일입니다. 일반 목록은 stale read를 허용할 수 있지만, 방금 변경한 결제 상태나 현재 권한 판정은 최소 반영 위치 또는 원본 읽기가 필요할 수 있습니다.

원본이 프로필 version=8을 커밋해 성공을 반환했지만 replica는 아직 version=7을 적용 중일 수 있습니다. 다음 새로고침이 replica로 가면 옛값이 보입니다. 이는 replica 지연의 관찰 계약이며 저장 실패와 같지 않습니다. 같은 DB 노드 안의 transaction snapshot이 옛값을 유지하는 문제와도 구분합니다.

저장 응답의 최신값을 화면에 보이는 것은 UX를 돕지만 그 뒤 권위 조회가 같은 변경을 확인했다는 보장은 아닙니다. 기능별로 본인 쓰기 관찰·일반 stale read·강한 현재 인가를 나누어 설계합니다.

## 로그 수신 위치와 실제 적용 위치의 구분

| 위치 | 예 | 의미 |
| --- | --- | --- |
| 원본 commit 포함 지점 | 요구 115 | 읽기가 최소 포함해야 할 쓰기 |
| replica receive | 120 | 로그를 받음 |
| replica replay/apply | 110 | 실제 읽기 상태에 아직 115가 없음 |

쓰기 응답 토큰은 실제 커밋을 포함하는 최소 위치 또는 그것을 안전하게 상계한 검증된 지점이어야 합니다. 단순 임의 현재 숫자나 클라이언트 시간이 아닙니다. PostgreSQL WAL LSN·timeline, MySQL GTID·binlog, SQL Server의 복제 위치는 비교·진행 의미가 다릅니다.

```diagram
{"title":"최소 반영 위치에 도달한 Replica에서 읽습니다","caption":"화살표는 읽기 라우팅입니다. 로그 수신만으로 통과시키지 않고 같은 클러스터·로그 계통의 실제 적용 위치를 확인합니다.","rows":[[{"id":"token","label":"쓰기 후 요구 위치 115"}],[{"id":"replica","label":"Replica 적용 위치 110"}],[{"id":"wait","label":"기한 안 대기·다른 경로"}],[{"id":"read","label":"115 이상 적용 뒤 읽기"}]],"edges":[{"from":"token","to":"replica","label":"현재 위치 비교"},{"from":"replica","to":"wait","label":"조건 미충족"},{"from":"wait","to":"read","label":"적용·예산 확인"}]}
```

여러 replica를 번갈아 쓰는 세션에는 이미 확인한 최소 버전을 유지해 역행을 줄일 수 있습니다. 하지만 토큰만으로 모든 사용자에 대한 전역 선형화가 되는 것은 아닙니다. 이미 오래 열린 snapshot 안의 읽기는 replica가 replay를 따라잡아도 옛 snapshot을 볼 수 있어 읽기 transaction의 시작 경계도 맞춰야 합니다.

## 조건 미충족 시 대기·우회 예산

기한 안에서 replica catch-up을 기다리거나 원본으로 우회할 수 있습니다. “쓰기 후 5초간 원본” 같은 시간 고정은 lag가 더 길어질 수 있어 엄격한 보장이 아닙니다. 원본 우회도 전체 요청을 한꺼번에 보내면 원본이 포화될 수 있으므로 중요한 화면·동시성·대기·실패 정책을 정합니다.

클라이언트 토큰은 형식·cluster·epoch·scope·만료·서명 등 정책으로 검증하고 터무니없이 큰 위치를 요구해 무한 대기를 만들지 못하게 합니다. 조회 인가와 토큰 무결성은 별도입니다. 토큰이 없거나 다른 기기로 이동한 경우의 보장도 명시합니다.

실무에서는 `read_requirement`를 `eventual`, `after_write(token)`, `authoritative_now`처럼 요청에 붙이고 라우터가 임의로 downgrade하지 않게 합니다. 토큰을 만족할 후보가 없으면 제한 시간 뒤 `stale_not_allowed`나 원본 우회로 명시적으로 실패해야 하며, 빈 결과를 정상적인 “데이터 없음”으로 바꾸면 지연 장애가 숨겨집니다.

## 긴 Replica 조회와 Replay·원본 정리 비용

replica의 오래된 snapshot이 필요한 버전과 원본 cleanup·DDL 재생이 충돌할 수 있습니다. PostgreSQL standby는 설정에 따라 query를 취소하거나 replay를 기다릴 수 있고 hot_standby_feedback은 원본의 cleanup을 늦춰 bloat를 늘릴 수 있습니다. 모든 충돌을 feedback 하나로 해결하는 것은 아닙니다.

다른 DB의 undo·version·redo 충돌은 제품별로 확인합니다. 보고서를 별도 분석 저장소로 옮기거나 snapshot을 짧게 하는 선택은 최신성·일관성·복사 비용을 바꿉니다. replica query 취소율·replay 위치·원본 최장 transaction·보유 버전·디스크를 함께 관찰합니다.

## 승격 뒤 성공 응답 쓰기의 존속 불확실성

비동기 복제에서 원본이 성공 응답한 로그를 새 leader가 확보하지 못하면 승격 뒤 그 쓰기가 사라질 수 있습니다. 반대로 replica가 아직 replay하지 않았더라도 로그를 수신·내구화했고 승격 전에 그 로그를 적용할 수 있는 구조라면 반드시 손실이라고 단정할 수 없으므로, 제품의 실제 복구 프로토콜에서 수신 위치·내구 위치·승격 전 적용 여부·재생 순서를 확인해야 합니다.

손실된 쓰기와 dedupe 레코드가 같은 복제 범위에 있으면 둘 다 없어질 수 있습니다. 사용자가 다시 요청할 때 외부 결제는 이미 성공했을 수 있어 외부 제공자의 논리 키·내구 원장·클라이언트 성공 기록과 대사가 필요합니다. 어떤 손실도 자동 복구한다고 약속하지 않고 RPO·동기 복제 비용·승격 정책을 정합니다.

failover 뒤 같은 숫자가 다른 로그 계통을 뜻할 수 있으므로 old token을 새 timeline과 직접 숫자 비교하지 않습니다. 영원히 만족할 수 없는 토큰은 무한 대기 대신 명시적 불확정·복구 경로로 처리합니다. 옛 원본의 쓰기는 fencing과 라우팅·자격 경계에서 막아야 합니다.

## 저장·재조회 Timeline 실험

테스트에서는 저장 직후 같은 세션에서 replica로 읽고, receive 위치와 replay 위치가 다를 때 어떤 값을 보는지 기록합니다. 느린 보고서가 원본 cleanup과 충돌하는 경우, 원본 우회가 몰려 포화되는 경우, 승격 뒤 old token을 보내는 경우를 각각 재현해 조회 결과·취소·대기·라우팅을 확인합니다. 성공 응답된 쓰기와 응답 불확실 요청을 구분해 최종 원장·버전·사용자 결과를 비교하며, 현재 작업에서는 실제 복제·승격을 실행하지 않았으므로 본문은 관찰·보존 범위의 설계입니다.

예상 결과는 commit 위치 115, receive 120, replay 110인 replica에서 `after_write(115)`가 즉시 성공하지 않고 대기·우회 중 하나를 택하는 것입니다. 승격으로 timeline이 바뀌면 숫자 115만 비교하지 않고 epoch와 복구 상태를 먼저 검사하며, 응답 유실 요청은 원장·멱등 기록과 대조해 `확정` 또는 `불확정`으로 남겨야 합니다.
