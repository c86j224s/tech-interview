---
id: messaging-ownership
title: 메시징 수명·운영 Owner·관리형 Queue 총비용
topic: 설계
summary: Core/JetStream·Kafka group·SQS 작업/순서 모델을 비교하고 외부 효과·RPC와 event owner·retention·재처리·요청/보관/이동/운영 비용을 설명합니다.
questionIds: [messaging-tool-choice, rpc-event-log-team-ownership, managed-queue-full-cost]
---

# 메시징 수명·운영 Owner·관리형 Queue 총비용

## 메시지 방송과 작업 분배의 전달 모델

worker 20개가 주문 작업을 나누는 것과 분석·알림·검색 service가 같은 주문 event를 각각 읽는 것은 다른 요구입니다. 하나의 queue/consumer group을 공유하면 작업 분배가 될 수 있지만 각 service 독립 전달을 보장하지 않습니다. 구독/group·재생 위치·보관을 목적에 맞게 나눕니다.

| 모델 | 적합한 요구 후보 | 반드시 확인할 경계 |
| --- | --- | --- |
| Core NATS | 연결된 subscriber의 즉시 알림·request/reply | durable replay 없음·slow consumer |
| JetStream | 저장·Ack·재전달·재생 | stream/consumer 정책·dedup·수명 |
| Kafka | partition log·독립 group의 보관 내 재생 | 순서 범위·offset·retention·rebalance |
| SQS | 관리형 작업 분배·visibility·DLQ | Standard/FIFO 차이·중복·처리 상한 |

제품 이름만으로 전역 순서·정확히 한 번 효과를 약속하지 않습니다. Core와 JetStream은 다른 보장이며 SQS FIFO의 dedup도 외부 DB commit과 메시지 삭제를 원자화하지 않습니다. Kafka partition 내 순서가 worker 병렬 처리의 완료 순서까지 자동 보장하지도 않습니다.

## Broker 확인과 업무 완료의 경계

consumer가 선택한 진행 경계인 Ack·offset commit·message delete를 실제 효과를 적용하거나 업무 원장을 갱신하기 전에 보내면, 그 직후 process가 멈출 때 broker는 이미 처리된 것으로 보고 작업을 다시 주지 않을 수 있습니다. 반대로 효과를 적용한 뒤 해당 Ack·offset commit·message delete가 유실되면 같은 메시지가 재전달되므로, consumer는 안정적인 event/업무 ID로 조건부 갱신을 하고 처리 원장이나 외부 idempotency로 중복 효과를 막습니다.

visibility 만료가 있는 전달 모델에서는 제한 시간이 끝나기 전에 visibility 연장이나 broker의 진행 확인이 성공하지 않으면 같은 작업이 동시에 실행될 수 있으므로, 그 경우도 업무 원장에서 다룹니다. 따라서 broker에 진행을 알리는 확인과 실제 업무 완료는 같은 사건으로 취급하지 않습니다.

```diagram
{"title":"생산·전달·외부 효과의 책임은 나뉩니다","caption":"화살표는 사건 흐름입니다. broker 운영자가 업무 원장의 중복·projection 정확성을 자동 보장하지 않습니다.","rows":[[{"id":"producer","label":"Producer owner · 원본·schema"}],[{"id":"broker","label":"Broker owner · 전달·보관·가용성"}],[{"id":"consumer","label":"Consumer owner · 위치·재처리"}],[{"id":"effect","label":"업무 owner · 효과·dedup·대사"}]],"edges":[{"from":"producer","to":"broker","label":"생산 확인 계약"},{"from":"broker","to":"consumer","label":"순서·재전달 범위"},{"from":"consumer","to":"effect","label":"실제 완료 확인"}]}
```

## RPC와 장기 Log의 Owner 책임

RPC 제공자는 deadline·오류·인가·멱등·결과 조회, caller는 제한된 retry·남은 budget·응답 해석을 맡습니다. 장기 event producer는 원본 의미·schema 진화·발행 누락, consumer는 offset·projection·재생·중복/순서·DLQ를 맡습니다. broker 팀은 storage·retention 집행·가용성을 관리하되 업무 정확성까지 자동 소유하지 않습니다.

원본 데이터 owner·schema 승인자·retention 비용 owner·재처리 승인·경보 대응·복구 훈련 책임을 계약에 둡니다. 즉시 RPC와 event로 같은 사실이 오면 어느 쪽이 권위이고 어떻게 안정 ID·version으로 합칠지 정합니다. 새 consumer로 오래된 event를 읽는 호환 시험도 필요합니다.

## 관리형 Queue의 호출·보관·소비 비용

관리형 queue 비용을 계산할 때는 논리 작업 수만 곱하지 말고, 생산·receive·delete뿐 아니라 empty poll, visibility 연장, retry, DLQ 이동/재처리 API 호출을 각각 셉니다. provider가 청구하는 bytes 단위와 보관·cross-region transfer·암호화/API 부가 비용, consumer compute를 계약에 대입하고, duplicate로 DB·외부 API가 추가 호출되는 비용도 더합니다.

이렇게 해야 메시지 한 건의 업무 비용과 broker 호출·보관·소비 비용을 같은 계산에 넣을 수 있습니다.

예를 들어 논리 작업 100만 개의 평균 전달 시도가 1.2회라면 소비 처리는 약 120만 회이며 빈 poll·삭제 재시도는 별도입니다. batch는 호출 수를 줄일 수 있지만 대기 지연·큰 payload·부분 성공·재시도 단위가 달라집니다. 제품별 실제 과금 단위를 하나의 보편 가격 공식으로 단정하지 않습니다.

## 동일 보장 조건과 Workload 비교

같은 retention·group 수·payload·순서·복구/SLO 기준에서 생산 확인 지연·효과 lag·Ack 유실·restart·보관 만료·이중 소비·전환 시작 위치를 시험합니다. 운영 인력·on-call·복구 drill·vendor 제약도 비용입니다. 이 노트는 선택 기준이며 실제 broker benchmark나 청구서 분석 결과는 아닙니다.
