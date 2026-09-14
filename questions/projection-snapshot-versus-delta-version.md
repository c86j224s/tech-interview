---
id: "projection-snapshot-versus-delta-version"
title: "읽기 모델의 늦은 이벤트를 버전으로 버립니다. 전체 상태 이벤트와 증분 이벤트는 왜 처리 조건이 다른가요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["반정규화","중복 데이터","갱신 책임","읽기 모델","심화 질문"]
related: ["denormalization-maintenance","normalization-anomalies","db-n-plus-one"]
promotedFrom: {"id":"denormalization-maintenance","prompt":"순서가 뒤집힌 갱신 이벤트를 버전으로 차단해 보세요."}
---

# 읽기 모델의 늦은 이벤트를 버전으로 버립니다. 전체 상태 이벤트와 증분 이벤트는 왜 처리 조건이 다른가요?

## 구두 답변

전체 상태 version 12는 그 상태에 필요한 이전 변경을 포함한다는 계약이면 11을 버릴 수 있습니다. +10 같은 delta는 12가 먼저 왔다고 11을 버리면 필요한 증가를 잃을 수 있습니다.

delta는 event ID로 중복을 제거하고 연속 sequence·buffer·snapshot 재동기화를 사용합니다. 독립 교환 가능한 연산인지도 업무 조건과 함께 확인합니다. 삭제·정정·누락 버전을 포함한 재생에서 원본 합계와 projection을 대조합니다.

## 득점 포인트

- 전체 상태 version 12는 그 상태에 필요한 이전 변경을 포함한다는 계약이면 11을 버릴 수 있습니다. +10 같은 delta는 12가 먼저 왔다고 11을 버리면 필요한 증가를 잃을 수 있습니다.
- 삭제·정정·누락 버전을 포함한 재생에서 원본 합계와 projection을 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 전체 상태 version 12는 그 상태에 필요한 이전 변경을 포함한다는 계약이면 11을 버릴 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 조회 속도를 위해 주문 요약에 상품명과 합계 금액을 복사하려 합니다. 중복을 안전하게 유지하려면 무엇을 정해야 하나요?](/tech-interview/questions/denormalization-maintenance/)
