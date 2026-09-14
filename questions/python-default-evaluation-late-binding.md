---
id: "python-default-evaluation-late-binding"
title: "가변 기본값 공유와 closure의 late binding은 값이 결정되는 시점에서 어떻게 다른가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Python","기본 인자","mutable","리스트","심화 질문"]
related: ["python-mutable-default"]
promotedFrom: {"id":"python-mutable-default","prompt":"기본값 평가 시점과 클로저의 late binding은 어떤 실행 시점 차이가 있나요?"}
---

# 가변 기본값 공유와 closure의 late binding은 값이 결정되는 시점에서 어떻게 다른가요?

## 구두 답변

기본 인자 표현식은 함수 정의 시 평가되어 가변 객체가 여러 호출에 공유될 수 있습니다. closure는 바인딩을 캡처해 실행 시 그 현재 값을 읽는 late binding을 만들 수 있어 원인이 다릅니다.

None sentinel로 호출별 객체를 만들거나 기본 인자 캡처로 특정 값을 고정할 수 있지만 그 값이 가변 참조이면 내부 공유는 남습니다. 정의·루프·호출 시점을 나눈 예제로 확인합니다.

## 득점 포인트

- 기본 인자 표현식은 함수 정의 시 평가되어 가변 객체가 여러 호출에 공유될 수 있습니다. closure는 바인딩을 캡처해 실행 시 그 현재 값을 읽는 late binding을 만들 수 있어 원인이 다릅니다.
- 정의·루프·호출 시점을 나눈 예제로 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 기본 인자 표현식은 함수 정의 시 평가되어 가변 객체가 여러 호출에 공유될 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Python 함수의 기본 인자를 빈 리스트로 뒀는데 이전 호출에서 추가한 값이 다음 호출에도 남습니다. 기본값 객체는 언제 만들어지며 어떻게 고치나요?](/tech-interview/questions/python-mutable-default/)
