---
id: "old-transaction-version-retention"
title: "가장 오래된 transaction 하나가 버전 저장소를 키웁니다. 읽기 수명과 정리 지연을 어떤 지표로 연결하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["MVCC","격리 수준","스냅샷","심화 질문"]
related: ["db-mvcc-snapshot","transaction-and-lost-update"]
promotedFrom: {"id":"db-mvcc-snapshot","prompt":"버전 저장소와 가장 오래된 트랜잭션 지표를 연결해 보세요."}
---

# 가장 오래된 transaction 하나가 버전 저장소를 키웁니다. 읽기 수명과 정리 지연을 어떤 지표로 연결하나요?

## 구두 답변

오래된 snapshot이 이전 버전을 계속 필요로 하면 정리 기준이 전진하지 못합니다. 최장 transaction 시각·버전 저장량·vacuum 또는 undo 정리 지연을 연결합니다.

읽기 전용이라고 비용이 없지 않으며 report·유휴 transaction·replication feedback을 구분합니다. 작은 snapshot 추출이나 별도 분석 경로를 검토하되 필요한 일관성을 유지합니다. 오래된 독자를 끝낸 뒤 재사용 공간과 실제 파일 축소 시점도 따로 봅니다.

## 득점 포인트

- 오래된 snapshot이 이전 버전을 계속 필요로 하면 정리 기준이 전진하지 못합니다. 최장 transaction 시각·버전 저장량·vacuum 또는 undo 정리 지연을 연결합니다.
- 오래된 독자를 끝낸 뒤 재사용 공간과 실제 파일 축소 시점도 따로 봅니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 오래된 snapshot이 이전 버전을 계속 필요로 하면 정리 기준이 전진하지 못합니다.

## 더 파고들 거리

- [기본 상황과 비교: 긴 조회와 갱신이 동시에 실행되는 DB에서 MVCC를 사용합니다. 읽는 데이터의 시점은 어떻게 정해지며, 읽기와 쓰기의 대기나 유지 비용이 모두 사라지나요?](/tech-interview/questions/db-mvcc-snapshot/)
