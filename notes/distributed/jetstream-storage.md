---
id: jetstream-storage
title: JetStream Stream·Consumer·Retention·복제의 경계
topic: 분산 시스템
summary: Core 실시간 전달과 내구 저장을 구분하고 독립 durable·보관 정책·pull/push 상한·replica quorum·PubAck 유실·저장 복구를 설명합니다.
questionIds: [nats-core-jetstream, jetstream-durable-consumer, jetstream-retention-fanout-contract, jetstream-pull-push-demand, jetstream-stream-replication, jetstream-slow-replica-quorum, jetstream-leader-transition-timeout]
---

# JetStream Stream·Consumer·Retention·복제의 경계

메시징 시스템을 선택할 때는 “전달됐다”를 누구의 관찰로 정의하는지부터 고정해야 합니다. 연결된 subscriber에게 보낸 실시간 이벤트, stream에 저장된 원본, consumer가 처리하고 ACK한 상태, 외부 DB에 반영된 효과는 각각 다른 경계입니다. 아래에서는 발행부터 재생·복제·복구까지 그 경계를 따라갑니다.
한 주문 이벤트의 상태를 `publish 호출 반환→stream PubAck→consumer 전달→외부 DB commit→consumer ACK`으로 적으면 각 확인의 의미가 달라집니다. PubAck까지만 확인한 생산자는 소비 처리를 보장하지 않고, consumer ACK만 확인한 서비스도 외부 DB commit과 자동으로 원자 결합되지 않습니다.

## Core NATS 실시간 전달과 JetStream 내구 재생

연결된 subscriber에게 현재 발행한 이벤트를 실시간으로 전달하는 것이 Core NATS의 기본 범위입니다. subscriber가 끊긴 동안의 메시지를 나중에 다시 읽는 내구 재생은 기본 계약에 들어 있지 않습니다. 다음 snapshot으로 현재 위치를 다시 맞출 수 있는 알림이라면 단순한 선택일 수 있지만, 반드시 처리해야 하는 주문 사건에는 보관과 재전달 경로가 필요합니다.

JetStream을 선택하면 subject로 들어온 메시지를 stream에 저장하고, consumer마다 전달 위치와 확인 응답(ACK), 재생 상태를 관리합니다. 클라이언트 재연결 buffer나 일반 `publish` 호출의 반환값은 stream이 저장을 확정했다는 `PubAck`와 같은 확인이 아닙니다. 따라서 저장 확인을 어떤 API로 받을지, stream이 어떤 subject를 포착할지, 저장 유형·복제·각종 한도를 실제 설정으로 정해야 합니다.

## Stream 로그와 Consumer 소비 상태

| 구성 | 책임 | 독립 서비스에 필요한 것 |
| --- | --- | --- |
| stream | 저장 subject·메시지·보관 | 공유 가능한 원본 로그 |
| durable consumer | 필터·시작 위치·ACK·재전달 상태 | 분석·알림별 독립 이름·상태 |
| 한 durable의 여러 worker | 같은 서비스 작업 분배 | ACK·동시성·중복 처리 |
| ephemeral·inactivity 정책 | 소비 상태의 수명 | 재시작·삭제 조건 확인 |

분석과 알림이 둘 다 모든 메시지를 읽어야 하면 독립 consumer를 둡니다. 같은 durable을 공유하면 한 소비 상태의 일을 나누며 독립 fan-out과 다릅니다. 매 재시작 새 이름을 만들면 과거를 다시 읽거나 시작 위치를 잃을 수 있습니다. durable도 모든 설정에서 영구 불멸인 상태는 아니므로 inactivity·삭제 정책을 확인합니다.

```diagram
{"title":"같은 Stream을 독립 Consumer가 각자 진행합니다","caption":"화살표는 독립 전달 상태입니다. 이 fan-out은 stream retention이 두 소비 목적과 맞아야 하며 durable 이름이 삭제된 메시지를 되살리지는 않습니다.","rows":[[{"id":"stream","label":"orders stream"}],[{"id":"analytics","label":"analytics durable","detail":["자기 ACK·진행 위치"]},{"id":"notice","label":"notifications durable","detail":["별도 ACK·진행 위치"]}]],"edges":[{"from":"stream","to":"analytics","label":"분석용 전달"},{"from":"stream","to":"notice","label":"알림용 전달"}]}
```

## Retention 정책별 메시지 삭제 조건

보관 정책을 고를 때는 무엇이 메시지를 남기고 지우는지부터 실제 흐름으로 따라가야 합니다. `LimitsPolicy`는 시간·개수·크기 한도까지 보관하고, `InterestPolicy`는 관련 consumer들이 보낸 ACK를 기준으로 메시지 수명을 정합니다. 관심 consumer가 없던 때 들어온 메시지를 나중에 만든 consumer가 반드시 재생한다고 볼 수 없으며, `WorkQueuePolicy`는 한 작업 경로가 완료하면 제거하는 모델이라 겹치는 필터를 가진 독립 consumer들의 fan-out에는 맞지 않습니다.

어느 정책이든 설정한 한도·discard 정책·서버 버전을 확인합니다. stream에서 삭제된 메시지는 durable 위치만으로 복원할 수 없습니다. 재시작 때 consumer ACK floor·pending·redelivery와 stream 첫 보관 위치를 비교하고 보관 범위 밖이면 snapshot·원본 대사로 복구합니다. 최신부터 조용히 읽어 누락을 숨기지 않습니다.

## Pull Prefetch와 애플리케이션 큐 상한

pull consumer는 필요한 batch·요청 수·만료를 조절하기 쉽고, push는 server 전달과 ACK·flow control·client buffer를 맞춰야 합니다. 둘 다 MaxAckPending·worker 수·DB pool·대기 바이트를 연결해야 합니다. 이미 받은 메시지의 실제 실행을 MaxAckPending이 강제 종료하지는 않습니다.

batch timeout·부분 수신·client 취소 때 받은 메시지와 미수신 요청을 구분합니다. ACK는 내구 효과 뒤에 보내고, 큐가 포화되면 새 demand를 줄여야 합니다. message count가 같아도 큰 payload는 메모리 비용이 다릅니다.

## Replica 수·Quorum 비용·장애 독립성

replicas=3 stream은 정상 프로토콜에서 통신 가능한 과반으로 변경을 확정하도록 구성할 수 있어 하나 손실을 견딜 여지가 있습니다. 두 replica를 잃으면 하나가 데이터를 갖고 있어도 일반 쓰기가 멈출 수 있습니다. 같은 host·rack·zone의 공통 장애면 사본 숫자만큼 독립성이 생기지 않습니다.

한 replica만 느리고 과반이 빠른 경우와 과반이 느린 경우는 PubAck 지연·장애 여유가 다릅니다. 실제 leader·replica lag·quorum 응답·재동기화·디스크·network를 관찰합니다. stream과 consumer 상태의 복제 설정도 따로 확인합니다. memory storage·file storage·fsync·OS page cache는 다른 복구 조건입니다.

재현 시나리오는 broker가 저장한 뒤 PubAck만 버리고, 생산자가 같은 message ID로 조회·재시도하는 경우입니다. 예상 결과는 저장 결과가 확인되면 새 메시지를 만들지 않는 것이며, dedup window 밖의 재시도는 별도 원장 멱등성 없이는 중복을 막지 못한다는 것입니다. 이 작업에서는 broker 실행을 하지 않았으므로 설정·버전별 동작은 운영 환경에서 확인해야 합니다.

## PubAck 유실과 저장 결과 불확정성

leader가 바뀌는 순간 메시지는 저장됐지만 그 확인 응답만 사라질 수 있습니다. 이때는 같은 message ID와 broker가 지원하는 dedup window, 저장 결과를 조회할 경로를 사용해 재시도하고, 매번 새 ID를 만들어 중복 발행하지 않습니다. broker의 생산 중복 제거 창은 외부 DB가 재생될 수 있는 최대 기간까지 대신 보장하지 않습니다.

정상 응답 ID와 불확정 ID를 구분해 복구 stream과 대조합니다. PubAck는 consumer 처리가 끝났다는 뜻이 아니고 consumer ACK도 외부 효과와 자동 원자 transaction이 아닙니다. 현재 작업에서는 NATS·JetStream을 실행하지 않았으며 본문은 저장·소비·복제 계약의 설명입니다.
