---
id: kafka-partition-offset
title: "Kafka 메시지의 offset을 처리 완료 번호처럼 저장하려 합니다. topic·partition·offset은 무엇을 식별하며, 메시지 위치와 실제 처리 완료는 왜 구분해야 하나요?"
answerMinutes: 5
followups: [{"id":"kafka-rebalance-processing","prompt":"partition 반납 때 마지막으로 읽은 위치가 아니라 어느 offset까지만 commit하나요?"},{"id":"kafka-partition-expansion","prompt":"partition 수 변경 뒤 같은 키의 offset과 논리 순서는 어떻게 달라지나요?"},{"id":"message-ordering-scope","prompt":"partition 내 전달 순서를 최종 적용 순서로 이어가려면 어떤 자료구조가 필요할까요?"}]
difficulty: 하
category: 분산 시스템
tags: ["Kafka","partition","offset"]
related: ["message-ordering-scope"]
---

# Kafka 메시지의 offset을 처리 완료 번호처럼 저장하려 합니다. topic·partition·offset은 무엇을 식별하며, 메시지 위치와 실제 처리 완료는 왜 구분해야 하나요?

## 구두 답변

Kafka topic은 논리 이름이고 partition은 독립 append 로그입니다. offset은 해당 partition 안 위치이므로 `topic + partition + offset`으로 레코드를 가리킵니다. 서로 다른 partition offset을 비교해 전역 순서나 처리 완료를 만들 수 없습니다.

### 위치와 효과

읽은 offset, 외부 DB commit, group offset commit, client 응답은 다른 상태입니다. DB를 먼저 commit하고 offset 전에 죽으면 재처리되고 offset을 먼저 commit하면 DB 효과가 빠질 수 있습니다. inbox·멱등 키·대사가 필요합니다. account key를 같은 partition에 보내도 partition 수·파티셔너 변경으로 목적지가 바뀔 수 있어 논리 sequence·세대가 필요합니다.

partition 수는 병렬성뿐 아니라 키 편중·broker metadata·파일·복구·rebalance·DB 처리량·retention을 봅니다. compaction·retention으로 중간 레코드가 삭제돼 offset이 배열 인덱스처럼 연속적이지 않아도 됩니다. 검증은 DB commit 직후·offset commit 직전 중단, partition별 지연·재시작을 주입해 위치와 외부 효과를 분리합니다.

### 커밋 값은 다음에 읽을 위치입니다

partition 0의 offset 10을 처리했고 11은 아직 처리하지 않았다면 일반적으로 11을 커밋해 재시작 시 그 위치부터 읽습니다. 10을 커밋하면 이미 끝낸 레코드를 다시 읽을 수 있고, 12를 커밋하면 11을 건너뛸 수 있습니다. 여러 워커가 처리할 때는 반환 순서가 아니라 성공한 연속 처리 구간의 다음 위치를 기록해야 합니다. 로그에 삭제된 offset 구간이 있으면 숫자가 하나씩 모두 존재한다고 가정하지 않고 실제 전달된 레코드 순서와 소비자 위치를 기준으로 관리합니다.

partition 0의 offset 100과 partition 1의 offset 200은 두 독립 로그의 위치입니다. 200이 더 늦은 사건이거나 더 최신 계정 상태라는 뜻이 아닙니다. topic을 삭제하고 같은 이름으로 새로 만들거나 다른 클러스터로 옮기면 이름·partition·offset 조합도 영구적인 업무 ID가 아닐 수 있습니다. 주문 ID·이벤트 ID와 저장 위치를 구분해야 합니다.

### 시작 위치와 보관 한도

커밋 위치가 없거나 보관 범위 밖이면 auto.offset.reset 같은 클라이언트 정책이 적용될 수 있습니다. earliest는 남아 있는 가장 오래된 위치이지 서비스 시작 이후 모든 기록이 아닙니다. latest는 새 데이터부터 읽으므로 누락을 감수하는 초기화일 수 있습니다. 중요한 소비자는 위치 손실을 조용히 초기화하지 않고 스냅샷 복구와 재생 기준을 명시하겠습니다.

DB 처리와 offset 저장을 원자적으로 묶을 수 없다면 DB 변경·처리 ID를 같은 트랜잭션에 저장하고 offset은 그 뒤 전진시킵니다. 재시작 뒤 다시 받은 레코드는 처리 ID로 건너뛰되 결과가 실제로 커밋됐는지 확인합니다. position이 빠르게 늘어도 워커 큐에 쌓일 수 있으므로 fetch 위치, 커밋 위치, 최종 적용 위치를 각각 관측해야 합니다.

재처리할 때 offset을 뒤로 돌리는 것만으로 과거 외부 효과가 취소되지는 않습니다. 동일 이벤트의 멱등성과 보존된 처리 이력, 스키마 버전 호환성을 확인한 후 재생해야 하며, 감사용 이력과 현재 상태 재구축의 목적도 분리하겠습니다.

## 득점 포인트

- offset의 식별 범위를 분리한다.
- 읽기·DB·commit을 나눈다.
- 논리 ID와 broker 위치를 구분한다.
- 정리 로그와 재처리를 검증한다.

## 감점 포인트

- offset을 전역 순서로 본다.
- offset commit이 DB 성공을 뜻한다.
- 증설 뒤 키 목적지가 유지된다고 말한다.

## 더 파고들 거리

- offset 빈 구간
- 키 없는 레코드
- 재처리 순서 테스트
