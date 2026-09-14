---
id: "closure-private-class-field-testing"
title: "클로저의 private 상태와 class private field를 테스트합니다. 내부 표현을 고정하지 않고 어떤 외부 계약을 검증하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","클로저","스코프","var","let","심화 질문"]
related: ["js-closure-loop","js-hoisting-tdz"]
promotedFrom: {"id":"js-closure-loop","prompt":"클로저 private 상태와 class private field의 테스트 경계를 어떻게 비교할까요?"}
---

# 클로저의 private 상태와 class private field를 테스트합니다. 내부 표현을 고정하지 않고 어떤 외부 계약을 검증하나요?

## 구두 답변

둘 다 내부 상태 접근을 제한할 수 있지만 테스트는 가능한 한 공개 입력·결과·예외·상태 전이를 검증합니다. private 변수 이름이나 객체 배치를 고정하면 정상 리팩터링에 취약해집니다.

시간·네트워크·저장소는 의미 있는 경계로 주입하고 내부 계산은 작은 순수 함수로 나눌 수 있습니다. private이 thread-safe나 외부 transaction 원자성을 보장하지는 않습니다. 여러 인스턴스·callback 수명·실패를 시험합니다.

## 득점 포인트

- 둘 다 내부 상태 접근을 제한할 수 있지만 테스트는 가능한 한 공개 입력·결과·예외·상태 전이를 검증합니다. private 변수 이름이나 객체 배치를 고정하면 정상 리팩터링에 취약해집니다.
- 여러 인스턴스·callback 수명·실패를 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 둘 다 내부 상태 접근을 제한할 수 있지만 테스트는 가능한 한 공개 입력·결과·예외·상태 전이를 검증합니다.

## 더 파고들 거리

- [기본 상황과 비교: 반복문 안에서 만든 콜백이 마지막 값만 출력합니다. var와 let의 클로저 캡처는 왜 다르게 보이나요?](/tech-interview/questions/js-closure-loop/)
