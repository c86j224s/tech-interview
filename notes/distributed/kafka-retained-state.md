---
id: kafka-retained-state
title: Kafka Retention·Compaction·Tombstone의 복구 범위
topic: 분산 시스템
summary: segment 삭제와 키별 최신 상태를 구분하고 비연속 offset·null key·tombstone 누락·compact+delete·snapshot 이후 재생을 설명합니다.
questionIds: [kafka-retention-compaction, kafka-tombstone-offline-consumer, kafka-compact-delete-latest-loss]
---

# Kafka Retention·Compaction·Tombstone의 복구 범위

이 노트는 Kafka 로그를 ‘현재 상태를 다시 만드는 저장소’와 ‘모든 변화의 감사 이력’으로 나누어 설계하는 출발점을 제공합니다. delete retention, compaction, tombstone이 각각 어떤 기록을 지우거나 남길 수 있는지 먼저 살펴보고, consumer offset·log start·snapshot 재생 위치를 함께 관리해야 오래 중단된 소비자와 복구된 cache를 안전하게 판정할 수 있음을 추적합니다.

## 최신 상태와 변화 이력의 보존 범위

주문이 pending→paid→shipped로 바뀐 모든 사건을 감사하려면 전이를 보관해야 합니다. key별 최신 shipped만 남는 changelog는 현재 상태 복원에 유용하지만 중간 결제·취소 시도를 모두 복원하지 못합니다. 보관 목적을 먼저 정합니다.

시간·크기 기반 delete retention은 오래된 segment를 제거하고, compaction은 같은 key의 옛 records를 정리해 최신 상태 재구성을 돕습니다. background·segment 단위 처리이므로 설정 시간에 각 레코드가 정확히 삭제되거나 즉시 key당 한 개만 남는 것은 아닙니다.

| 정책 | 보존 관점 | 놓치기 쉬운 조건 |
| --- | --- | --- |
| delete | 기간·크기 안의 로그 | log start 이전 데이터 없음 |
| compact | key별 상태 갱신 | 전체 사건 이력 아님·정리 지연 |
| compact,delete | 키 정리와 기간/크기 제한 | 최신 값도 segment 삭제로 사라질 수 있음 |
| tombstone 보관 | 삭제 전파 기회 | 오래 중단한 기존 상태가 삭제를 놓칠 수 있음 |

## Compaction과 Offset 불변성·watermark 계산

같은 key에 offset 10=값A, 12=값B, 15=값C가 있고 compaction으로 A와 B가 정리되면 C만 남을 수 있지만, C의 offset을 10으로 다시 매기지는 않습니다. 내부 control record나 aborted transaction 필터 때문에 애플리케이션이 받는 offset 숫자 사이에도 빈 곳이 생길 수 있습니다. 따라서 watermark는 모든 정수를 하나씩 처리했는지가 아니라 실제로 전달된 record 순서에서 앞쪽 구간이 어디까지 끝났는지로 계산해야 합니다.

consumer는 실제 전달 순서·position·committed·log start/end를 따르고 별도의 업무 sequence가 필요하면 메시지에 넣습니다. earliest는 남아 있는 가장 오래된 위치이지 서비스의 모든 역사 시작은 아닙니다.

```diagram
{"title":"키별 최신 상태는 중간 이력을 대체합니다","caption":"화살표는 같은 key의 갱신과 compaction 결과입니다. 최신 상태 복원에 필요한 값은 남을 수 있지만 모든 전이 분석은 별도 원본 이력이 필요합니다.","rows":[[{"id":"old","label":"K · offset 10 값 A"}],[{"id":"middle","label":"K · offset 12 값 B"}],[{"id":"latest","label":"K · offset 15 값 C"}],[{"id":"compact","label":"정리 뒤 최신 C 유지 가능"}]],"edges":[{"from":"old","to":"middle","label":"같은 key 갱신"},{"from":"middle","to":"latest","label":"다음 갱신"},{"from":"latest","to":"compact","label":"background 정리"}]}
```

## Tombstone·null key와 옛 Cache의 유령 Key

non-null key와 null value의 tombstone은 해당 key 삭제를 나타냅니다. null key는 식별할 key가 없는 경우이며 다른 의미입니다. compacted topic의 null key 허용·생산 오류는 실제 버전에서 확인합니다.

기존 cache가 K를 가진 채 오래 중단했고 tombstone이 보관 기간 뒤 정리되면 재개해도 K 삭제를 못 볼 수 있습니다. 최신 offset으로 조용히 이동하는 것은 유령 key를 해결하지 않습니다. 검증된 전체 snapshot에서 다시 시작하거나 원본과 key 집합·삭제 상태를 대조해 보정합니다. 새 빈 cache의 전체 bootstrap과 오래된 cache의 증분 재개는 다른 상황입니다.

최대 offline 기간뿐 아니라 전체 재생에 걸리는 시간·cleanup 지연·snapshot 주기를 보관 계약에 넣습니다. tombstone이 영원히 남거나 정해진 시각에 즉시 사라진다고 가정하지 않습니다.

## Compact·Delete 조합과 최신값 보존 범위

key가 오랫동안 갱신되지 않아 그 최신 record가 오래된 segment에만 있으면 delete retention이 그 segment를 제거할 수 있습니다. compact 설정이 있다는 이유로 모든 key의 최신 상태가 영구히 남는 원장이라고 보지 않습니다.

정기 snapshot에는 source version과 partition별 다음 재생 위치를 함께 기록하고, 그 위치 이후에 필요한 로그가 끊기지 않고 남아 있는지 확인합니다. snapshot을 만든 뒤의 delete·write를 놓치면 snapshot에서 다시 시작해도 최신 상태가 아니므로, snapshot 시점과 재생 시작점을 한 쌍으로 관리해야 합니다. old snapshot에서 외부 효과를 다시 실행할 때는 event ID와 원장으로 멱등화해 재처리 중복을 흡수합니다.

## Retention 변경과 데이터 보존 정책

retention을 줄이면 중단 소비자의 재개·감사·분쟁·백업 요구를 어길 수 있습니다. 반대로 무기한 보관은 디스크·개인정보 비용을 만듭니다. topic별 목적·최대 재생 창·삭제 승인·restore 경로를 명시합니다. compaction의 CPU·디스크 I/O와 foreground 생산·소비 지연도 관찰합니다.

테스트는 같은 key 반복, compaction 중 순회, tombstone을 놓친 기존 cache, compact+delete의 오래된 최신값, log start 밖 offset과 snapshot 재생을 나눕니다. 현재 작업에서는 실제 Kafka cleaner·retention을 실행하지 않았습니다. 본문은 복구 가능한 상태의 범위를 설명합니다.

재현 연습은 같은 key에 A, B, C를 순서대로 기록하고 tombstone을 추가한 뒤, compaction 전·후의 전달 record와 log start를 비교하는 것입니다. 예상 결과는 남은 최신 값의 offset이 과거 offset으로 재번호화되지 않고, tombstone이 사라진 뒤 오래된 cache를 증분 재생하면 삭제를 놓칠 수 있다는 것입니다. snapshot의 다음 재생 위치가 log start보다 앞서면 그 snapshot은 해당 복구 계약을 만족하지 않으므로 전체 bootstrap 또는 다른 원본이 필요합니다.
