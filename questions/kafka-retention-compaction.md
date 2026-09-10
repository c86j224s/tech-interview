---
id: kafka-retention-compaction
title: "Kafka에 오래된 이벤트를 정리하면서 키별 최신 상태는 남기려 합니다. 시간·크기 기반 retention과 log compaction은 무엇을 각각 보존하나요?"
answerMinutes: 5
followups: [{"id":"kafka-partition-offset","prompt":"compaction으로 중간 레코드가 삭제돼도 offset을 처리 완료 번호로 볼 수 없는 이유는 무엇인가요?"},{"id":"jetstream-durable-consumer","prompt":"보관 한도를 넘긴 durable consumer를 snapshot으로 어떻게 복구하나요?"},{"id":"transactional-outbox","prompt":"이력과 최신 상태를 원본 DB와 Kafka topic에 어떻게 나누어 보관하나요?"}]
difficulty: 하
category: 분산 시스템
tags: ["Kafka","retention","compaction"]
related: ["kafka-partition-offset"]
---

# Kafka에 오래된 이벤트를 정리하면서 키별 최신 상태는 남기려 합니다. 시간·크기 기반 retention과 log compaction은 무엇을 각각 보존하나요?

## 구두 답변

시간·크기 retention은 partition의 오래된 segment를 지워 기간·디스크를 제한하고, log compaction은 같은 key의 오래된 record를 정리해 최신 상태를 재구성하게 합니다. segment와 백그라운드 정리 시점 때문에 레코드 하나씩 정확히 삭제되거나 즉시 key당 한 개만 남는 것은 아닙니다.

### 이력과 최신 상태

주문 `pending → paid → shipped`의 전이를 분석해야 하면 compaction만으로 부족합니다. 재시작 때 key별 최신 상태를 복원하는 changelog에는 적합합니다. tombstone은 key의 삭제를 나타내지만 일정 기간 뒤 정리될 수 있어 오래 중단한 consumer가 놓치면 snapshot이 필요합니다.

delete retention을 함께 두면 최신 상태도 시간·크기 정책으로 사라질 수 있습니다. “영구 보관”을 가정하지 않고 snapshot·최대 중단 시간·원본 재구축을 정합니다. null key와 key가 있지만 null value인 tombstone을 구분합니다. 검증은 compact 전후, tombstone 만료, 장기 중단과 상태 복원을 시험합니다.

### 삭제와 최신값의 의미

key=account42에 값 10,20,30이 순서대로 있으면 compaction 후 최신값 30으로 상태를 재구축할 수 있지만, 한동안 이전 값도 남아 있을 수 있습니다. compaction은 백그라운드로 진행하고 offset을 다시 매기지 않습니다. 그래서 10 다음에 15가 나와도 중간 번호가 반드시 미처리 누락이라는 뜻은 아닙니다. consumer는 실제 로그 위치를 따르고 배열 길이처럼 해석하지 않아야 합니다.

같은 키에 null value를 쓰는 tombstone은 삭제를 표현합니다. null key는 식별할 상태 키가 없는 경우이며 tombstone과 다릅니다. compacted topic은 null key 레코드를 허용하는지 생산 오류를 포함해 실제 계약을 확인해야 합니다. tombstone 보존 시간이 지나면 삭제 표시도 정리될 수 있어 오래 중단한 기존 캐시가 옛 값을 계속 가지고 있지 않도록 복구 정책이 필요합니다.

### 전체 이력과 상태 재구축

주문이 대기→결제→배송으로 변한 모든 전이를 감사하려면 append 이력을 보관해야 합니다. 최신 상태만 남기는 topic은 배송이라는 최종 상태를 보여 줄 수 있지만 결제 시도 횟수나 중간 취소를 복원하지 못합니다. 두 목적이 필요하면 원본 이벤트 로그와 현재 상태 changelog를 분리하고 보관기간·접근권한을 다르게 둡니다.

compact와 delete를 함께 사용하면 키별 최신 레코드도 시간·크기 정책으로 제거될 수 있으므로 영구 상태 저장소라고 생각하면 안 됩니다. 최대 consumer 중단 시간과 초기 재구축 소요 시간이 보관 한도 안에 드는지 계산합니다. 전체 스냅샷을 쓰면 스냅샷 기준 로그 위치 이후의 이벤트를 놓치지 않게 연결하고, 삭제 이벤트를 적용하는 순서를 검증합니다.

시험에서는 같은 키 반복 변경, tombstone 전후 중단, compaction 진행 중 읽기, 보관 시작점보다 오래된 offset으로 재시작을 나눕니다. 로그 파일 크기 감소뿐 아니라 원본 상태와 복구된 키 집합·삭제 상태가 같은지가 성공 기준입니다. 정리 작업 자체의 디스크 I/O와 생산·소비 p99 영향도 별도로 측정하겠습니다.

## 득점 포인트

- segment와 key 기준을 나눈다.
- tombstone과 정리 지연을 설명한다.
- 이력과 최신 상태 저장 목표를 분리한다.
- 장기 복구를 검증한다.

## 감점 포인트

- 즉시 key당 한 개만 남는다.
- tombstone이 영구 보존된다.
- 정리 로그를 연속 배열로 본다.

## 더 파고들 거리

- tombstone 복구
- compact·delete 시간 한계
- null key 차이
