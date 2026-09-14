---
id: search-publication
title: Elasticsearch 검색 가시성과 Reindex 전환
topic: 데이터베이스
summary: 색인 ACK·ID GET·refresh·flush를 나누고 wait_for·segment 비용·동시 재색인·삭제·원자 alias·역전환의 한계를 설명합니다.
questionIds: [elasticsearch-refresh-visibility, elasticsearch-get-search-readback, elasticsearch-wait-for-refresh-cost, elasticsearch-alias-reindex-cutover]
---

# Elasticsearch 검색 가시성과 Reindex 전환

## 색인 성공 직후 검색에 없다고 저장 실패는 아닐 수 있습니다

문서 저장 ACK와 검색 reader가 새 segment를 보는 refresh 시점은 다를 수 있습니다. 알려진 ID의 GET은 기본 realtime 경로를 사용할 수 있어 검색보다 먼저 새 문서를 볼 수 있습니다. 실제 realtime 옵션·routing·version·대상 index가 맞는지 확인합니다.

원본 DB가 따로 있으면 DB commit→outbox·CDC→Elasticsearch 색인→refresh→검색이라는 지연이 더해집니다. 검색에 없다는 증상에서 어느 단계가 아직 완료되지 않았는지 나눠야 합니다.

## Refresh와 내구 Flush는 다른 책임입니다

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

## 즉시 확인이 필요한 요청에만 비용을 지불합니다

저장 직후 편집 화면은 저장 응답이나 ID GET으로 확인할 수 있습니다. 반드시 검색 필터 결과에 들어와야 하는 요청은 wait_for를 검토합니다. wait_for는 보통 다음 refresh를 기다려 매번 강제 refresh 비용을 줄이지만 listener 한도 등 조건에서 강제 refresh가 발생할 수 있고 refresh 비활성 구성에서는 대기가 길어질 수 있습니다. 정확한 제품 계약을 확인합니다.

모든 쓰기에 강제 refresh를 적용하면 작은 segment·후속 merge·검색·색인 I/O 비용이 늘 수 있습니다. bulk 요청의 batch·동시성·visibility SLO·색인 처리량을 같이 비교합니다. timeout은 색인이 없다는 증명이 아니므로 같은 문서 ID·source version으로 결과를 확인합니다.

## Reindex 완료는 동시 변경을 모두 반영했다는 뜻이 아닙니다

mapping 변경으로 새 index를 만들고 reindex하는 동안 old index나 원본 DB에 write·delete가 계속 들어올 수 있습니다. 기준 snapshot과 그 이후 변경 위치를 확보하고 새 index에 빠짐없이 적용해야 합니다. reindex 작업 완료만 보고 alias를 바꾸면 스캔 뒤에 생긴 변경이나 삭제가 누락될 수 있습니다.

늦은 snapshot 문서가 더 최신 delta 적용을 덮지 않도록 source version·계산 버전을 검증합니다. Elasticsearch의 외부 version 사용·sequence number/primary term 조건은 서로 다른 기능이므로 채택 API의 정확한 계약에 맞춥니다. 단순 dual-write는 한쪽 성공·다른 쪽 실패의 복구 기록이 필요합니다. outbox·CDC로 재생할 수 있는 원본 권위를 두면 대사가 쉬워집니다.

## Alias의 원자 전환과 데이터 동기화는 별개입니다

old/new alias 제거·추가를 지원되는 단일 atomic alias 요청으로 묶을 수 있습니다. 그러나 이 원자성은 라우팅 metadata 변경 범위이며 모든 진행 중 검색·writer·DB transaction을 하나로 고정하지 않습니다. read alias·write alias·is_write_index·직접 index 이름을 쓰는 client를 확인하고 최종 변경 장벽을 정합니다.

건수뿐 아니라 문서 version·삭제 tombstone·대표 검색·정렬·집계·권한 필터를 대조합니다. 같은 건수여도 내용이 다를 수 있습니다. 새 index에 정상 쓰기가 들어온 뒤 old로 되돌리면 그 변경을 잃을 수 있어 역동기화·재생·rollback 창이 필요합니다. old index 삭제는 참조·보관·복구를 확인한 별도 승인 행동입니다.

## 관측 지연과 결과 정합성을 각각 시험합니다

색인 ACK 직후 GET·search를 비교하고 기본 refresh·wait_for·강제 refresh의 노출 지연·segment·merge·p99를 측정합니다. reindex에서는 스캔 중 write·delete·늦은 backfill·alias 전환·old writer·역전환을 주입합니다.

현재 작업에서는 Elasticsearch 색인·refresh·reindex를 실행하지 않았습니다. 본문은 검색 공개와 전환의 설계이며 실제 가시성 지연이나 무중단 재색인 결과가 아닙니다.
