---
id: postgres-retention
title: PostgreSQL Vacuum과 CDC의 보존 경계
topic: 데이터베이스
summary: 튜플 재사용·파일 축소·visibility·freeze와 WAL 보존을 구분하고 긴 snapshot·slot·CDC 재개·디스크 잔여 시간·재구축을 설명합니다.
questionIds: [db-postgres-vacuum, db-cdc-log-retention]
---

# PostgreSQL Vacuum과 CDC의 보존 경계

## DELETE는 모든 독자에게 즉시 물리 삭제를 뜻하지 않습니다

`DELETE`나 `UPDATE`가 실행돼도 이전 snapshot을 가진 독자가 옛 `tuple`(테이블의 한 행 버전)을 볼 수 있으므로, 더 이상 현재 행으로 사용되지 않는 `dead tuple`도 곧바로 지워지지 않습니다. 모든 관련 독자가 더 이상 필요로 하지 않는 시점에야 PostgreSQL이 dead tuple을 정리할 수 있고, `VACUUM`은 이 정리와 인덱스 정리·공간 재사용·visibility·freeze에 관여합니다.

일반 `VACUUM`이 빈 공간을 다시 쓸 수 있게 하는 것과 테이블 파일 크기를 OS에 돌려주는 것은 다른 일이며, 끝의 빈 페이지를 줄이는 경우에도 모든 `bloat`가 사라진다고 보장하지 않습니다. `VACUUM FULL`은 테이블을 다시 쓰는 별도 작업이라 더 강한 잠금·추가 공간·I/O 비용을 감수해야 합니다.

## 무엇이 정리의 최저 위치를 붙잡는지 봅니다

| 보존 대상 | 붙잡을 수 있는 원인 | 관측 |
| --- | --- | --- |
| 옛 heap tuple | 긴 snapshot·transaction·feedback 등 | backend xmin·최장 거래·dead tuple 추정 |
| catalog 또는 tuple 정리 경계 | logical slot의 xmin·catalog_xmin 등 | slot 상태·소유 connector |
| WAL 파일 | slot 재개 위치·archive·복제·백업 | restart_lsn·보존 바이트·디스크 |
| 실제 테이블 파일 | 재사용 가능 빈 공간·bloat | relation 크기·읽기·재작성 필요성 |

모든 slot이 같은 방식으로 모든 heap 정리를 막는다고 일반화하지 않습니다. WAL 보존 위치와 tuple 가시성 경계를 각각 봅니다. dead tuple 지표도 추정치일 수 있어 단일 값으로 강한 정리를 결정하지 않습니다.

```diagram
{"title":"소비와 읽기의 지연은 서로 다른 저장 비용을 남깁니다","caption":"화살표는 보존 의존 관계입니다. 긴 snapshot은 필요한 옛 버전을, CDC 재개 위치는 필요한 로그를 유지하게 할 수 있으며 둘은 같은 파일 공간이 아닙니다.","rows":[[{"id":"reader","label":"오래된 snapshot 독자"},{"id":"cdc","label":"중단된 CDC 소비자"}],[{"id":"tuple","label":"옛 tuple 정리 지연"},{"id":"wal","label":"WAL 보존 증가"}],[{"id":"budget","label":"원본 공간·I/O·복구 예산"}]],"edges":[{"from":"reader","to":"tuple","label":"가시성 필요"},{"from":"cdc","to":"wal","label":"재개 로그 필요"},{"from":"tuple","to":"budget","label":"bloat·scan 비용"},{"from":"wal","to":"budget","label":"로그 디스크 비용"}]}
```

## Visibility와 Freeze는 파일 축소와 다른 이유로 필요합니다

visibility map의 all-visible 상태는 index-only scan에서 heap fetch를 줄이는 데 도움될 수 있습니다. 최근 쓰기가 많으면 그 조건이 달라져 동일 covering index에서도 heap 접근이 증가합니다. VACUUM의 transaction ID freeze는 wraparound 예방과 관련되며 단순히 파일을 작게 만드는 작업과 다릅니다.

autovacuum을 끄면 당장 I/O가 줄어 보일 수 있어도 정리·freeze 부채가 커집니다. 테이블별 크기·변경률·threshold·scale factor·worker 지연·I/O 예산과 오래된 독자를 함께 봅니다. 주기만 공격적으로 줄여 원인을 해결하지 못하면 사용자 쓰기와 경쟁할 수 있습니다.

## 중단된 CDC의 비용은 건수보다 로그 바이트로 계산합니다

초당 20MB의 WAL이 한 시간 쌓이면 `20×3,600=72,000MB`가 생성되므로, CDC 소비자가 멈춘 시간은 행 수보다 로그 바이트로 계산하는 편이 직관적입니다. 실제로 디스크에 남는 양은 이미 정리 가능한 위치·checkpoint·압축·다른 보존 요구에 따라 달라지며, 남은 36,000MB에서 순증가 20MB/s라면 약 30분이라는 대응 예산을 추정할 수 있지만 증가율 변화를 위한 여유가 필요합니다.

논리 replication slot은 CDC가 재개할 로그 위치를 붙잡는 상태이고, `restart_lsn`은 그 재개에 필요한 WAL의 시작 위치를 나타냅니다. 활성 여부·확인 위치·실제 보존량·connector 처리율·가장 오래된 미적용 사건을 함께 보고, 로그 수신·이벤트 처리·checkpoint 저장을 한 완료로 세지 않습니다. 보존 상한을 넘어 로그가 사라지면 connector가 옛 위치에서 바로 재개하지 못하고 새 snapshot이 필요할 수 있습니다.

## Slot 삭제나 로그 제거는 재개 계약을 바꿉니다

소유자가 없는 slot은 정리 대상일 수 있지만 실제 connector·복구 요구를 확인하지 않고 삭제하면 재개 지점을 잃습니다. WAL 파일을 직접 임의 삭제하는 것은 안전한 정상 정리가 아닙니다. 디스크 대응은 생성률 제한·소비 복구·용량 확보·승인된 slot 처리와 재구축 계획을 함께 검토합니다.

새 snapshot으로 돌아갈 때도 snapshot 기준과 이후 변경 로그를 빠짐없이 이어야 합니다. 재구축 중 새 write·delete를 놓치지 않고 event ID·원본 버전으로 중복을 처리합니다. 복구 소비를 무한히 빠르게 돌려 원본·대상 DB를 다시 포화시키지 않게 예산을 둡니다.

## 읽기와 소비를 각각 멈춰 비교합니다

격리 PostgreSQL에서 긴 snapshot을 유지하며 DELETE·VACUUM하고, 별도로 CDC connector를 멈춰 WAL 보존을 관찰합니다. 독자 종료 뒤 재사용 공간·Heap Fetches와 connector 재개 뒤 보존 위치가 어떻게 변하는지 봅니다. 테이블 크기·WAL·RSS는 별도 지표입니다.

현재 작업에서는 PostgreSQL VACUUM·slot·CDC를 실행하지 않았습니다. 본문은 보존 경계와 대응 설계이며 제품별 옵션·버전의 실제 결과는 별도 검증해야 합니다.
