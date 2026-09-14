---
id: messaging-ownership
title: 메시징 수명·운영 Owner·관리형 Queue 총비용
topic: 설계
summary: Core/JetStream·Kafka group·SQS 작업/순서 모델을 비교하고 외부 효과·RPC와 event owner·retention·재처리·요청/보관/이동/운영 비용을 설명합니다.
questionIds: [messaging-tool-choice, rpc-event-log-team-ownership, managed-queue-full-cost]
---

# 메시징 수명·운영 Owner·관리형 Queue 총비용

## 같은 메시지를 모두 읽는 것과 하나가 맡는 것은 다릅니다

worker 20개가 주문 작업을 나누는 것과 분석·알림·검색 service가 같은 주문 event를 각각 읽는 것은 다른 요구입니다. 하나의 queue/consumer group을 공유하면 작업 분배가 될 수 있지만 각 service 독립 전달을 보장하지 않습니다. 구독/group·재생 위치·보관을 목적에 맞게 나눕니다.

| 모델 | 적합한 요구 후보 | 반드시 확인할 경계 |
| --- | --- | --- |
| Core NATS | 연결된 subscriber의 즉시 알림·request/reply | durable replay 없음·slow consumer |
| JetStream | 저장·Ack·재전달·재생 | stream/consumer 정책·dedup·수명 |
| Kafka | partition log·독립 group의 보관 내 재생 | 순서 범위·offset·retention·rebalance |
| SQS | 관리형 작업 분배·visibility·DLQ | Standard/FIFO 차이·중복·처리 상한 |

제품 이름만으로 전역 순서·정확히 한 번 효과를 약속하지 않습니다. Core와 JetStream은 다른 보장이며 SQS FIFO의 dedup도 외부 DB commit과 메시지 삭제를 원자화하지 않습니다. Kafka partition 내 순서가 worker 병렬 처리의 완료 순서까지 자동 보장하지도 않습니다.

## Broker 확인과 실제 업무 완료를 분리합니다

Ack·offset commit·message delete는 consumer가 선택한 진행 경계입니다. 효과 전 확인하면 crash 때 일을 잃을 수 있고 효과 후 확인 유실이면 재전달됩니다. consumer는 안정 event/업무 ID·조건부 갱신·처리 원장·외부 idempotency를 사용합니다. visibility 만료로 같은 작업이 동시에 실행되는 경우도 다룹니다.

```diagram
{"title":"생산·전달·외부 효과의 책임은 나뉩니다","caption":"화살표는 사건 흐름입니다. broker 운영자가 업무 원장의 중복·projection 정확성을 자동 보장하지 않습니다.","rows":[[{"id":"producer","label":"Producer owner · 원본·schema"}],[{"id":"broker","label":"Broker owner · 전달·보관·가용성"}],[{"id":"consumer","label":"Consumer owner · 위치·재처리"}],[{"id":"effect","label":"업무 owner · 효과·dedup·대사"}]],"edges":[{"from":"producer","to":"broker","label":"생산 확인 계약"},{"from":"broker","to":"consumer","label":"순서·재전달 범위"},{"from":"consumer","to":"effect","label":"실제 완료 확인"}]}
```

## RPC와 장기 Log의 Owner를 명시합니다

RPC 제공자는 deadline·오류·인가·멱등·결과 조회, caller는 제한된 retry·남은 budget·응답 해석을 맡습니다. 장기 event producer는 원본 의미·schema 진화·발행 누락, consumer는 offset·projection·재생·중복/순서·DLQ를 맡습니다. broker 팀은 storage·retention 집행·가용성을 관리하되 업무 정확성까지 자동 소유하지 않습니다.

원본 데이터 owner·schema 승인자·retention 비용 owner·재처리 승인·경보 대응·복구 훈련 책임을 계약에 둡니다. 즉시 RPC와 event로 같은 사실이 오면 어느 쪽이 권위이고 어떻게 안정 ID·version으로 합칠지 정합니다. 새 consumer로 오래된 event를 읽는 호환 시험도 필요합니다.

## 관리형 요금은 Send 횟수만이 아닙니다

생산·receive·delete·empty poll·visibility 연장·retry·DLQ 이동/재처리 API, 청구 bytes 단위, 보관·cross-region transfer·암호화/API 부가 비용·consumer compute를 실제 provider 계약으로 계산합니다. duplicate 때문에 DB·외부 API가 더 사용된 비용도 포함합니다.

예를 들어 논리 작업 100만 개의 평균 전달 시도가 1.2회라면 소비 처리는 약 120만 회이며 빈 poll·삭제 재시도는 별도입니다. batch는 호출 수를 줄일 수 있지만 대기 지연·큰 payload·부분 성공·재시도 단위가 달라집니다. 제품별 실제 과금 단위를 하나의 보편 가격 공식으로 단정하지 않습니다.

## 동일 보장과 Workload에서 비교합니다

같은 retention·group 수·payload·순서·복구/SLO 기준에서 생산 확인 지연·효과 lag·Ack 유실·restart·보관 만료·이중 소비·전환 시작 위치를 시험합니다. 운영 인력·on-call·복구 drill·vendor 제약도 비용입니다. 이 노트는 선택 기준이며 실제 broker benchmark나 청구서 분석 결과는 아닙니다.
