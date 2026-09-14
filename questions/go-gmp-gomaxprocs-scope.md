---
id: "go-gmp-gomaxprocs-scope"
title: "Go의 G·M·P와 GOMAXPROCS는 무엇을 제한하며 OS 스레드 수의 상한과 왜 다른가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Go","고루틴","context","채널","자원 관리","백프레셔","심화 질문"]
related: ["goroutine-lifecycle-and-leaks","async-api-and-blocking","process-vs-thread"]
promotedFrom: {"id":"goroutine-lifecycle-and-leaks","prompt":"G·M·P와 GOMAXPROCS는 각각 무엇이며, OS 스레드 수의 상한과 왜 다른가요?"}
---

# Go의 G·M·P와 GOMAXPROCS는 무엇을 제한하며 OS 스레드 수의 상한과 왜 다른가요?

## 구두 답변

G는 고루틴, M은 OS 스레드, P는 Go 코드 실행을 위한 런타임 자원입니다. GOMAXPROCS는 동시에 Go 코드를 실행할 P 수의 설정이며 syscall·cgo 등에 필요한 모든 OS 스레드의 절대 상한은 아닙니다.

채널·네트워크 대기와 CPU 실행을 나누고 runnable G·M 수·block·GC·per-core 사용률을 관찰합니다. 값만 늘리면 CPU·메모리·DB 예산이 늘지는 않습니다. 지원 버전의 컨테이너 CPU 인식 기본값도 확인합니다.

## 득점 포인트

- G는 고루틴, M은 OS 스레드, P는 Go 코드 실행을 위한 런타임 자원입니다. GOMAXPROCS는 동시에 Go 코드를 실행할 P 수의 설정이며 syscall·cgo 등에 필요한 모든 OS 스레드의 절대 상한은 아닙니다.
- 지원 버전의 컨테이너 CPU 인식 기본값도 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: G는 고루틴, M은 OS 스레드, P는 Go 코드 실행을 위한 런타임 자원입니다.

## 더 파고들 거리

- [기본 상황과 비교: 외부 API가 느려지자 Go 서버의 고루틴 수가 계속 늘어납니다. 정상적인 대기 증가인지 누수인지 어떻게 구분하고 제한하나요?](/tech-interview/questions/goroutine-lifecycle-and-leaks/)
