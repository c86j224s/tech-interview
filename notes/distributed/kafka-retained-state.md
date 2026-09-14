---
id: kafka-retained-state
title: Kafka Retention·Compaction·Tombstone의 복구 범위
topic: 분산 시스템
summary: segment 삭제와 키별 최신 상태를 구분하고 비연속 offset·null key·tombstone 누락·compact+delete·snapshot 이후 재생을 설명합니다.
questionIds: [kafka-retention-compaction, kafka-tombstone-offline-consumer, kafka-compact-delete-latest-loss]
---

# Kafka Retention·Compaction·Tombstone의 복구 범위

## 최신 상태와 모든 변화 이력은 다른 자료입니다

주문이 pending→paid→shipped로 바뀐 모든 사건을 감사하려면 전이를 보관해야 합니다. key별 최신 shipped만 남는 changelog는 현재 상태 복원에 유용하지만 중간 결제·취소 시도를 모두 복원하지 못합니다. 보관 목적을 먼저 정합니다.

시간·크기 기반 delete retention은 오래된 segment를 제거하고, compaction은 같은 key의 옛 records를 정리해 최신 상태 재구성을 돕습니다. background·segment 단위 처리이므로 설정 시간에 각 레코드가 정확히 삭제되거나 즉시 key당 한 개만 남는 것은 아닙니다.

| 정책 | 보존 관점 | 놓치기 쉬운 조건 |
| --- | --- | --- |
| delete | 기간·크기 안의 로그 | log start 이전 데이터 없음 |
| compact | key별 상태 갱신 | 전체 사건 이력 아님·정리 지연 |
| compact,delete | 키 정리와 기간/크기 제한 | 최신 값도 segment 삭제로 사라질 수 있음 |
| tombstone 보관 | 삭제 전파 기회 | 오래 중단한 기존 상태가 삭제를 놓칠 수 있음 |

## Compaction은 Offset을 다시 매기지 않습니다

같은 key의 offset 10=값A, 12=값B, 15=값C에서 옛 값이 정리되면 15만 남을 수 있지만 번호를 10으로 당기지 않습니다. 내부 control record·aborted transaction 필터 등도 앱이 보는 offset의 공백을 만들 수 있습니다. 모든 정수를 처리할 때까지 기다리는 watermark는 잘못된 모델입니다.

consumer는 실제 전달 순서·position·committed·log start/end를 따르고 별도의 업무 sequence가 필요하면 메시지에 넣습니다. earliest는 남아 있는 가장 오래된 위치이지 서비스의 모든 역사 시작은 아닙니다.

```diagram
{"title":"키별 최신 상태는 중간 이력을 대체합니다","caption":"화살표는 같은 key의 갱신과 compaction 결과입니다. 최신 상태 복원에 필요한 값은 남을 수 있지만 모든 전이 분석은 별도 원본 이력이 필요합니다.","rows":[[{"id":"old","label":"K · offset 10 값 A"}],[{"id":"middle","label":"K · offset 12 값 B"}],[{"id":"latest","label":"K · offset 15 값 C"}],[{"id":"compact","label":"정리 뒤 최신 C 유지 가능"}]],"edges":[{"from":"old","to":"middle","label":"같은 key 갱신"},{"from":"middle","to":"latest","label":"다음 갱신"},{"from":"latest","to":"compact","label":"background 정리"}]}
```

## Tombstone을 놓치면 옛 Cache에 유령 Key가 남을 수 있습니다

non-null key와 null value의 tombstone은 해당 key 삭제를 나타냅니다. null key는 식별할 key가 없는 경우이며 다른 의미입니다. compacted topic의 null key 허용·생산 오류는 실제 버전에서 확인합니다.

기존 cache가 K를 가진 채 오래 중단했고 tombstone이 보관 기간 뒤 정리되면 재개해도 K 삭제를 못 볼 수 있습니다. 최신 offset으로 조용히 이동하는 것은 유령 key를 해결하지 않습니다. 검증된 전체 snapshot에서 다시 시작하거나 원본과 key 집합·삭제 상태를 대조해 보정합니다. 새 빈 cache의 전체 bootstrap과 오래된 cache의 증분 재개는 다른 상황입니다.

최대 offline 기간뿐 아니라 전체 재생에 걸리는 시간·cleanup 지연·snapshot 주기를 보관 계약에 넣습니다. tombstone이 영원히 남거나 정해진 시각에 즉시 사라진다고 가정하지 않습니다.

## Compact와 Delete를 같이 쓰면 최신값도 영구 보존되지 않습니다

key가 오랫동안 갱신되지 않아 그 최신 record가 오래된 segment에만 있으면 delete retention이 그 segment를 제거할 수 있습니다. compact 설정이 있다는 이유로 모든 key의 최신 상태가 영구히 남는 원장이라고 보지 않습니다.

정기 snapshot에 source version·partition별 다음 재생 위치를 기록하고 그 이후 필요한 로그가 연속적으로 남는지 확인합니다. snapshot만 만들고 이후 delete·write를 놓치면 재구축은 최신 상태가 아닙니다. old snapshot을 바탕으로 다시 처리하는 외부 효과는 event ID·원장으로 멱등화합니다.

## 보관 변경도 데이터 정책 변경입니다

retention을 줄이면 중단 소비자의 재개·감사·분쟁·백업 요구를 어길 수 있습니다. 반대로 무기한 보관은 디스크·개인정보 비용을 만듭니다. topic별 목적·최대 재생 창·삭제 승인·restore 경로를 명시합니다. compaction의 CPU·디스크 I/O와 foreground 생산·소비 지연도 관찰합니다.

테스트는 같은 key 반복, compaction 중 순회, tombstone을 놓친 기존 cache, compact+delete의 오래된 최신값, log start 밖 offset과 snapshot 재생을 나눕니다. 현재 작업에서는 실제 Kafka cleaner·retention을 실행하지 않았습니다. 본문은 복구 가능한 상태의 범위를 설명합니다.
