---
id: "normal-form-all-candidate-keys"
title: "후보키가 여러 개인 테이블의 2NF·3NF를 검사합니다. 기본키 하나만 보면 어떤 종속을 놓치나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["1NF","2NF","3NF","부분 함수 종속","이행 함수 종속","심화 질문"]
related: ["normal-forms-partial-transitive","functional-dependency-keys","normalization-anomalies"]
promotedFrom: {"id":"normal-forms-partial-transitive","prompt":"여러 후보키에서 2NF·3NF를 검사해 보세요."}
---

# 후보키가 여러 개인 테이블의 2NF·3NF를 검사합니다. 기본키 하나만 보면 어떤 종속을 놓치나요?

## 구두 답변

2NF는 비주요 속성이 모든 후보키의 진부분에 종속되는지 확인해야 하고 3NF는 비자명 X→A에서 X가 superkey이거나 A가 주요 속성인지 봅니다. 선택한 PK 하나만 검사하면 다른 후보키의 위반을 놓칩니다.

함수 종속에서 폐포·최소성을 계산하고 업무 규칙과 일치하는지 확인합니다. 단일 열 PK를 추가했다고 원래 종속과 정규형 문제가 사라지지는 않습니다.

## 득점 포인트

- 2NF는 비주요 속성이 모든 후보키의 진부분에 종속되는지 확인해야 하고 3NF는 비자명 X→A에서 X가 superkey이거나 A가 주요 속성인지 봅니다. 선택한 PK 하나만 검사하면 다른 후보키의 위반을 놓칩니다.
- 단일 열 PK를 추가했다고 원래 종속과 정규형 문제가 사라지지는 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 2NF는 비주요 속성이 모든 후보키의 진부분에 종속되는지 확인해야 하고 3NF는 비자명 X→A에서 X가 superkey이거나 A가 주요 속성인지 봅니다.

## 더 파고들 거리

- [기본 상황과 비교: 주문 상세에 상품명·수량·고객번호·고객명을 함께 저장해 값이 반복됩니다. 어떤 함수 종속을 확인하고 1NF·2NF·3NF에 맞춰 테이블을 어떻게 나누나요?](/tech-interview/questions/normal-forms-partial-transitive/)
