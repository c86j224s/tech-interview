---
id: search-publication
title: Elasticsearch 검색 가시성과 Reindex 전환
topic: 데이터베이스
summary: 색인 ACK·ID GET·refresh·flush를 나누고 wait_for·segment 비용·동시 재색인·삭제·원자 alias·역전환의 한계를 설명합니다.
questionIds: [elasticsearch-refresh-visibility, elasticsearch-get-search-readback, elasticsearch-wait-for-refresh-cost, elasticsearch-alias-reindex-cutover]
---

# Elasticsearch 검색 가시성과 Reindex 전환

검색 시스템에서 저장 성공, 알려진 ID 조회, 일반 검색 노출은 서로 다른 관찰 경계입니다. Reindex도 문서를 새 index로 옮기는 스캔과 그동안 생긴 변경을 따라잡는 과정이 분리됩니다. 따라서 먼저 원본 권위와 허용할 가시성 지연을 정하고, 각 경계의 증거를 같은 문서 ID와 version으로 연결해야 안전한 alias 전환을 설명할 수 있습니다.

## 색인 ACK·ID GET·검색 가시성 지연

예를 들어 10:00:00에 색인 ACK가 왔고 같은 시각 realtime GET은 version 8을 반환하지만 search는 version 7만 반환할 수 있습니다. 이때 바로 문서 유실로 결론내리지 말고 대상 index·routing·refresh 경계를 맞춘 뒤 다음 관측에서 search version이 8로 바뀌는지 확인합니다. DB commit 이전에 outbox가 멈췄다면 refresh를 반복해도 검색은 바뀌지 않는다는 점이 중요한 진단 분기입니다.

문서 저장 ACK는 색인 요청이 처리됐다는 응답이고, 검색 reader가 새 segment를 읽기 시작하는 시점은 그 뒤일 수 있습니다. 그래서 같은 문서라도 저장 직후에는 알려진 ID의 GET이 새 값을 보여 줄 수 있지만 일반 search에는 아직 없을 수 있습니다.

장애를 좁힐 때는 먼저 GET과 search가 같은 대상 index와 문서 ID를 기준으로 비교되는지 맞추고, version은 각 API가 반환하는 메타데이터나 문서에 저장한 version을 별도로 대조하며, routing(문서를 어느 shard로 보낼지 정하는 값)과 GET의 realtime 옵션은 각 API 계약에 맞게 실제 요청에 적용됐는지 확인합니다.

원본 DB가 따로 있으면 DB commit→outbox·CDC→Elasticsearch 색인→refresh→검색이라는 지연이 더해집니다. 검색에 없다는 증상에서 어느 단계가 아직 완료되지 않았는지 나눠야 합니다.

## Refresh와 내구 Flush의 책임 분리

| 사건·옵션 | 주된 의미 | 주의점 |
| --- | --- | --- |
| 색인 ACK | 해당 쓰기 처리·복제 정책의 응답 | 모든 검색의 즉시 노출 아님 |
| realtime ID GET | 알려진 문서 확인 | 일반 search와 다른 경로 |
| refresh=false·기본 | 즉시 refresh를 요청하지 않음 | 검색 노출 대기 |
| refresh=wait_for | 변경이 검색에 보일 때까지 대기 | 기한·listener·refresh 설정 |
| refresh=true·강제 | 관련 shard refresh를 앞당김 | 작은 segment·merge·I/O 비용 |
| flush·translog 내구 | 복구를 위한 저장 경계 | refresh와 동일하지 않음 |

refresh는 검색 리더 공개이고 디스크 crash durability를 모두 보장하는 신호가 아닙니다. translog fsync·replica 응답·shard 복구는 해당 버전·설정에서 별도로 확인합니다.

```diagram
{"title":"저장과 검색과 복구의 확인 시점을 나눕니다","caption":"화살표는 검색 가시성의 경로입니다. realtime GET과 내구 flush의 보장은 이 그림의 refresh와 다른 계약입니다.","rows":[[{"id":"source","label":"원본 DB commit·이벤트"}],[{"id":"index","label":"문서 색인·ACK"}],[{"id":"refresh","label":"refresh로 reader 갱신"}],[{"id":"search","label":"검색 결과에서 관찰"}]],"edges":[{"from":"source","to":"index","label":"비동기 색인"},{"from":"index","to":"refresh","label":"가시성 대기"},{"from":"refresh","to":"search","label":"새 검색 reader"}]}
```

## 즉시 검색 확인과 Refresh 비용

저장 직후 편집 화면이 같은 문서를 보여 주는 것이 목적이면 저장 응답이나 알려진 ID의 GET으로 확인하고, 검색 필터에 바로 포함되어야 하는 요청에만 wait_for를 붙이는 식으로 요구를 나눕니다. wait_for는 보통 다음 refresh까지 기다리는 방식이라 매번 refresh=true를 강제하는 비용을 줄일 수 있지만, listener 한도 같은 조건에서는 강제 refresh가 발생할 수 있습니다.

refresh가 비활성화된 구성에서는 기다림이 길어질 수 있으므로, 요청 timeout을 검색 실패로 단정하지 말고 해당 버전·설정의 대기 계약과 문서 ID·source version을 함께 확인합니다.

모든 쓰기에 강제 refresh를 적용하면 작은 segment·후속 merge·검색·색인 I/O 비용이 늘 수 있습니다. bulk 요청의 batch·동시성·visibility SLO·색인 처리량을 같이 비교합니다. timeout은 색인이 없다는 증명이 아니므로 같은 문서 ID·source version으로 결과를 확인합니다.

## Reindex 완료와 동시 변경 반영 범위

선택 기준은 검색 지연 SLO와 색인 처리량을 함께 보는 것입니다. 편집 직후 같은 문서를 보여 주는 화면은 ID GET이 더 적합할 수 있고, 목록 필터에 즉시 반영해야 하는 경우에만 wait_for를 선택하며, 대량 적재 전체에 강제 refresh를 붙이지 않습니다. 장애 시에는 스캔 완료 여부, delta 위치, 삭제 tombstone, alias 대상, 직접 index 이름을 쓰는 client를 순서대로 확인합니다.

mapping을 바꾸려고 새 index를 만들고 reindex(기존 문서를 새 index로 복사하는 작업)하는 동안에도 old index나 원본 DB에는 write와 delete가 계속 들어올 수 있습니다. 먼저 reindex가 읽을 기준 snapshot(한 시점에 고정한 원본 상태)을 정하고, 그 snapshot을 읽은 뒤 발생한 변경을 식별할 위치를 확보해 새 index에 빠짐없이 이어서 적용해야 합니다.

reindex 작업이 ‘완료’로 끝났다는 것은 스캔 범위가 끝났다는 뜻일 뿐이므로, 그 뒤의 변경·삭제까지 반영했는지 확인하기 전에 alias를 전환하면 누락이 생깁니다.

늦은 snapshot 문서가 더 최신 delta 적용을 덮지 않도록 source version·계산 버전을 검증합니다. Elasticsearch의 외부 version 사용·sequence number/primary term 조건은 서로 다른 기능이므로 채택 API의 정확한 계약에 맞춥니다. 단순 dual-write는 한쪽 성공·다른 쪽 실패의 복구 기록이 필요합니다. outbox·CDC로 재생할 수 있는 원본 권위를 두면 대사가 쉬워집니다.

## Alias 원자 전환과 데이터 동기화

old/new alias 제거·추가를 지원되는 단일 atomic alias 요청으로 묶을 수 있습니다. 그러나 이 원자성은 라우팅 metadata 변경 범위이며 모든 진행 중 검색·writer·DB transaction을 하나로 고정하지 않습니다. read alias·write alias·is_write_index·직접 index 이름을 쓰는 client를 확인하고 최종 변경 장벽을 정합니다.

건수뿐 아니라 문서 version·삭제 tombstone·대표 검색·정렬·집계·권한 필터를 대조합니다. 같은 건수여도 내용이 다를 수 있습니다. 새 index에 정상 쓰기가 들어온 뒤 old로 되돌리면 그 변경을 잃을 수 있어 역동기화·재생·rollback 창이 필요합니다. old index 삭제는 참조·보관·복구를 확인한 별도 승인 행동입니다.

## 관측 지연과 결과 정합성의 분리 시험

색인 ACK 직후 GET·search를 비교하고 기본 refresh·wait_for·강제 refresh의 노출 지연·segment·merge·p99를 측정합니다. reindex에서는 스캔 중 write·delete·늦은 backfill·alias 전환·old writer·역전환을 주입합니다.

현재 작업에서는 Elasticsearch 색인·refresh·reindex를 실행하지 않았습니다. 본문은 검색 공개와 전환의 설계이며 실제 가시성 지연이나 무중단 재색인 결과가 아닙니다.
