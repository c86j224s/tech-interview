---
id: "go-type-assertion-typed-nil"
title: "Go 타입 assertion은 성공했는데 결과 포인터가 nil입니다. 타입 일치와 값의 존재를 어떻게 구분하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Go","인터페이스","nil","심화 질문"]
related: ["go-interface-typed-nil","go-slice-backing-array"]
promotedFrom: {"id":"go-interface-typed-nil","prompt":"타입 assertion 실패와 typed nil 성공을 호출자 API에서 어떻게 구분할까요?"}
---

# Go 타입 assertion은 성공했는데 결과 포인터가 nil입니다. 타입 일치와 값의 존재를 어떻게 구분하나요?

## 구두 답변

타입 assertion의 ok는 동적 타입이 기대 타입과 맞는지를 말합니다. 그 타입이 포인터이고 값이 nil인 경우 ok=true와 p=nil이 함께 가능합니다.

타입 불일치·typed nil·정상 객체를 별도 케이스로 처리합니다. assertion 성공 뒤 메서드가 nil을 허용하는지 확인하고 무오류 반환에서는 진짜 nil interface를 사용합니다. 로그 formatting 과정의 Error 호출도 포함해 테스트합니다.

## 득점 포인트

- 타입 assertion의 ok는 동적 타입이 기대 타입과 맞는지를 말합니다. 그 타입이 포인터이고 값이 nil인 경우 ok=true와 p=nil이 함께 가능합니다.
- 로그 formatting 과정의 Error 호출도 포함해 테스트합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 타입 assertion의 ok는 동적 타입이 기대 타입과 맞는지를 말합니다.

## 더 파고들 거리

- [기본 상황과 비교: Go에서 nil인 포인터를 error 변수에 넣었는데, 왜 err == nil은 false가 되나요?](/tech-interview/questions/go-interface-typed-nil/)
