---
id: kafka-partition-order
title: Kafka 키 순서와 파티션 증설의 경계
topic: 분산 시스템
summary: 같은 키의 레코드가 파티션(partition)과 offset에서 어떤 순서로 보이는지 추적하고, 파티션 증설 뒤 순서 보장을 다시 설계하는 방법을 설명합니다.
questionIds: [kafka-partition-expansion, kafka-cross-language-partitioner, kafka-null-key-partitioning, kafka-new-topic-cutover]
---

# Kafka 키 순서와 파티션 증설의 경계

## 같은 키의 순서를 어디까지 믿을 수 있나요?

계정 `acct-7`에 출금과 환불 이벤트를 차례로 보냈다고 하겠습니다. 두 이벤트가 같은 Kafka **파티션**(partition)에 기록되었다면 소비자는 그 파티션에서 브로커 로그에 기록된 순서대로 받습니다. 하지만 이 보장은 topic 전체에 적용되는 전역 순서가 아닙니다. `파티션 0`의 offset `100`과 `파티션 1`의 offset `200`은 서로 다른 로그의 위치일 뿐이므로, `200`이 더 나중에 발생했거나 더 최신 계정 상태라는 뜻이 아닙니다.

Kafka 공식 입문 문서의 표현도 개별 topic-파티션 안에서는 이벤트를 기록된 순서 그대로 읽는다고 설명합니다. 따라서 먼저 “같은 키인가?”보다 “같은 파티션에 기록되었는가?”를 확인해야 합니다. 여러 producer가 같은 키를 사용하더라도 애플리케이션이 이벤트를 만들어 보낸 순서와 브로커에 도착해 append된 순서는 다를 수 있습니다. 업무 순서가 중요하다면 `entitySequence`나 상태 버전처럼 도메인에서 검증할 번호도 함께 기록해야 합니다.

여기서 `offset`은 해당 파티션에서 다음 레코드를 찾기 위한 위치입니다. 그것은 계정의 업무 순번도, topic 전체의 시계도 아닙니다. 보관 정책이나 compaction, 제어 레코드 때문에 애플리케이션이 관찰하는 offset 숫자 사이에 빈 구간이 생길 수 있으므로 offset을 배열 인덱스로 해석하지도 않습니다.

## 목적지는 key bytes와 현재 파티션 수로 계산됩니다

producer가 파티션을 직접 지정하지 않으면 **partitioner**가 목적지를 정합니다. Kafka 4.3 producer 설정 문서에서 확인한 기본 동작은 key가 있으면 key의 해시를 사용하고, key가 없으면 sticky한 파티션을 사용해 배치하는 방식입니다. 따라서 “문자열이 같다”는 것만으로는 충분하지 않습니다. UTF-8 인코딩, 정규화, 숫자 표현, 사용자 정의 partitioner가 서로 다르면 같은 업무 키도 다른 바이트와 다른 파티션이 될 수 있습니다.

단순한 해시-나머지 라우팅으로 생각해 보겠습니다. 어떤 키의 해시 결과를 `4`라고 고정하면 파티션이 3개일 때 `4 mod 3 = 1`이어서 파티션 1로 가지만, 파티션이 6개가 되면 `4 mod 6 = 4`이어서 파티션 4로 갑니다. 실제 client의 구현·버전·사용자 정의 로직을 확인해야 하지만, 파티션 수가 분모에 들어가는 라우팅에서는 이 현상이 핵심입니다.

```diagram
{"title":"키가 파티션을 고르는 경로","caption":"화살표는 발행 시 목적지 선택과 로그 기록입니다. P1과 P4는 증설 전후의 예를 나란히 그렸으며, 각 파티션의 offset만 서로 순서를 가집니다.","rows":[[{"id":"producer","label":"Producer","detail":["key=acct-7","업무 순번=41"]},{"id":"partitioner","label":"Partitioner","detail":["key bytes + 현재 N","목적지 계산"]}],[{"id":"oldlog","label":"P1 로그","detail":["증설 전 hash mod 3","offset 100·101"]},{"id":"newlog","label":"P4 로그","detail":["증설 뒤 hash mod 6","신규 offset 0"]}],[{"id":"consumer","label":"Consumer","detail":["파티션별 순서","전역 순서 아님"]}]],"edges":[{"from":"producer","to":"partitioner","label":"레코드 발행"},{"from":"partitioner","to":"oldlog","label":"증설 전"},{"from":"partitioner","to":"newlog","label":"증설 뒤"},{"from":"oldlog","to":"consumer","label":"P1 순서"},{"from":"newlog","to":"consumer","label":"P4 순서"}]}
```

그림의 `partitioner`에서 P1과 P4로 향하는 화살표는 한 레코드가 동시에 두 곳으로 간다는 뜻이 아닙니다. 같은 key를 증설 전과 후에 발행했을 때 서로 다른 계산 결과가 나오는 시간상의 비교입니다. 소비자는 P1의 순서와 P4의 순서를 각각 알 수 있지만 두 화살표를 하나의 순서열로 합쳐 주지는 않습니다.

key가 `null`인 레코드는 더 제한적입니다. 특정 업무 대상을 고정할 key 자체가 없으므로 같은 계정의 순서를 표현할 수 없습니다. 없는 key를 임의의 상수 하나로 바꾸면 모든 이벤트가 한 파티션에 몰리는 핫 파티션이 될 수 있습니다. 반대로 다국어 producer가 같은 업무 키를 보낸다면 key 직렬화와 partitioner의 golden vector를 언어별로 맞춰야 합니다.

## 파티션을 늘리면 과거 로그가 이동하지 않습니다

Kafka 공식 운영 문서의 `Modifying topics` 절에는 파티션 수를 늘릴 수 있지만 “Kafka will not attempt to automatically redistribute existing data”라고 명시되어 있습니다. 즉 3개에서 6개로 늘려도 기존 파티션 0~2의 레코드가 새 파티션 3~5로 재배치되지는 않습니다. 새 파티션은 이후 발행을 받을 수 있는 빈 로그로 생기고, 과거 데이터의 위치는 그대로입니다.

따라서 증설은 단순히 소비자 수를 늘리는 작업이 아닙니다. 이전 세대의 같은 key 이벤트는 P1에 남아 있고, 이후 이벤트는 P4로 갈 수 있습니다. 새 이벤트를 먼저 읽은 consumer가 계정 상태를 먼저 바꾸면, 생산 시각상 뒤에 온 이벤트가 실제 적용에서는 앞서게 됩니다. 특히 잔액 차감, 조건부 상태 전이, 환불처럼 교환 불가능한 연산은 순서 역전의 결과가 달라집니다. `+10`과 `+20`처럼 우연히 교환 가능한 연산에서 문제가 보이지 않았다고 일반화할 수 없습니다.

Kafka 운영 문서는 새 파티션을 consumer가 발견하기 전 `auto.offset.reset=latest`인 소비자가 그 사이에 들어온 레코드를 놓칠 수 있는 상황과 metadata 갱신 지연도 경고합니다. 이 경고는 모든 client 설정에 반드시 누락이 생긴다는 뜻은 아니지만, 증설 직후 “새 파티션도 이미 같은 방식으로 소비되고 있다”고 가정하지 말아야 한다는 경계입니다.

## 가장 검증하기 쉬운 전환은 stop-drain-switch입니다

이 노트에서는 무중단 재정렬 구현을 범위에 넣지 않고, 생산을 잠시 멈춘 뒤 옛 라우팅을 비우고 전환하는 절차를 기준으로 설명하겠습니다. 이 방식은 전환 중 새 이벤트를 어느 세대에 넣을지와 두 파티션 사이의 gap을 동시에 해결하려 하지 않아 검증 경계가 선명합니다.

1. **stop**: 모든 producer가 새 이벤트를 발행하지 못하도록 발행 게이트를 닫습니다. 이미 발행 중인 요청이 남아 있을 수 있으므로 producer flush/종료, metadata 갱신, 발행 재시도까지 멈춘 것을 확인합니다.
2. **drain**: 옛 파티션별 마지막 로그 위치를 기록하고, consumer가 그 위치까지 실제 외부 효과를 적용했는지 확인합니다. 이때 Kafka offset 하나를 topic 전체 완료 번호로 합치지 않고 파티션마다 검사합니다. worker 큐, 재시도, 외부 처리 ID까지 비워야 합니다.
3. **switch**: 옛 라우팅 세대의 완료 장벽을 저장한 뒤에만 새 파티션 수와 라우팅 설정을 활성화합니다. 새 producer가 새 계산을 사용하고, consumer가 새 파티션을 assignment 받아 처리하는 시점을 별도로 기록합니다.
4. **reconcile**: 전환 직후 일정 시간 동안 key별 업무 순번과 중복 발행을 대조합니다. 실패한 drain을 숨기기 위해 새 라우팅을 먼저 켜지 말고, 장벽을 넘지 못한 key는 전환을 중단하거나 별도 복구 대상으로 남깁니다.

```diagram
{"title":"생산 중단 후 파티션 전환","caption":"화살표는 전환 단계의 제어와 완료 확인입니다. stop 동안 새 발행을 막고, drain은 옛 파티션별 효과 완료를 확인한 뒤 switch로 넘어갑니다.","rows":[[{"id":"gate","label":"발행 게이트","detail":["stop","새 이벤트 차단"]}],[{"id":"oldparts","label":"옛 파티션","detail":["마지막 위치 기록","worker·재시도 비움"]},{"id":"draincheck","label":"완료 확인","detail":["파티션별 외부 효과","처리 ID 대조"]}],[{"id":"switch","label":"라우팅 전환","detail":["새 파티션 수","새 generation 활성"]}],[{"id":"newparts","label":"새 파티션","detail":["전환 뒤 발행","새 consumer 할당"]}]],"edges":[{"from":"gate","to":"oldparts","label":"stop 후 drain"},{"from":"oldparts","to":"draincheck","label":"완료 상태 전달"},{"from":"draincheck","to":"switch","label":"장벽 확인"},{"from":"switch","to":"newparts","label":"새 라우팅"}]}
```

`draincheck`가 확인해야 하는 것은 단순한 consumer position이 아닙니다. `position`은 읽기 위치이고, group committed offset은 다음에 읽을 위치이며, 실제 DB·외부 시스템의 완료 상태는 별도입니다. 따라서 옛 파티션의 마지막 offset까지 poll했다는 것만으로 switch할 수 없습니다. 반대로 모든 옛 이벤트의 외부 효과가 성공했지만 offset commit 응답이 유실된 경우에는 재처리 ID로 중복을 흡수한 뒤 commit을 재시도할 수 있습니다.

이 절차는 무중단 전환보다 가용성을 덜 보장하지만, “옛 세대가 완전히 끝났는가?”라는 질문에 파티션별 입력과 예상 결과를 붙일 수 있습니다. 무중단 전환에서 필요한 key별 `entitySequence`, generation handoff, gap 보류, 원자 상태 갱신은 별도 설계 주제이므로 여기서는 구현 의사코드로 제시하지 않습니다. 파티션 증설만으로 순서 문제가 자동 해결되지 않는다는 경계를 정확히 확인하는 것이 이 노트의 목적입니다.

### 새 Topic 전환은 두 로그의 위치를 별도로 기록합니다

새 topic으로 옮기면 schema·partition 수·retention·consumer group의 시작 위치를 함께 정할 수 있지만 old offset 100과 new offset 100이 같은 사건을 뜻하지는 않습니다. old의 마지막 입력·실제 효과 완료 위치, new의 첫 입력·생산 세대를 기록하고 같은 논리 event ID를 보존합니다. dual publish가 한쪽만 성공하면 재시도·outbox·대사로 나머지 전달을 복구해야 하며 두 topic의 중복 소비도 처리 ID로 흡수합니다.

중단 없는 전환을 선택한다면 key별 논리 sequence·세대와 bounded gap buffer 또는 snapshot 재동기화가 필요합니다. 전체 상태 이벤트의 낮은 version은 버릴 수 있는 계약이 있지만 +10 같은 delta를 version만 보고 버리면 필요한 효과가 사라집니다. old topic을 늦게 읽는 worker가 new 상태를 덮지 않게 실제 저장 경계의 전이를 검증합니다.

new topic에서 정상 쓰기를 시작한 뒤 old로 돌아가면 new에서만 생긴 변경을 잃을 수 있습니다. 역동기화·전환 장벽·복구 창을 정하고 old 삭제는 보관·재생·consumer 상태 확인 뒤 별도 승인으로 수행합니다. 다국어 producer의 golden vector에는 ASCII뿐 아니라 Unicode 정규화·숫자 문자열·빈 key·null key·명시 partition과 증설 전후 목적지를 포함합니다. key 없는 레코드는 key별 최신 상태 compaction의 기준이 없고, non-null key에 null value를 쓰는 tombstone과 다릅니다. compacted topic의 null key 거절과 client 오류 처리는 실제 버전에서 확인합니다.

## 직접 따라 볼 입력과 예상 결과

아래 숫자는 실제 client의 hash 결과를 주장하는 값이 아니라, 증설로 목적지가 바뀌는 관계를 손으로 확인하기 위한 입력입니다.

| 단계 | 파티션 수 | 입력 | 계산·기록 | 예상되는 순서 문제 |
|---|---:|---|---|---|
| A | 3 | `key=acct-7`, 해시 결과 4인 이벤트 `E1` | `4 mod 3 = 1` → P1 offset 100 | P1 안에서는 `E1` 다음 기록이 뒤따릅니다. |
| B | 3 | 같은 key의 `E2` | P1 offset 101 | P1의 `E1 → E2` 순서는 유지됩니다. |
| C | 6 | 같은 key의 `E3` | `4 mod 6 = 4` → P4 offset 0 | P4의 `E3`가 P1의 `E2`보다 먼저 적용될 수 있습니다. |
| D | 6 | P1과 P4를 동시에 읽는 consumer | 두 파티션의 position을 별도로 추적 | offset 101과 0을 비교해 전역 순서를 만들 수 없습니다. |

직접 확인할 때는 먼저 동일한 key bytes를 모든 producer에서 보내고, 파티션 수를 바꾼 뒤 실제 목적지와 metadata 갱신 시점을 기록해 보시면 됩니다. P1 소비를 일부러 늦춘 상태에서 P4의 신규 이벤트를 처리하면 순서 역전 가능성을 관찰할 수 있습니다. 실제 전환 검증은 producer 발행 게이트를 닫고, P1·P2 등 옛 파티션의 마지막 위치와 외부 효과 완료를 각각 확인한 뒤 새 라우팅을 켜는 stop-drain-switch 순서로 진행합니다. 단일 핫키의 처리율이 파티션 수 증가에 따라 늘지 않는지도 별도로 측정해야 합니다. 아직 이 시험을 실행했다고 말할 수는 없으며, 위 표는 예상 결과를 정리한 입력 계약입니다.

## 확인한 공식 문서

- [Apache Kafka 4.3 Getting Started — Main Concepts and Terminology](https://kafka.apache.org/43/getting-started/introduction/): topic, 파티션(partition), key가 같은 파티션으로 가는 설명, 파티션 내부의 기록 순서.
- [Apache Kafka 4.3 Operations — Modifying topics](https://kafka.apache.org/43/operations/basic-kafka-operations/): 파티션 증설, 기존 데이터 자동 재배치 없음, hash-modulo 라우팅에 따른 key 순서 영향, 신규 파티션 발견 지연 경고.
- [Apache Kafka 4.3 Producer Configs](https://kafka.apache.org/43/configuration/producer-configs/): `partitioner.class`의 key·null key 기본 동작과 사용자 정의 partitioner.
