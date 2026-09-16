---
id: broker-progress
title: Kafka Lag와 업무 효과의 완료 지점
topic: 성능
summary: log end·fetch position·committed offset·연속 업무 완료를 나누고 partition별 hot spot·유입률·배수 시간·retention·재처리 상태를 설명합니다.
questionIds: [kafka-lag-interpretation, kafka-commit-lag-versus-effect-lag]
---

# Kafka Lag와 업무 효과의 완료 지점

## Commit이 앞섰다고 업무가 끝난 것은 아닙니다

offset 100을 worker에게 넘기자마자 101을 commit하고 worker가 외부 결제를 아직 기다리면 broker 관점의 commit lag는 줄어도 업무는 미완료입니다. 반대로 업무가 완료됐지만 commit이 실패하면 lag가 커 보여도 재전달 시 dedup으로 끝날 수 있습니다. 서로 다른 경계를 같은 완료라고 부르지 않습니다.

| 지점 | 뜻 | 보장하지 않는 것 |
| --- | --- | --- |
| log end offset | 해당 기준에서 로그 끝의 다음 위치 | 모든 transaction이 읽기 가능함 |
| consumer position | consumer가 다음에 가져올 위치 | worker 실행 완료 |
| committed offset | 재시작 시 사용할 다음 위치 | 외부 효과 원자적 완료 |
| 연속 업무 완료 경계 | 그 앞의 필요한 효과가 완료됨 | 이후 hole도 완료됨 |

`read_committed`로 transactional topic을 읽을 때는 미완료 트랜잭션 뒤로 넘어가지 않는 LSO 같은 읽기 경계를 함께 봅니다. 예를 들어 exporter가 log end를 수집하는지, consumer position이나 committed offset을 수집하는지 먼저 확인한 뒤 그 값으로 같은 partition의 lag를 계산합니다. 이 기준을 확인하지 않으면 같은 이름의 lag라도 실제로 읽을 수 있는 범위와 재시작 지점이 달라져 잘못 비교하게 됩니다.

## 숫자 예제로 네 경계를 따로 기록합니다

로그 끝이 200, fetch position이 190, commit이 180, 업무가 연속 완료된 다음 위치가 160이라면 각각 fetch 차이 10·commit 차이 20·업무 경계 차이 40입니다. 160만 막히고 161–189가 완료됐을 수도 있어 경계 차이 40이 미완료 개수 40을 뜻하지는 않습니다. offset에는 제어 레코드·compaction 등에 따른 차이도 있으므로 bytes·실제 작업 수·가장 오래된 미완료 나이를 함께 기록합니다.

```diagram
{"title":"전달·재시작·효과 완료는 서로 다른 경계","caption":"화살표는 처리 흐름이지 원자적 동시 완료 보장이 아닙니다. commit 정책은 업무 완료와 중복 처리 계약에 맞게 별도로 결정합니다.","rows":[[{"id":"log","label":"broker의 읽기 가능한 로그"}],[{"id":"fetch","label":"fetch·local queue"}],[{"id":"effect","label":"worker·외부 효과"}],[{"id":"commit","label":"연속 완료 확인 후 commit"}]],"edges":[{"from":"log","to":"fetch","label":"전달"},{"from":"fetch","to":"effect","label":"실행"},{"from":"effect","to":"commit","label":"완료 정책"}]}
```

## Lag의 변화율과 가장 느린 Partition을 봅니다

초당 유입 λ=1000이고 실제 완료 μ=800이면 backlog는 대략 200/s 증가합니다. backlog 12000에서 유입 1000·완료 1400을 안정적으로 유지한다면 단순 예상 배수 시간은 `12000/(1400-1000)=30초`입니다. μ≤λ면 이 식으로 유한 회복 시간을 낼 수 없습니다. 이는 비용·유입이 안정된 근사이지 장애 시 보장이 아닙니다.

partition별 offset 차이·oldest age·유입/완료 bytes·처리 비용·retry·rebalance·paused 상태를 봅니다. 한 hot key가 한 partition을 지배하면 consumer 수를 더 늘려도 그 partition을 같은 group 안에서 둘에게 병렬 소유시킬 수 없습니다. 논리 순서와 partition 분할을 함께 재설계해야 할 수 있습니다.

## 업무 관측은 독립된 내구 상태가 필요할 수 있습니다

외부 effect ID·idempotency key·완료 ledger·DLQ 상태로 실제 완료를 추적합니다. 이미 commit한 offset에 미완료 업무가 남는 설계라면 재시작 뒤 누가 그 업무를 회수하는지 별도의 내구 queue/ledger로 보장해야 합니다. 인메모리 worker queue만 남기면 프로세스 죽음으로 작업을 잃을 수 있습니다.

DLQ 이동을 “원래 업무 성공”으로 계산하지 않고 분리된 종결 상태로 표시합니다. retention이 소비 위치를 추월하면 reset 정책·복원 원천·손실 범위를 명확히 합니다. commit lag만 0으로 만드는 offset reset은 데이터 처리가 아닙니다.

## 정상 처리·Hole·재시작을 분리해서 검증합니다

느린 offset 하나가 있는 경우, commit 실패, 효과 성공 후 crash, effect 전 commit 후 crash, retention 초과, rebalance 중 실행을 각각 별도 시나리오로 재현합니다. 각 경우에 group 지표의 offset과 업무 ledger의 효과 상태를 시간순으로 맞춰 보고, 사용자에게 보인 결과까지 대조해야 commit이 줄어든 것과 실제 업무 완료를 구분할 수 있습니다. 여기의 산술과 상태 설명은 특정 Kafka cluster에서 실행한 측정 결과가 아닙니다.
