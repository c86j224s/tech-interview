---
id: "go-channel-wait-thread-parking"
title: "Go 채널에서 기다리는 고루틴은 OS 스레드 전체를 붙잡나요? 런타임의 park와 블로킹 호출을 구분해 보세요."
difficulty: "중하"
category: "동시성"
tags: ["비동기","블로킹","스레드","이벤트 루프","future","백프레셔","심화 질문"]
related: ["async-api-and-blocking","io-readiness-vs-completion","goroutine-lifecycle-and-leaks"]
promotedFrom: {"id":"async-api-and-blocking","prompt":"Go의 채널 대기와 OS 스레드 블로킹은 어떻게 다르며, 런타임은 기다리는 작업을 어떻게 다룰까요?"}
---

# Go 채널에서 기다리는 고루틴은 OS 스레드 전체를 붙잡나요? 런타임의 park와 블로킹 호출을 구분해 보세요.

## 구두 답변

채널 대기 고루틴은 런타임에 의해 park되어 다른 실행 가능한 고루틴이 스레드를 사용할 수 있습니다. 이는 일반적인 동기 OS 호출이 스레드를 막는 것과 다릅니다.

G는 고루틴, M은 OS 스레드, P는 Go 코드 실행 자원이라는 역할을 구분합니다. syscall·cgo·런타임 버전에 따라 스레드가 추가되거나 재사용될 수 있어 GOMAXPROCS를 전체 M 개수 상한으로 보지 않습니다. goroutine·thread·block profile과 실제 대기 경로를 대조합니다.

## 득점 포인트

- 채널 대기 고루틴은 런타임에 의해 park되어 다른 실행 가능한 고루틴이 스레드를 사용할 수 있습니다. 이는 일반적인 동기 OS 호출이 스레드를 막는 것과 다릅니다.
- goroutine·thread·block profile과 실제 대기 경로를 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 채널 대기 고루틴은 런타임에 의해 park되어 다른 실행 가능한 고루틴이 스레드를 사용할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 비동기 DB 조회로 future를 받았지만 결과를 기다리는 동안 서버가 멈춥니다. 비동기 API를 써도 스레드가 블로킹될 수 있나요?](/tech-interview/questions/async-api-and-blocking/)
