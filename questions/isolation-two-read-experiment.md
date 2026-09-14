---
id: "isolation-two-read-experiment"
title: "같은 transaction에서 두 번 읽는 사이 다른 세션이 커밋합니다. 격리 수준별 가시성을 어떻게 재현하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["MVCC","격리 수준","스냅샷","심화 질문"]
related: ["db-mvcc-snapshot","transaction-and-lost-update"]
promotedFrom: {"id":"db-mvcc-snapshot","prompt":"두 번 읽기 실험으로 격리 수준의 가시성을 비교해 보세요."}
---

# 같은 transaction에서 두 번 읽는 사이 다른 세션이 커밋합니다. 격리 수준별 가시성을 어떻게 재현하나요?

## 구두 답변

세션 A가 같은 값을 두 번 읽는 사이 B가 변경·commit하도록 실행 순서를 통제합니다. 문장별 snapshot인지 transaction snapshot인지, 잠금 읽기인지에 따라 두 번째 결과가 달라집니다.

READ COMMITTED라는 이름도 엔진·설정별 구현이 다르므로 버전과 옵션을 기록합니다. A의 자기 변경 관찰과 이후 UPDATE 충돌도 별도로 시험합니다. sleep 대신 barrier·완료 신호를 사용하고 실제 커밋 결과까지 검사합니다.

## 득점 포인트

- 세션 A가 같은 값을 두 번 읽는 사이 B가 변경·commit하도록 실행 순서를 통제합니다. 문장별 snapshot인지 transaction snapshot인지, 잠금 읽기인지에 따라 두 번째 결과가 달라집니다.
- sleep 대신 barrier·완료 신호를 사용하고 실제 커밋 결과까지 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 세션 A가 같은 값을 두 번 읽는 사이 B가 변경·commit하도록 실행 순서를 통제합니다.

## 더 파고들 거리

- [기본 상황과 비교: 긴 조회와 갱신이 동시에 실행되는 DB에서 MVCC를 사용합니다. 읽는 데이터의 시점은 어떻게 정해지며, 읽기와 쓰기의 대기나 유지 비용이 모두 사라지나요?](/tech-interview/questions/db-mvcc-snapshot/)
