---
id: "cpp-forwarding-reference-category"
title: "함수의 named rvalue reference는 왜 lvalue 표현식이며 perfect forwarding은 어떤 범주를 보존하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["C++","이동 의미론","소유권","심화 질문"]
related: ["cpp-move-semantics","cpp-raii-exception-safety"]
promotedFrom: {"id":"cpp-move-semantics","prompt":"perfect forwarding에서 named rvalue reference가 다시 lvalue가 되는 이유는 무엇인가요?"}
---

# 함수의 named rvalue reference는 왜 lvalue 표현식이며 perfect forwarding은 어떤 범주를 보존하나요?

## 구두 답변

변수 이름으로 참조하는 표현식은 선언 타입이 T&&여도 lvalue입니다. forwarding reference에서 템플릿 추론과 reference collapsing을 이용해 std::forward<T>로 원래 인자의 값 범주를 전달할 수 있습니다.

std::move는 무조건 rvalue로 취급하도록 변환하므로 lvalue 호출자 인자까지 소비할 수 있습니다. const가 남으면 일반 이동 생성자 대신 복사가 선택될 수 있습니다. forwarding은 수명을 연장하지 않으며 전달한 참조가 비동기로 남으면 dangling을 별도 방지해야 합니다.

## 득점 포인트

- 변수 이름으로 참조하는 표현식은 선언 타입이 T&&여도 lvalue입니다. forwarding reference에서 템플릿 추론과 reference collapsing을 이용해 std::forward<T>로 원래 인자의 값 범주를 전달할 수 있습니다.
- forwarding은 수명을 연장하지 않으며 전달한 참조가 비동기로 남으면 dangling을 별도 방지해야 합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 변수 이름으로 참조하는 표현식은 선언 타입이 T&&여도 lvalue입니다.

## 더 파고들 거리

- [기본 상황과 비교: C++에서 복사를 줄이려고 std::move를 붙였습니다. 어떤 경우에는 여전히 복사되며, 이동 뒤 원본은 어떻게 다뤄야 하나요?](/tech-interview/questions/cpp-move-semantics/)
