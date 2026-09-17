---
id: kafka-replication-acks
title: Kafka 복제 ACK와 기록 보존 경계
topic: 분산 시스템
summary: 복제 계수(RF)와 ISR을 구분하고 acks와 min.insync.replicas가 어떤 복제 성공을 확인하는지, 리더 장애 때 기록이 어디까지 보존되는지 추적합니다.
questionIds: [kafka-acks-isr, kafka-unclean-election-policy]
---

# Kafka 복제 ACK와 기록 보존 경계

## RF 3과 현재 ISR의 복제 범위

한 파티션(partition)에 복제 계수(**replication factor**, RF)가 3이라고 하겠습니다. 이것은 leader 하나와 follower 둘을 포함해 배치할 사본 수가 세 개라는 뜻입니다. 하지만 세 replica가 항상 현재 복제 성공 집합으로 인정되는 것은 아닙니다. follower 하나가 장애를 겪거나 leader를 따라잡지 못하면 **ISR(in-sync replicas)** 에서 빠질 수 있습니다.

먼저 Kafka 4.3에서 **Eligible Leader Replicas(ELR)를 끈 단순 ISR 모델**만 따라갑니다. `eligible.leader.replicas.version=0`이면 ELR이 비활성화되므로, 리더가 고장 났을 때는 ISR 안의 후보를 우선 선출하고 ISR 밖의 뒤처진 replica는 안전한 후보로 보지 않습니다. ELR이 켜진 현행 클러스터에서는 이 경로만으로 선출 결과를 설명할 수 없으므로, 뒤에서 별도 조건으로 나눠 보겠습니다.

예를 들어 처음에는 `ISR={L,F1,F2}`이고 `min.insync.replicas=2`라고 하겠습니다. F2가 늦어져 ISR 밖으로 나가면 현재 ISR은 `{L,F1}`이 됩니다. 이 상태에서는 `acks=all` 생산이 여전히 가능하지만, “세 replica 중 아무 두 개만 골라 기다린다”는 뜻은 아닙니다. 현재 ISR에 들어 있는 L과 F1 모두의 확인을 기다리고, `min.insync.replicas=2`는 그 상태에서 쓰기를 허용할 최소 ISR 크기를 정합니다.

반대로 F1까지 빠져 `ISR={L}`만 남으면 최소 ISR 2를 만족하지 못합니다. 이 설정에서 `acks=all` 생산은 일반적으로 `NotEnoughReplicas` 또는 `NotEnoughReplicasAfterAppend` 계열 오류로 거절됩니다. 가용성을 유지하려고 min ISR을 낮추면 leader 하나만 남은 상태에서도 쓰기가 성공할 수 있지만, 성공 응답 뒤 보존을 맡는 사본 수가 줄어드는 대가를 지게 됩니다.

## Kafka 복제 용어 비교

| 항목 | 무엇을 세거나 확인하나요? | 이 예의 값 | 오해하면 안 되는 점 |
|---|---|---|---|
| RF | topic 파티션에 배치할 전체 사본 수 | 3 | 현재 살아 있고 동기화된 수가 항상 3이라는 뜻은 아닙니다. |
| Leader | producer append를 먼저 받는 replica | L | leader 하나에 기록됐다는 사실만으로 follower 복제가 끝난 것은 아닙니다. |
| Follower | leader log를 가져와 append하는 replica | F1, F2 | lag가 커지면 ISR에서 제외될 수 있습니다. |
| ISR | 현재 동기화 상태로 인정되는 replica 집합 | `{L,F1,F2}` 또는 `{L,F1}` | RF 전체와 매 순간 같지 않습니다. leader가 포함됩니다. |
| `min.insync.replicas` | `acks=all` 쓰기에 필요한 최소 ISR 수 | 2 | “정확히 두 replica만 기다림”이 아니라 쓰기 허용 하한입니다. |
| `acks=all` | 현재 ISR 전체의 append 확인을 요구 | 현재 ISR 모두 | RF에 설정된 ISR 밖 replica까지 기다린다는 뜻이 아닙니다. |

Kafka 4.3 topic 설정 문서에서 `min.insync.replicas`는 leader를 포함한 최소 ISR 수로 설명됩니다. 현재 ISR이 세 개이고 min ISR이 2여도 `acks=all`은 세 ISR 모두의 확인을 요구합니다. 현재 ISR이 두 개로 줄었을 때는 그 두 개가 모두 확인하면 됩니다.

```diagram
{"title":"복제 ACK가 만들어지는 경로","caption":"화살표는 producer 요청과 leader에서 follower로 이어지는 복제 흐름입니다. topic 설정인 min.insync.replicas=2는 ACK 노드가 아니라 현재 ISR의 최소 크기이며, follower의 진행 확인은 leader가 반영합니다.","rows":[[{"id":"producer","label":"Producer","detail":["acks=all","broker 응답 대기"]}],[{"id":"leader","label":"Leader L","detail":["파티션 append","현재 쓰기 기준"]},{"id":"settings","label":"Topic 설정","detail":["min ISR=2","RF=3"]}],[{"id":"f1","label":"Follower F1","detail":["leader log fetch","ISR이면 현재 후보"]},{"id":"f2","label":"Follower F2","detail":["leader log fetch","lag 시 ISR 탈락"]}]],"edges":[{"from":"producer","to":"leader","label":"쓰기 요청"},{"from":"settings","to":"leader","label":"성공 하한 적용"},{"from":"leader","to":"f1","label":"복제 진행"},{"from":"leader","to":"f2","label":"복제 진행"}]}
```

그림에서 follower의 복제 진행 화살표는 producer가 follower와 직접 대화한다는 뜻이 아니라, follower가 leader의 log를 따라잡고 그 진행을 leader가 반영하는 흐름입니다. `min.insync.replicas`는 producer 옆에 붙이는 ACK 수가 아니라 topic 설정으로서 현재 ISR의 최소 크기를 제한합니다.

Kafka 4.3 공식 복제 설계 문서는 현재 ISR 전체가 기록을 받아야 파티션 write가 committed가 되고, consumer에는 committed message만 제공된다고 설명합니다.

## 복제 상태별 성공 조건과 보존 경계

다음 표의 “성공”은 producer가 해당 요청에 대해 Kafka의 성공 응답을 받을 수 있는지에 대한 판단입니다. 외부 DB 효과나 장기적인 모든 장애까지 포함한 보장이 아닙니다. 이 설명은 위에서 정한 ELR 비활성 단순 ISR 모델을 기본으로 하며, ELR 활성 상태의 후보 선출은 아래의 별도 문단과 공식 문서 링크를 기준으로 다시 판단합니다.

| 상태 | 현재 ISR | `acks` / min ISR | 생산 요청의 예상 결과 | 기록 보존 해석 |
|---|---|---|---|---|
| A | `{L,F1,F2}` | `all` / 2 | L·F1·F2 모두 확인하면 성공 | 세 현재 ISR에 기록된 committed 경계입니다. |
| B | `{L,F1}` | `all` / 2 | L·F1 모두 확인하면 성공 | F2가 ISR 밖이므로 이 요청에서 기다릴 대상이 아닙니다. |
| C | `{L}` | `all` / 2 | 최소 ISR 부족으로 거절 | 단일 replica 상태에서 성공시키지 않는 설정입니다. |
| D | `{L,F1}` 후 L 장애 | `all` / 2로 앞서 성공한 기록 | F1을 새 leader로 선출할 수 있음 | F1이 받은 committed 기록은 이어질 수 있습니다. 미복제 tail은 별도입니다. |
| E | ELR 비활성, 모든 ISR 장애, F2만 뒤처짐 | unclean false/true 비교 | false는 가용성 대기, true는 쓰기 재개 가능 | true이면 F2에 없는 기록이 사라질 수 있습니다. ELR 모델은 별도 판단이 필요합니다. |

A에서 min ISR이 2라는 이유로 F2를 무시하고 L과 F1만 기다리는 것이 아닙니다. F2가 아직 ISR이면 세 replica가 모두 확인해야 성공합니다. B처럼 F2가 ISR에서 제거된 뒤에야 현재 집합이 두 개가 됩니다.

ISR이 줄어드는 순간과 leader의 append가 겹치면 `NotEnoughReplicas`와 `NotEnoughReplicasAfterAppend` 중 어느 오류가 돌아오는지에 따라 producer가 관찰한 경계가 달라질 수 있습니다. 두 이름을 같은 실패로 뭉뚱그리지 말고 append 전후의 상태와 broker log를 함께 확인해야 하며, 오류 응답만으로 record가 log에 절대 들어가지 않았다고 단정하지 않습니다.

## acks 값별 기록 확인 범위

`acks=0`은 broker가 받은 뒤의 확인을 기다리지 않습니다. socket buffer에 넘긴 뒤 성공처럼 진행할 수 있지만 receipt나 offset을 확인할 수 없습니다. `acks=1`은 leader가 자기 log에 append한 뒤 응답하고 follower를 기다리지 않으므로, 그 뒤 leader가 장애 나면 아직 복제되지 않은 기록을 잃을 수 있습니다.

`acks=all` 또는 `-1`은 현재 ISR 전체의 확인을 기다려 이 선택지 중 가장 높은 Kafka 내부 복제 내구성을 제공합니다. 어느 값도 매 레코드마다 물리 디스크에 `fsync`했다는 확인과 같지는 않습니다.

Kafka 공식 설계 문서는 filesystem append가 OS page cache에 머물 수 있고, 성능 때문에 매 write마다 `fsync`를 요구하지 않는다고 설명합니다.

`min.insync.replicas`는 `acks=all`이 현재 ISR을 모두 기다리더라도 최소 몇 개의 ISR이 남아 있어야 쓰기를 허용할지 정합니다. 그래서 min ISR을 1로 두면 ISR이 leader 하나로 줄어든 상태에서도 producer 성공이 가능할 수 있습니다. RF를 3으로 설정했다는 숫자만으로 성공한 모든 record가 언제나 세 replica에 남는다고 말할 수 없는 이유입니다.

반대로 min ISR을 3으로 올리면 ISR 하나라도 빠지는 순간 쓰기 가용성을 포기하고 복제 여유를 보전하는 방향이 됩니다. 아래의 consumer 가시성 설명은 Kafka 4.3 topic 설정 문서가 제시한 규칙이며, ELR 비활성 단순 ISR 모델로만 읽지 않습니다. ELR을 사용하는 환경에서는 high watermark와 eligible leader 후보를 함께 확인해야 합니다.

topic 설정 문서는 producer의 `acks` 값과 무관하게 consumer가 record를 보기 전에 현재 ISR 전체 복제와 min ISR 조건이 충족되어야 한다고 설명합니다. 따라서 producer가 `acks=1` 응답을 받았다는 것, consumer가 곧 읽을 수 있다는 것, follower가 장애 후에도 그 record를 보존하고 있다는 것은 서로 다른 주장입니다.

## leader 장애와 ‘committed’ 경계의 보존

leader L이 고장 났을 때 controller는 보통 ISR 안의 replica를 새 leader로 선택합니다. L과 F1이 ISR이었고 성공한 record가 두 곳에 모두 append되어 committed라면, F1이 새 leader가 되어 그 record를 이어갈 수 있습니다.

Kafka 4.3 복제 설계 문서가 말하는 핵심 전제는 적어도 하나의 in-sync replica가 계속 살아 있는 동안 committed record를 보호할 수 있다는 것입니다. RF `f+1`은 그런 전제 아래 `f`개의 장애를 견디는 사본 수로 설명됩니다.

이 절의 기본 표와 다음 사례는 **ELR을 비활성화한 단순 ISR 모델**입니다. 이 모델에서 모든 ISR replica가 사라지면 Kafka는 일관된 ISR replica가 돌아올 때까지 파티션을 사용할 수 없게 두거나, `unclean.leader.election.enable=true`일 때 뒤처진 replica를 leader로 올려 가용성을 회복할 수 있습니다. 그 replica에 없는 최신 기록, 심지어 앞서 committed였던 기록도 사라질 위험이 있습니다.

다만 Kafka 4.3의 [Eligible Leader Replicas 문서](https://kafka.apache.org/43/operations/eligible-leader-replicas/)는 ELR이라는 별도 모델을 설명합니다.

ELR은 Kafka 4.0부터 사용할 수 있고, 새 클러스터에서는 4.1부터 자동 활성화되며, `eligible.leader.replicas.version=0`이면 비활성화됩니다. ELR이 활성화된 경우 ISR 밖이어도 controller가 추적하는 안전한 ELR 후보가 있을 수 있습니다.

또한 min ISR보다 ISR 크기가 작을 때 high watermark가 전진하지 않도록 하여 후보의 안전성을 다루고, leader 선출도 ISR → unfenced ELR → 조건을 만족하는 이전 leader 순서로 판단합니다.

그러므로 “모든 ISR 장애 뒤에는 stale replica를 unclean election으로 올리는 경우만 있다”는 말은 이 노트처럼 ELR이 꺼져 있고 해당 replica가 ELR에도 없는 경우에만 적용됩니다.

이 선택은 “장애 중에도 쓰기를 재개할 것인가”와 “성공했다고 응답한 기록을 잃지 않을 것인가” 사이의 정책입니다. 재생성 가능한 알림 로그라면 가용성을 우선할 여지가 있지만, 금액·재고·권리 원장이라면 unclean election을 쉽게 허용해서는 안 됩니다. 어느 경우든 새 leader의 log와 producer가 성공 응답받았거나 응답을 잃은 record ID를 대조할 복구 절차가 필요합니다.

## 성공 조건과 구현 경계 분리

이 노트에서는 producer의 `send`와 broker의 leader append를 하나의 의사코드로 합치지 않습니다. producer가 요청을 보내는 경계, leader가 append하는 경계, follower가 복제 진행을 알리는 경계, broker가 ACK를 반환하는 경계를 실제 client·broker 버전에 맞춰 따로 확인해야 합니다.

또한 `min.insync.replicas` 부족을 append 전에 판단하는 경우와 append 뒤 `NotEnoughReplicasAfterAppend`를 반환하는 경우를 같은 결과로 뭉뚱그리지 않습니다. 오류 이름만으로 record가 절대 log에 없었다고 단정하지 않는 것이 안전합니다.

| 관찰 단계 | 확인할 상태 | 이 예에서의 판단 |
|---|---|---|
| producer 요청 | `acks=0/1/all` 설정과 요청 도착 여부 | `acks=0`은 broker 확인 없음, `acks=1`은 leader append 확인, `all`은 현재 ISR 복제 확인을 기다립니다. |
| leader append 전후 | 현재 ISR 크기와 min ISR | ISR이 min ISR보다 작으면 부족 오류 경계가 생기며, append 뒤에는 `NotEnoughReplicasAfterAppend` 가능성도 따로 기록합니다. |
| follower 진행 | 현재 ISR member가 record를 append했는지 | `acks=all`은 min ISR 개수만큼이 아니라 현재 ISR 전체의 확인을 요구합니다. |
| producer 응답 | 성공·실패·timeout과 record ID | 응답 유실·after-append 오류는 log 존재 여부가 불확실할 수 있어 재시도와 대조 대상으로 남깁니다. |

이 표에서 `minISR=2`는 현재 ISR에서 두 replica만 골라 기다리라는 뜻이 아닙니다. 먼저 현재 ISR 크기가 최소 2인지 확인하고, 그 현재 집합의 모든 member가 복제했는지를 성공 조건으로 봅니다. 이 구분을 하지 않으면 RF 3·ISR 3에서 한 replica의 ACK를 누락한 채 성공시키는 잘못된 설명이 됩니다.

## 입력 상태별 관찰 결과

| 입력 상태 | 관찰할 동작 | 예상 결과 |
|---|---|---|
| RF=3, ISR=3, `acks=all`, min ISR=2 | 세 replica 중 한 follower의 ACK를 늦춤 | 늦춘 follower가 ISR인 동안 producer 성공은 그 ACK까지 기다립니다. |
| RF=3, ISR=2, 같은 설정 | ISR 밖 follower를 유지한 채 생산 | 현재 ISR 두 member가 확인하면 성공할 수 있습니다. |
| RF=3, ISR=1, 같은 설정 | leader만 남긴 상태에서 생산 | min ISR 부족 오류를 확인합니다. |
| 앞서 성공 응답받은 record 직후 leader 중단 | ISR follower를 새 leader로 선출 | 새 leader log에 committed record가 있는지 비교합니다. |
| ELR 비활성, 모든 ISR 중단 후 ELR에도 없는 stale replica만 남김 | `unclean.leader.election.enable`을 false/true로 나눔 | false는 가용성 대기, true는 기록 손실 가능성과 함께 재개됩니다. |
| ELR 활성, ISR 밖 ELR 후보가 남음 | ELR metadata·high watermark·선출 우선순위 확인 | stale replica의 unclean 여부만으로 결과를 예측하지 않습니다. |
| producer 응답 유실만 주입 | 같은 record를 재시도 | broker log와 producer가 본 결과를 따로 세어 불확정 상태를 확인합니다. |

위 시나리오는 실행한 결과가 아니라 직접 시험할 입력과 예상 기준입니다. 시험할 때 producer 응답, 현재 ISR 변화, 새 leader의 log, consumer visibility를 한 개의 “성공” 숫자로 합치지 않아야 합니다. 특히 외부 DB나 결제 결과는 Kafka의 ACK 범위에 들어가지 않으므로 이 노트의 기록 보존 지표와 분리해서 세어야 합니다.

## Kafka 공식 문서 근거

- [Apache Kafka 4.3 Design — Replication](https://kafka.apache.org/43/design/design/): RF, leader/follower, ISR 탈락 기준, committed message, ISR leader 선출, unclean election의 보존·가용성 경계. 같은 페이지의 `Don’t fear the filesystem!`와 복제 설명에서 append가 OS page cache에 머물 수 있고 ACK가 매 write의 물리 디스크 `fsync` 확인은 아니라는 경계도 확인했습니다.
- [Apache Kafka 4.3 Topic Configs](https://kafka.apache.org/43/configuration/topic-configs/): `min.insync.replicas`의 최소 ISR 조건, `acks=all`에서 현재 ISR 전체 ACK, `NotEnoughReplicas` 계열 오류와 consumer visibility. 이 visibility 설명은 Kafka 4.3 topic 설정 문서의 규칙으로 기록했습니다.
- [Apache Kafka 4.3 Producer Configs](https://kafka.apache.org/43/configuration/producer-configs/): `acks=0`, `acks=1`, `acks=all` 확인 범위.
- [Apache Kafka 4.3 Broker Configs](https://kafka.apache.org/43/configuration/broker-configs/): `unclean.leader.election.enable` 기본값과 out-of-sync leader 선출의 손실 경계.
- [Apache Kafka 4.3 Operations — Eligible Leader Replicas](https://kafka.apache.org/43/operations/eligible-leader-replicas/): ELR은 Kafka 4.0부터 사용 가능, 새 클러스터는 4.1부터 자동 활성화, `eligible.leader.replicas.version=0` 비활성화, min ISR 미달 시 high watermark 제약과 ISR·ELR 선출 우선순위. 본문은 먼저 ELR 비활성 단순 ISR 모델로 한정하고 이 문서의 차이를 별도로 설명합니다.
