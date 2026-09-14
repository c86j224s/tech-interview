---
id: projection-maintenance
title: 읽기 모델의 원본·Delta·재구축·Refresh
topic: 데이터베이스
summary: 현재 복사본과 역사 사실을 구분하고 snapshot·증분 이벤트의 버전 규칙·선택 재구축·삭제·계산 버전·materialized view 신선도를 설명합니다.
questionIds: [denormalization-maintenance, projection-snapshot-versus-delta-version, projection-selective-rebuild, db-materialized-view-refresh]
---

# 읽기 모델의 원본·Delta·재구축·Refresh

## 같은 상품명도 현재값과 주문 당시 사실은 다릅니다

주문 당시 가격·상품명은 과거 계약의 사실일 수 있으므로 현재 카탈로그 변경으로 덮어쓰면 안 됩니다. 반면 목록에 현재 상품명을 빨리 보여 주려고 복사한 값은 재생성 가능한 projection입니다. 원본·현재 복사본·역사 snapshot을 같은 컬럼 의미로 섞지 않습니다.

파생 합계도 할인·세금·환불·반올림·계산 규칙 버전이 필요합니다. 조회가 빨라졌다는 사실만으로 원본과 자동 동기화되지는 않습니다. 동일 DB transaction에서 원본과 요약을 같이 바꿀지, 이벤트로 비동기 갱신해 지연을 허용할지 정합니다.

## 전체 Snapshot과 Delta는 늦은 이벤트 처리법이 다릅니다

| 이벤트 | 예 | 낮은 version 도착 시 |
| --- | --- | --- |
| 전체 상태 | v12의 total=150, 이전 변경 모두 포함 | v11 전체 상태는 건너뛸 수 있음 |
| 증분 | v11 +10, v12 +20 | v12 뒤 v11을 버리면 +10 유실 |
| 삭제·정정 | delete v13, refund event | tombstone·중복·후속 재생 규칙 필요 |

전체 상태가 모든 이전 변경을 포함한다는 계약이 있어야 “더 큰 version만 적용”이 안전합니다. 다른 필드의 부분 snapshot을 전체 상태처럼 취급하면 누락됩니다. delta는 event ID 중복 제거·연속 sequence·갭 대기 또는 snapshot 재동기화가 필요합니다. 교환 가능한 덧셈이어도 중복·누락 방지는 남고 잔액 음수 금지 같은 중간 상태 조건은 순서에 영향을 받습니다.

```diagram
{"title":"이벤트 형태에 맞는 적용 조건을 사용합니다","caption":"화살표는 적용 전략의 분기입니다. 최신 version 하나만 남기는 규칙은 모든 delta 합계에 사용할 수 없습니다.","rows":[[{"id":"event","label":"원본 변경 이벤트"}],[{"id":"snapshot","label":"완전한 상태 snapshot"},{"id":"delta","label":"증분·부분 변경"}],[{"id":"replace","label":"원자 max-version 교체"},{"id":"sequence","label":"event 중복·순서·갭 검사"}]],"edges":[{"from":"event","to":"snapshot","label":"이전 상태 포함"},{"from":"event","to":"delta","label":"이전 효과 필요"},{"from":"snapshot","to":"replace","label":"낡은 전체값 거절"},{"from":"delta","to":"sequence","label":"필요 변화 보존"}]}
```

중복 처리 마커와 projection 변경도 같은 거래 또는 검증된 원자 경계에 둡니다. 마커만 먼저 기록하면 효과 누락, 변경만 먼저 하면 중복 적용이 생깁니다. outbox·CDC는 발행 누락을 줄이는 경로이지 소비자의 이 경계를 대신하지 않습니다.

## 선택 재구축도 현재 이벤트와 경쟁하는 Writer입니다

원본 version 10을 읽어 요약을 계산하는 동안 실시간 이벤트가 projection을 12로 바꿀 수 있습니다. 늦은 rebuild가 무조건 10을 저장하면 상태가 역행합니다. source version·계산 규칙 버전·현재 projection 세대를 비교해 게시하고, 갱신 중 새 이벤트를 놓치지 않게 snapshot 기준과 이후 로그 위치를 연결합니다.

전수 삭제 후 재생성만이 방법은 아닙니다. 원본·요약의 행 수·합계·정규화한 해시·관계를 비교해 차이 있는 키 범위를 다시 계산할 수 있습니다. 대조도 같은 기준 version에서 해야 정상 동시 변경을 오류로 오인하지 않습니다. hash 일치는 유용한 신호지만 충돌·빠진 의미를 고려해 필요한 상세 검증을 둡니다.

삭제는 값 없음만으로 표현하면 옛 이벤트가 다시 살릴 수 있어 tombstone·삭제 version의 보관 기간을 설계합니다. 환불·소급 정정·계산식 변경도 재생성 대상이며, 옛 계산 버전 결과가 새 규칙을 덮지 않게 합니다.

## Materialized View는 결과 저장과 갱신 정책입니다

일반 view는 질의 정의를 저장하고 materialized view는 계산 결과를 저장해 재사용합니다. 지원되는 전체·증분·동기 갱신 방식은 엔진마다 다릅니다. PostgreSQL materialized view refresh와 SQL Server indexed view 등은 같은 주기 갱신 모델로 일반화하지 않습니다.

주기 5분인데 refresh 자체가 10분 걸리면 5분 신선도를 보장하지 못합니다. 계산 snapshot 시각·완료·게시 시각을 구분하고 겹친 refresh의 단일 소유·실패·최신 게시를 정합니다. concurrent 옵션도 인덱스 조건·잠금·임시 공간·원본 I/O를 없애지 않습니다.

## 낡은 결과를 허용할 기능과 원본 확인 기능을 나눕니다

대시보드는 as-of 시각과 허용 stale을 보여 주고 실패 시 이전 완성 버전을 유지할 수 있습니다. 결제·재고 확정은 낡은 요약만 보고 승인하지 않고 원본의 현재 조건을 다시 확인합니다. 중간 refresh가 일부 행만 새 값으로 보이는지 또는 완성 버전만 게시하는지도 명시합니다.

갱신 CPU·I/O·원본 쓰기 지연·로그·복제 비용을 읽기 p99와 함께 측정합니다. 실제 원본 JOIN이 병목인지 확인하기 전에 복사본을 늘리면 운영 책임만 추가될 수 있습니다.

## 재생·순서 역전·삭제와 Rebuild 경쟁을 확인합니다

합성 원본에서 v12→v11 snapshot, delta 순서 역전·중복·갭, delete 후 옛 이벤트, 재구축 중 새 변경을 시험합니다. 최종 합계·행 관계·적용 version이 원본 계산과 일치해야 합니다. 현재 작업에서는 실제 materialized view·CDC·projection 재구축을 실행하지 않았습니다. 본문은 적용·신선도 계약의 설명입니다.
