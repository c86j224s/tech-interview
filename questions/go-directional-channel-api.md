---
id: "go-directional-channel-api"
title: "Go 함수에 송신 전용·수신 전용 채널을 전달합니다. 타입이 제한하는 동작과 close 소유권은 어떻게 다른가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Go","채널","취소","심화 질문"]
related: ["go-channel-close-ownership","goroutine-lifecycle-and-leaks","deadline-cancellation-propagation"]
promotedFrom: {"id":"go-channel-close-ownership","prompt":"송신 전용 `chan<- T`와 수신 전용 `<-chan T`를 함수 경계에 어떻게 배치할까요?"}
---

# Go 함수에 송신 전용·수신 전용 채널을 전달합니다. 타입이 제한하는 동작과 close 소유권은 어떻게 다른가요?

## 구두 답변

chan<-는 수신을, <-chan은 송신을 타입 수준에서 제한해 함수의 역할을 드러냅니다. 그러나 송신 가능하다는 사실만으로 공유 채널을 그 함수가 close해도 된다는 수명 소유권이 생기지는 않습니다.

여러 producer가 있으면 조정자가 전체 종료를 확인한 뒤 닫습니다. receiver는 입력이 닫힘을 ok로 처리하고 취소가 필요하면 별도 신호를 사용합니다. 타입 제약·실행 소유권·메시지 수명을 함께 테스트합니다.

## 득점 포인트

- chan<-는 수신을, <-chan은 송신을 타입 수준에서 제한해 함수의 역할을 드러냅니다. 그러나 송신 가능하다는 사실만으로 공유 채널을 그 함수가 close해도 된다는 수명 소유권이 생기지는 않습니다.
- 타입 제약·실행 소유권·메시지 수명을 함께 테스트합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: chan<-는 수신을, <-chan은 송신을 타입 수준에서 제한해 함수의 역할을 드러냅니다.

## 더 파고들 거리

- [기본 상황과 비교: 여러 고루틴이 하나의 채널로 결과를 보냅니다. 수신자가 먼저 종료할 때 채널을 닫아도 되며, close는 누가 해야 하나요?](/tech-interview/questions/go-channel-close-ownership/)
