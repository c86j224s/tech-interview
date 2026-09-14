---
id: "python-c-extension-gil-release"
title: "C 확장을 호출하면 Python 스레드의 CPU 작업이 병렬화될 수 있나요? GIL 해제 범위와 내부 스레드를 어떻게 확인하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Python","GIL","CPython","병렬성","I/O","심화 질문"]
related: ["python-gil-parallelism","python-asyncio-blocking"]
promotedFrom: {"id":"python-gil-parallelism","prompt":"GIL을 해제하는 C 확장과 순수 Python loop의 프로파일은 어떻게 다를까요?"}
---

# C 확장을 호출하면 Python 스레드의 CPU 작업이 병렬화될 수 있나요? GIL 해제 범위와 내부 스레드를 어떻게 확인하나요?

## 구두 답변

C 확장이 GIL을 해제한 구간에서는 다른 Python thread가 실행하거나 native 계산이 병렬일 수 있습니다. 모든 C 코드가 자동으로 GIL을 놓는 것은 아니며 내부 라이브러리 thread도 전체 동시성에 영향을 줍니다.

순수 Python loop와 native 호출을 별도 프로파일링하고 thread 수·CPU·메모리 대역폭을 봅니다. GIL 해제 동안 Python 객체 접근·확장의 thread safety 계약을 확인합니다.

## 득점 포인트

- C 확장이 GIL을 해제한 구간에서는 다른 Python thread가 실행하거나 native 계산이 병렬일 수 있습니다. 모든 C 코드가 자동으로 GIL을 놓는 것은 아니며 내부 라이브러리 thread도 전체 동시성에 영향을 줍니다.
- GIL 해제 동안 Python 객체 접근·확장의 thread safety 계약을 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: C 확장이 GIL을 해제한 구간에서는 다른 Python thread가 실행하거나 native 계산이 병렬일 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: GIL이 켜진 CPython에서 파일을 기다리는 작업은 스레드를 늘려 빨라졌지만 순수 Python 계산은 그렇지 않습니다. 이유는 무엇이며 CPU 작업은 어떻게 병렬화하나요?](/tech-interview/questions/python-gil-parallelism/)
