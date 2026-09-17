---
id: pulsar-foundations
title: Pulsar 아키텍처와 구독
topic: 분산 시스템
summary: Pulsar의 broker·metadata store·BookKeeper·managed ledger와 subscription cursor를 하나의 발행·소비 상태 전이로 추적합니다.
questionIds: []
prerequisites: [data-system-foundations]
related: [kafka-replication-acks, kafka-consumer-offset, kafka-partition-order, kafka-retained-state]
reviewedAt: '2026-09-17'
---

# Pulsar 아키텍처와 구독

## 문제 범위와 기본 용어

Apache Pulsar를 처음 읽을 때는 메시지를 전달하는 경로와 메시지를 오래 보관하는 경로를 먼저 분리해야 합니다. producer는 topic에 메시지를 발행하고 broker는 연결, 요청 처리, topic 소유권, consumer dispatch를 맡습니다. persistent message storage는 Apache BookKeeper가 담당하며, broker의 요청 처리가 곧 저장 완료를 뜻하지는 않습니다.

여기서 **ledger**는 하나의 writer 수명 동안 순차적으로 append되는 저장 단위입니다. 하나의 topic은 시간이 지나며 이어지는 여러 ledger를 논리적으로 묶은 **managed ledger**로 다뤄집니다. **cursor**는 subscription이 어디까지 확인했는지를 나타내는 진행 위치입니다. 이 용어들은 “메시지가 어느 컴포넌트에 도착했는가”가 아니라 서로 다른 상태 경계를 가리킵니다.

따라서 “broker가 요청을 받았다”, “BookKeeper에 기록됐다”, “producer가 성공 응답을 받았다”, “consumer의 업무 효과가 끝났다”는 별개의 사건입니다. 이 네 사건을 하나의 성공 플래그로 합치면, 장애 뒤 재시도해야 할 대상과 이미 끝난 대상을 가를 수 없습니다.

## 발행 경로와 저장 경계

producer는 topic의 소유 broker를 찾은 뒤 그 broker에 발행 요청을 보냅니다. 한 시점에 topic을 소유하는 broker는 하나이며, 다른 broker가 요청을 받으면 소유자에게 요청을 돌려보낼 수 있습니다. 이 소유권은 사용자 레코드의 복제본 수가 아니라 요청을 조정하고 dispatch할 broker를 정하는 상태입니다.

broker는 연결, 인증 뒤의 요청 처리, topic ownership, consumer dispatch 같은 앞단 역할을 담당합니다. 공식 아키텍처 문서는 이 경계를 broker의 stateless한 역할로 설명합니다. BookKeeper의 bookie는 ledger 데이터를 보관하고, managed ledger는 여러 ledger를 하나의 topic 흐름으로 보여 줍니다.

BookKeeper 관리 문서가 설명하는 기본 경계에서는 bookie가 데이터를 디스크에 동기화한 뒤 broker에 저장 확인을 돌려주는 흐름이 있습니다. 이것은 **bookie에서 broker로 올라오는 저장 확인**입니다. 이 문서만으로 그 확인과 broker가 producer에 보내는 최종 응답의 정확한 시점을 동일시하거나, consumer DB commit까지 확인했다고 말해서는 안 됩니다.

```diagram
{"title":"발행과 소비의 저장 경계","caption":"한 메시지의 발행 요청, 영속 저장, subscription 전달, 업무 효과를 서로 다른 checkpoint로 표시합니다.","rows":[[{"id":"producer","label":"Producer","detail":["topic 발행 요청","응답 대기"]}],[{"id":"owner","label":"Topic owner broker","detail":["소유권 확인","요청 redirection"]},{"id":"meta","label":"Metadata store","detail":["coordination 상태"]}],[{"id":"ledger","label":"BookKeeper ledger","detail":["append-only 기록","영속 저장"]}],[{"id":"cursor","label":"Subscription cursor","detail":["미확인 위치","영속 진행 상태"]}],[{"id":"consumer","label":"Consumer 효과","detail":["업무 처리","별도 DB 경계"]}]],"edges":[{"from":"producer","to":"owner","label":"발행 요청"},{"from":"owner","to":"meta","label":"ownership 조회"},{"from":"owner","to":"ledger","label":"append 요청"},{"from":"ledger","to":"cursor","label":"읽을 위치 유지"},{"from":"cursor","to":"consumer","label":"delivery"}]}
```

## 역할과 장애 도메인

metadata store는 topic ownership과 클러스터 coordination에 필요한 상태를 보관합니다. 확인한 5.0.x 아키텍처 문서는 배포 맥락에 따라 Oxia, Apache ZooKeeper, RocksDB를 backend 선택지로 언급합니다. 이 글은 특정 backend의 설치나 권장 배포를 결정하지 않고, metadata coordination과 user message storage를 분리하는 모델만 사용합니다.

BookKeeper의 bookie는 ledger 데이터를 보관합니다. ledger writer가 닫히거나 장애가 나면 recovery 과정이 마지막 committed boundary를 정해 일관된 읽기 경계를 만듭니다. broker가 살아 있다는 사실만으로 모든 bookie의 writer 상태가 정상이라는 뜻은 아니며, metadata ownership 복구와 ledger readable boundary 복구도 같은 사건이 아닙니다.

ensemble 크기를 `E`, write quorum을 `Qw`, acknowledgment quorum을 `Qa`라고 하면 확인한 관리 문서의 관계는 `E >= Qw >= Qa`입니다. `E`는 기록에 참여하도록 구성한 범위, `Qw`는 기록을 쓰는 범위, `Qa`는 확인을 기다리는 범위를 모델링합니다. 이 식은 quorum 관계를 설명하는 입력이지, 모든 장애 도메인에서 원하는 내구성이나 복구 시간을 보장하는 숫자 추천이 아닙니다.

AutoRecovery는 사용할 수 없는 bookie의 데이터를 다른 bookie로 rereplication하는 역할을 합니다. 장애가 발생한 시각, under-replication이 관측된 시각, rereplication이 끝난 시각을 따로 기록해야 합니다. “복제가 설정되어 있다”와 “현재 모든 ledger가 목표 상태다”는 서로 다른 문장입니다.

## Managed Ledger와 Cursor 진행

managed ledger는 하나의 topic에 속한 successive ledger들을 논리적으로 연결합니다. 현재 ledger가 한계에 도달하거나 닫히면 다음 ledger가 이어지고, consumer는 애플리케이션에서 각 ledger를 직접 이어 붙이지 않아도 연속된 topic 흐름을 읽습니다. ledger rollover는 topic의 논리적 연속성을 바꾸지 않지만, 저장 수명과 recovery 관찰 단위는 바꿉니다.

subscription cursor는 consumer가 확인한 진행 위치를 나타냅니다. durable subscription의 위치와 pending message 정보는 BookKeeper에 영속화되므로 broker 프로세스가 재시작해도 아직 확인하지 않은 데이터를 다시 찾을 수 있습니다. non-durable subscription은 broker가 멈출 때 cursor가 사라질 수 있으므로, 재시작 뒤 같은 지점부터 재생해야 하는 소비에는 적합하지 않습니다.

cursor가 앞으로 이동했다고 해서 이전 ledger가 즉시 삭제되는 것은 아닙니다. 다른 subscription의 cursor, retention, TTL, compaction, cleanup 지연 같은 정책이 함께 저장 수명에 영향을 줍니다. 그러므로 “subscription이 ACK했다”와 “로컬 저장 공간이 회수됐다”를 같은 지표로 읽지 않습니다.

## 구독 이름과 전달 범위

subscription name은 단순한 consumer 프로세스 이름이 아니라 진행 상태와 전달 소유권을 묶는 단위입니다. `orders`를 분석과 알림이 모두 받아야 한다면 `analytics-sub`과 `notifications-sub`처럼 subscription 이름을 분리해야 합니다. 같은 이름을 공유하면 두 consumer는 각각 전체 topic을 받는 것이 아니라 하나의 subscription 안에서 메시지를 나눕니다.

Pulsar의 네 가지 subscription family는 목적이 다릅니다.

| 유형 | 소비자 소유권 | 순서·사용 맥락 |
|---|---|---|
| Exclusive | 한 consumer만 활성 | 단일 처리 흐름 |
| Failover | 한 consumer가 활성, 대기 consumer 존재 | 장애 시 대체 |
| Shared | 여러 consumer에 메시지 분배 | 전체 순서 보장 없음 |
| Key_Shared | key 기준으로 consumer에 분배 | 같은 key의 동시 처리 범위 제한 |

Exclusive는 같은 subscription에 동시에 한 consumer만 소비하도록 합니다. Failover는 활성 consumer와 대기 consumer를 구분하므로, 평상시 병렬 처리와 같은 의미로 사용하면 안 됩니다. Shared는 여러 consumer에 메시지를 나누지만 ordering guarantee가 없습니다.

Key_Shared는 같은 key의 메시지를 한 consumer가 처리하는 범위를 제공하지만, membership 변화와 redelivery 조건이 순서에 영향을 줄 수 있습니다. 따라서 이를 topic 전체의 전역 순서나 외부 DB 효과의 원자 순서로 확대하지 않습니다. 업무 순서가 중요하면 key별 sequence와 저장소 조건부 갱신을 함께 설계해야 합니다.

## 단일 메시지 상태 전이

다음은 `orders` topic에 `E1`을 발행하고 `analytics-sub`이 읽는 교육용 추적입니다. `E=3, Qw=2, Qa=2`는 quorum 관계를 드러내기 위한 입력이며, 특정 배포의 권장값이나 실행 결과가 아닙니다.

| 시점 | 관찰 상태 | 완료의 의미 |
|---|---|---|
| t0 | producer가 owner broker에 E1 전송 | 요청이 broker 경로에 들어감 |
| t1 | 현재 managed ledger에 E1 append | ledger 기록 경계에 도달 |
| t2 | `Qa=2` 확인 경계 도달 | broker가 producer 응답을 준비할 수 있는 저장 경계 |
| t3 | `analytics-sub` pending에 E1 존재 | consumer가 아직 ACK하지 않음 |
| t4 | consumer가 분석 DB transaction commit | 외부 업무 효과가 확정됨 |
| t5 | individual ACK 전송 | 해당 메시지를 확인했다고 알림 |
| t6 | cursor 또는 mark-delete 진행 | subscription 진행 위치가 전진 |

`t2` 직후 consumer가 연결되지 않아도 producer는 저장 경계에 대한 성공을 관찰할 수 있습니다. `t4`와 `t5` 사이에 worker가 종료되면 E1은 다시 전달될 수 있습니다. 이때 broker의 전달 시도 횟수와 분석 DB의 논리 효과 횟수는 별도로 세어야 합니다.

individual ACK는 한 메시지를 확인합니다. cumulative ACK는 선택한 메시지와 그 앞선 메시지를 함께 확인할 수 있지만, 확인한 문서의 계약에서는 Shared와 Key_Shared에서 cumulative acknowledgment가 허용되지 않습니다. subscription mode에 맞는 ACK 형태를 사용해야 합니다.

## 재시작과 복구 위치

기존 durable subscription에 consumer가 합류하면 공식 client 문서에는 가장 이른 미확인 메시지부터 시작하는 경로가 설명됩니다. 새 subscription은 topic 끝에서 시작하는 기본 동작이 설명됩니다. 이 두 문장을 모든 reconnect 상황의 절대 규칙으로 일반화하지 말고, client 버전과 명시적 시작 위치 설정을 함께 확인해야 합니다.

broker owner가 바뀌면 새 owner가 metadata store의 ownership 상태를 기준으로 요청을 받을 수 있습니다. bookie 장애가 겹치면 ledger recovery와 rereplication이 별도로 진행됩니다. 안전한 복구 기록은 owner redirect, ledger readable boundary, subscription cursor, consumer effect를 각각 남기는 형태여야 합니다.

다음 관찰표는 “메시지가 사라졌다”는 신고를 단계별로 좁히는 방법입니다.

| 관찰 | 가능한 해석 | 다음 확인 |
|---|---|---|
| producer ACK 없음 | broker 연결·저장 확인·응답 유실이 불확실 | producer 오류와 owner 상태 |
| producer ACK 있음, pending 없음 | 새 subscription이 끝에서 시작했거나 ACK가 진행됨 | subscription 생성 시점·cursor |
| pending 있음, 효과 없음 | consumer 처리 실패 또는 backpressure | consumer 오류·처리 지연 |
| 효과 있음, pending 유지 | 효과 후 ACK 전 종료 가능 | event ID 중복 기록 |
| cursor 전진, 효과 없음 | ACK를 효과보다 먼저 보냈을 가능성 | ACK 위치와 DB transaction 순서 |

## 구현과 검증 경계

아래는 컴파일 가능한 Pulsar client 예제가 아니라, producer 저장 확인과 consumer 외부 효과를 분리하는 의사코드입니다. `db.commit` 실패와 `ack` 실패를 각각 처리하고, 재전달 뒤 동일한 `eventId`를 DB unique 경계에서 흡수한다는 핵심만 보여 줍니다. 실제 client의 builder, timeout, close, retry API는 고정한 client 버전에서 확인해야 합니다.

```pseudocode
NOTE: 설명용 의사코드. 실제 client의 메서드와 오류 타입은 버전별 확인이 필요합니다.
producerSend(event):
    result = producer.send(event)       # broker 저장 확인 범위를 기다림
    if result.success:
        return ACCEPTED_BY_BROKER       # consumer 효과 완료가 아님
    return RETRY_OR_FAIL(result.error)

consume(message):
    try:
        db.transaction:
            inserted = inbox.insert_unique(message.eventId, message.fingerprint)
            if inserted:
                apply_domain_effect(message)
                save_result(message.eventId)
            else:
                verify_same_fingerprint(message.eventId, message.fingerprint)
        consumer.ack(message)            # DB commit 뒤에만 ACK
    catch error:
        record_failure(message.eventId, error)
        consumer.nack_or_retry(message)  # 실제 retry 계약은 client 문서 확인
```

실행 환경에서는 consumer close가 이미 받은 작업을 취소한다고 가정하지 않습니다. DB transaction이 오래 걸리면 client의 receive buffer와 worker 수명을 제한하고, ACK timeout을 사용하는 경우 재전달과 동시 실행을 관측해야 합니다. 오래 실행 중인 외부 호출은 broker의 ACK 상태와 별도 수명으로 다뤄야 합니다.

## 참고 자료와 검증 범위

- [Pulsar Overview](https://pulsar.apache.org/docs/5.0.x/concepts-overview/): 확인일 2026-09-17, 5.0.x 문서 branch. BookKeeper 기반 persistent storage, geo-replication, 네 가지 subscription family의 공식 개요 근거입니다.
- [Architecture Overview](https://pulsar.apache.org/docs/5.0.x/concepts-architecture-overview/): 확인일 2026-09-17, 5.0.x 문서. stateless broker, metadata coordination, managed ledger, cursor, topic ownership, ledger recovery의 근거입니다.
- [Metadata store and BookKeeper administration](https://pulsar.apache.org/docs/5.0.x/administration-zk-bk/): 확인일 2026-09-17, 5.0.x 문서. durable data, disk synchronization, `E >= Qw >= Qa`, AutoRecovery rereplication의 근거입니다.
- [Pulsar Messaging](https://pulsar.apache.org/docs/5.0.x/concepts-messaging/): 확인일 2026-09-17, 5.0.x 문서. subscription family, durable cursor, ACK 형태와 순서 경계의 근거입니다.
- [Downloads](https://pulsar.apache.org/download/): 확인일 2026-09-17, checked snapshot에서 current stable 표기는 4.2.4이며 5.0.0-M2는 production용이 아닌 milestone입니다. 본문은 5.0.x를 stable 배포 버전이라고 주장하지 않습니다.
- 실제 Pulsar broker, BookKeeper, metadata store, client는 실행하지 않았습니다. 상태표와 의사코드는 문서 기반 예상 경계이며 실행 결과나 benchmark 결과가 아닙니다.
