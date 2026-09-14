---
id: jetstream-storage
title: JetStream Stream·Consumer·Retention·복제의 경계
topic: 분산 시스템
summary: Core 실시간 전달과 내구 저장을 구분하고 독립 durable·보관 정책·pull/push 상한·replica quorum·PubAck 유실·저장 복구를 설명합니다.
questionIds: [nats-core-jetstream, jetstream-durable-consumer, jetstream-retention-fanout-contract, jetstream-pull-push-demand, jetstream-stream-replication, jetstream-slow-replica-quorum, jetstream-leader-transition-timeout]
---

# JetStream Stream·Consumer·Retention·복제의 경계

## 연결이 없을 때 놓친 이벤트를 다시 읽어야 하나요?

Core NATS는 현재 연결된 publish·subscribe의 실시간 전달에 초점을 둡니다. 오프라인 subscriber를 위한 내구 재생을 기본 계약으로 하지 않습니다. 다음 snapshot으로 복구할 위치 알림에는 단순한 선택일 수 있지만 반드시 처리할 주문 사건에는 보관·재전달이 필요합니다.

JetStream은 subject 메시지를 stream에 저장하고 consumer의 전달·ACK·재생 상태를 관리합니다. 클라이언트 재연결 buffer나 일반 publish 반환이 stream의 PubAck와 같은 저장 확인은 아닙니다. 저장 확인 API·stream 포착 subject·저장 유형·복제·한도를 구성해야 합니다.

## Stream은 로그이고 Consumer는 소비 상태입니다

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

## Retention은 누가 ACK하면 무엇을 지울지 결정합니다

LimitsPolicy는 시간·개수·크기 한도로 보관하고, InterestPolicy는 관련 관심 consumer의 ACK를 기준으로 메시지 수명을 정합니다. 관심이 없던 시기에 들어온 메시지를 나중 새 consumer가 반드시 재생한다고 가정하지 않습니다. WorkQueuePolicy는 한 작업 소비 경로가 완료하면 제거하는 목적이며 겹치는 필터의 독립 소비자를 같은 메시지에 붙이는 fan-out과 맞지 않습니다.

어느 정책이든 설정한 한도·discard 정책·서버 버전을 확인합니다. stream에서 삭제된 메시지는 durable 위치만으로 복원할 수 없습니다. 재시작 때 consumer ACK floor·pending·redelivery와 stream 첫 보관 위치를 비교하고 보관 범위 밖이면 snapshot·원본 대사로 복구합니다. 최신부터 조용히 읽어 누락을 숨기지 않습니다.

## Pull도 무한 Prefetch하면 앱 큐가 됩니다

pull consumer는 필요한 batch·요청 수·만료를 조절하기 쉽고, push는 server 전달과 ACK·flow control·client buffer를 맞춰야 합니다. 둘 다 MaxAckPending·worker 수·DB pool·대기 바이트를 연결해야 합니다. 이미 받은 메시지의 실제 실행을 MaxAckPending이 강제 종료하지는 않습니다.

batch timeout·부분 수신·client 취소 때 받은 메시지와 미수신 요청을 구분합니다. ACK는 내구 효과 뒤에 보내고, 큐가 포화되면 새 demand를 줄여야 합니다. message count가 같아도 큰 payload는 메모리 비용이 다릅니다.

## Replica 세 개는 보관 사본과 Quorum 비용을 늘립니다

replicas=3 stream은 정상 프로토콜에서 통신 가능한 과반으로 변경을 확정하도록 구성할 수 있어 하나 손실을 견딜 여지가 있습니다. 두 replica를 잃으면 하나가 데이터를 갖고 있어도 일반 쓰기가 멈출 수 있습니다. 같은 host·rack·zone의 공통 장애면 사본 숫자만큼 독립성이 생기지 않습니다.

한 replica만 느리고 과반이 빠른 경우와 과반이 느린 경우는 PubAck 지연·장애 여유가 다릅니다. 실제 leader·replica lag·quorum 응답·재동기화·디스크·network를 관찰합니다. stream과 consumer 상태의 복제 설정도 따로 확인합니다. memory storage·file storage·fsync·OS page cache는 다른 복구 조건입니다.

## PubAck 유실은 저장 실패의 증명이 아닙니다

leader 전환 중 메시지가 저장됐지만 ACK만 유실될 수 있습니다. 안정된 message ID와 지원 dedup window·결과 조회 경로로 재시도하고 매번 새 ID로 발행하지 않습니다. broker의 생산 dedup 창이 외부 DB의 최대 재생 기간을 대신하지 않습니다.

정상 응답 ID와 불확정 ID를 구분해 복구 stream과 대조합니다. PubAck는 consumer 처리가 끝났다는 뜻이 아니고 consumer ACK도 외부 효과와 자동 원자 transaction이 아닙니다. 현재 작업에서는 NATS·JetStream을 실행하지 않았으며 본문은 저장·소비·복제 계약의 설명입니다.
