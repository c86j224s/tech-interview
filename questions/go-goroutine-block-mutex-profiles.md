---
id: "go-goroutine-block-mutex-profiles"
title: "goroutine·block·mutex profile은 현재 상태와 누적 대기를 어떻게 다르게 보여 주나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Go","고루틴","context","채널","자원 관리","백프레셔","심화 질문"]
related: ["goroutine-lifecycle-and-leaks","async-api-and-blocking","process-vs-thread"]
promotedFrom: {"id":"goroutine-lifecycle-and-leaks","prompt":"goroutine·block·mutex 프로파일은 현재 대기와 누적 대기를 관찰하는 데 어떤 차이가 있나요?"}
---

# goroutine·block·mutex profile은 현재 상태와 누적 대기를 어떻게 다르게 보여 주나요?

## 구두 답변

goroutine profile은 현재 stack과 대기 상태를, block·mutex profile은 설정과 sampling에 따른 누적 대기·경합을 진단하는 데 사용합니다. 한 시점의 goroutine 수와 누적 contention을 같은 값으로 비교하지 않습니다.

관측 창·sampling 설정·부하·GC 시점을 고정하고 같은 stack이 종료 후에도 남는지 봅니다. block 위치와 실제 락 보유 원인을 연결합니다. profiling overhead를 측정하고 profile이 없다는 사실을 대기가 없다는 증거로 쓰지 않습니다.

## 득점 포인트

- goroutine profile은 현재 stack과 대기 상태를, block·mutex profile은 설정과 sampling에 따른 누적 대기·경합을 진단하는 데 사용합니다. 한 시점의 goroutine 수와 누적 contention을 같은 값으로 비교하지 않습니다.
- profiling overhead를 측정하고 profile이 없다는 사실을 대기가 없다는 증거로 쓰지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: goroutine profile은 현재 stack과 대기 상태를, block·mutex profile은 설정과 sampling에 따른 누적 대기·경합을 진단하는 데 사용합니다.

## 더 파고들 거리

- [기본 상황과 비교: 외부 API가 느려지자 Go 서버의 고루틴 수가 계속 늘어납니다. 정상적인 대기 증가인지 누수인지 어떻게 구분하고 제한하나요?](/tech-interview/questions/goroutine-lifecycle-and-leaks/)
