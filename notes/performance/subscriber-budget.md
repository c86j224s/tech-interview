---
id: subscriber-budget
title: NATS Slow Consumer와 Pull Batch의 메모리 예산
topic: 성능
summary: Core NATS의 유실·JetStream의 재전달을 구분하고 socket·client pending·worker·Ack pending·pull batch를 bytes와 실제 완료로 제한합니다.
questionIds: [nats-slow-consumer, jetstream-pull-batch-ack-memory]
---

# NATS Slow Consumer와 Pull Batch의 메모리 예산

메시지 소비자의 메모리는 broker pending 하나로 설명되지 않습니다. 전달된 payload가 socket·client queue·worker·실행 중 상태·Ack pending을 거치는 동안 각 계층의 개수와 bytes가 누적되므로, 처리 여유를 확인한 뒤 가져오고 업무 효과가 확정된 뒤 Ack하는 수명을 예산으로 잡아야 합니다.

## Slow Subscriber 대기의 누적 계층

메시지를 초당 1000개 받는데 callback이 600개만 처리하면 400개/s가 어딘가에 누적되거나 유실됩니다. server connection pending·socket buffer·client subscription queue·앱 worker queue·실행 중 payload를 각각 구분합니다. broker 지표 하나가 모든 대기 bytes를 보여 주지는 않습니다.

Core NATS는 연결이 끊겨도 저장된 메시지를 다시 읽는 durable replay를 기본 보장하지 않으므로, 재연결 뒤 과거 메시지를 자동 복구한다고 전제하지 않습니다. client pending 한도를 넘겼을 때 메시지가 버려지는지, server가 slow connection을 끊는지처럼 실제 경로는 구현·설정별로 다르므로, client error callback·drop count·disconnect 원인과 server 상태를 같은 시간대에 대조합니다.

재연결 후에는 그동안의 메시지가 돌아왔는지 기대하지 말고, drop·disconnect 증거와 server 상태를 따로 기록합니다.

## 무제한 Worker와 Backpressure 부재

callback이 메시지마다 goroutine을 만들면 client pending은 낮아지면서 heap·외부 DB 대기만 늘 수 있습니다. bounded queue·worker 수·bytes 한도·처리 deadline을 적용합니다. queue group은 subscriber 사이에 전달을 분산하지만 이미 특정 subscriber에 전달된 작업의 처리 완료나 durable 재전달을 보장하는 기능은 아닙니다.

| 계층 | 제한할 값 | 별도 관측 |
| --- | --- | --- |
| client pending | 메시지 수·bytes | drop·oldest age |
| worker queue | 수·bytes·대기 시간 | 거절·포화 |
| 실행 중 | 동시 수·가중 비용 | 실제 완료·취소 후 잔존 |
| JetStream Ack pending | 미확인 전달 수 | redelivery·진행 시간 |

## Pull의 수요 조절과 메모리 상한 부재

JetStream pull consumer는 worker 여유에 맞게 작은 batch를 요청할 수 있지만, pull 자체가 자동 메모리 상한을 만들어 주지는 않습니다. 예를 들어 batch 1000에 최대 메시지 1MiB라면 `1000 × 1MiB ≈ 1GiB`로 payload만 약 1GiB이며, deserialize 객체·복사·client buffer는 별도입니다.

여러 pull을 동시에 열면 이 batch 예산이 곱해질 수 있으므로 메시지 수와 bytes 제한, fetch 만료, outstanding pull 수를 함께 정합니다. 마지막으로 사용하는 API·server가 어떤 bytes 옵션을 지원하는지 확인합니다.

```diagram
{"title":"빈 Worker 예산만큼 Pull하고 완료 뒤 Ack합니다","caption":"화살표는 실제 처리 수명입니다. Ack pending과 앱 메모리는 관련되지만 같은 측정값이 아니며 이미 전달된 payload의 수명도 추적합니다.","rows":[[{"id":"budget","label":"worker·bytes 여유 확인"}],[{"id":"pull","label":"제한된 pull batch"}],[{"id":"work","label":"bounded queue·업무 실행"}],[{"id":"ack","label":"내구 효과 완료·Ack"}],[{"id":"release","label":"참조 종료·예산 반환"}]],"edges":[{"from":"budget","to":"pull","label":"수요 허가"},{"from":"pull","to":"work","label":"payload 소유 이전"},{"from":"work","to":"ack","label":"성공 경계"},{"from":"ack","to":"release","label":"자원 수명 별도 확인"}]}
```

## Ack 대기 상한과 처리 능력의 분리

MaxAckPending은 해당 consumer에서 아직 Ack되지 않은 전달 수를 제한하는 값입니다. 여러 subscription이 같은 consumer를 공유할 때는 각 프로세스가 이 전체 예산을 하나씩 가진다고 계산하지 말고, 공유 consumer의 미확인 전달 수를 기준으로 봅니다. 값을 크게 잡으면 처리량이 늘지 않은 채 메모리·재전달 폭만 커질 수 있고, queue 체류와 실제 실행이 AckWait를 넘으면 아직 처리 중인 메시지도 다시 전달될 수 있습니다.

긴 작업은 지원되는 진행 통지와 실제 최대 실행 한도를 함께 사용합니다. 진행 통지가 영원한 작업을 무한 연장하는 면허는 아닙니다. 효과 전에 Ack하면 crash로 업무를 잃을 수 있고, 효과 뒤 Ack가 유실되면 재전달되므로 내구 dedup·idempotent effect가 필요합니다.

## 메시지 유실·재전달과 업무 성공률의 분리

검산할 때 `batch=1000`, 최대 payload 1MiB라는 입력은 payload만 약 1GiB의 상한 후보를 만들고, 동시 pull 두 개면 그 후보가 더 커질 수 있음을 먼저 계산합니다. 처리 완료 전에 Ack를 하면 crash 뒤 유실 가능성이 있고, 완료 뒤 Ack가 사라지면 중복 전달이 예상되므로 업무 효과의 dedup 결과까지 성공 기준에 넣습니다.

Core의 drop·JetStream의 redelivery·업무 성공·DLQ·미완료 나이를 따로 보고합니다. 큰 payload·느린 DB·연결 재설정·Ack 유실·shutdown drain·fetch 취소를 시험합니다. shutdown에서는 새 pull을 멈추고 실제 작업 완료 또는 안전한 미확인 재처리 정책을 적용합니다. 현재 작업에서는 NATS/JetStream server 실험을 실행하지 않았습니다.
