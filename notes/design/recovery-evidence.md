---
id: recovery-evidence
title: RPO·RTO·서비스 간 복구 Cut과 격리 훈련
topic: 설계
summary: 백업 생성과 실제 복원을 구분하고 유효 복구 지점·전체 복구 시간·키/권한 장애·서비스 원장 대사·옛 outbox 격리·핵심 흐름 검증을 설명합니다.
questionIds: [backup-restore-rpo-rto, cross-service-backup-cut, restore-drill-data-isolation]
---

# RPO·RTO·서비스 간 복구 Cut과 격리 훈련

## 백업 성공 표시로 실제 복구를 대신할 수 없습니다

backup bytes가 있어도 암호화 key·권한·호환 DB version·WAL 일부가 없으면 복원하지 못할 수 있습니다. **RPO**는 허용 데이터 유실 범위, **RTO**는 정의된 시작점부터 서비스 재개까지 허용 시간입니다. 실제 복원된 최신 유효 변경과 장애 시각을 대조해야 RPO를 알 수 있습니다.

매일 전체 backup만으로 RPO 1시간을 약속할 수 없습니다. 증분/WAL 보관·전송 간격·손상·마지막 유효 위치를 확인합니다. replica는 빠른 failover에 도움되지만 잘못된 삭제도 복제되므로 논리 오류 전 시점 복구를 대체하지 않습니다.

## 복사 시간만 RTO로 세지 않습니다

| 구간 | 포함할 작업 |
| --- | --- |
| 탐지·결정 | 장애 확인·호출·복구 판단 |
| 권한·key | 원본 계정/지역 불능 때 접근 |
| 환경 | infra·DB version·설정·network |
| 복원 | full·증분·WAL·index·검증 |
| 서비스 재개 | DNS·traffic·cache·핵심 쓰기 |
| 후속 대사 | 손상/불확정 데이터 처리 상태 별도 |

측정 시작을 key 승인 뒤로 미루면 오래 걸린 승인 시간을 숨깁니다. 조직이 정의한 장애/복구 개시 기준을 고정하고 실제 구간별 시간을 남깁니다. backup과 key의 장애·삭제 권한을 분리해 원본 계정 상실이 모두를 함께 없애지 않게 합니다.

## 서비스별 같은 시각 문자열이 원자 Cut은 아닙니다

주문 backup이 결제 요청 전 시점이고 결제 backup이 결제 성공 후 시점이면, 두 백업에 기록된 사실의 순서가 서로 맞지 않을 수 있습니다. 따라서 두 시스템의 “둘 다 12시” timestamp만 맞추어서는 인과가 일치했다고 볼 수 없습니다. 가능하면 조정된 snapshot·로그 위치·처리 watermark 중 실제 계약이 있는 기준을 선택하고, 복구 뒤 안정 주문/event ID로 주문·결제·재고·외부 provider의 상태를 대사합니다.

```diagram
{"title":"각 복구 위치에서 공통 업무 관계를 대조합니다","caption":"화살표는 검증 근거입니다. 벽시각 하나가 모든 서비스의 원자 snapshot을 만들지 않으므로 ID·위치·외부 결과로 불일치를 해결합니다.","rows":[[{"id":"orders","label":"주문 snapshot·log 위치"},{"id":"payments","label":"결제 snapshot·log 위치"}],[{"id":"reconcile","label":"주문 ID·event ID·외부 원장 대사"}],[{"id":"verify","label":"참조·잔액·인가·핵심 쓰기 검증"}],[{"id":"open","label":"재개 기준 충족 뒤 traffic 허용"}]],"edges":[{"from":"orders","to":"reconcile","label":"복구한 사실"},{"from":"payments","to":"reconcile","label":"복구한 사실"},{"from":"reconcile","to":"verify","label":"누락·중복·불확정 분리"},{"from":"verify","to":"open","label":"실제 서비스 기준"}]}
```

없는 결제를 새로 실행하거나 고아 주문을 임의 삭제하지 않습니다. 이미 외부에서 성공했는지 조회하고 보정·미확정·수동 확인을 구분합니다. 사용자 서비스 재개와 모든 후속 대사 완료를 별도로 보고합니다.

## Restore 환경이 옛 Mail을 다시 보내지 않게 합니다

실제 backup에는 개인정보·token·과거 outbox·scheduler state가 있으며, 복원하면 이런 데이터가 함께 읽힐 수 있습니다. 그래서 복원 작업을 시작하기 전부터 운영 endpoint·자격·egress를 차단하고, 자동 consumer와 scheduler가 시작되지 않도록 합니다. 외부로 보내는 대신 허용한 합성 sink로 전환한 뒤 필요한 읽기·제한된 쓰기·event 경로를 확인하며, log 수집도 개인정보를 복제하는 경로로 따로 다룹니다.

비식별 합성 데이터 훈련은 절차 검증에 유용하지만 실제 backup의 읽기 가능성·key 접근·무결성을 증명하지는 않습니다. 실제 backup 검사는 통제된 접근·암호화·보관·삭제 환경에서 필요한 범위로 수행해야 합니다.

## 데이터와 사용자 흐름을 함께 검증합니다

건수·checksum뿐 아니라 주문-결제 참조·잔액 원장·현재 권한·새 주문 쓰기·event 발행·복구 후 retry를 확인합니다. 논리 삭제·지역 불능·key 지연·WAL 손상·서로 다른 cut·옛 outbox를 나눠 훈련하고 실패 단계와 실제 RPO/RTO를 기록합니다. 이 노트는 복구 설계이며 실제 운영 backup을 복원한 결과는 아닙니다.
