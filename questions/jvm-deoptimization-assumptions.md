---
id: "jvm-deoptimization-assumptions"
title: "JIT가 빠르게 만든 메서드가 새 타입 입력 뒤 느려집니다. 인라이닝 가정과 deoptimization은 어떤 관계인가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JVM","바이트코드","인터프리터","JIT","예열","심화 질문"]
related: ["jvm-bytecode-jit"]
promotedFrom: {"id":"jvm-bytecode-jit","prompt":"인라이닝 가정이 깨져 deoptimization이 발생하는 사례는 무엇인가요?"}
---

# JIT가 빠르게 만든 메서드가 새 타입 입력 뒤 느려집니다. 인라이닝 가정과 deoptimization은 어떤 관계인가요?

## 구두 답변

JIT는 관찰한 타입·호출 대상 등 가정으로 inline·최적화를 수행할 수 있습니다. 새 입력이 그 가정을 깨면 guard 실패와 deoptimization으로 덜 최적화된 경로로 돌아갈 수 있습니다.

한 번의 느린 요청이 GC·class loading·I/O 때문인지도 구분합니다. JFR·컴파일 로그와 입력 유형을 연결하고 warm 상태에서 타입 다양성을 바꿔 비교합니다. 구현 최적화는 언어의 기능적 계약과 다릅니다.

## 득점 포인트

- JIT는 관찰한 타입·호출 대상 등 가정으로 inline·최적화를 수행할 수 있습니다. 새 입력이 그 가정을 깨면 guard 실패와 deoptimization으로 덜 최적화된 경로로 돌아갈 수 있습니다.
- 구현 최적화는 언어의 기능적 계약과 다릅니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: JIT는 관찰한 타입·호출 대상 등 가정으로 inline·최적화를 수행할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Java 서버가 시작 직후에는 느리다가 같은 요청을 반복하면 빨라집니다. 인터프리터와 JIT가 어떤 역할을 하며 성능 측정에서 예열을 왜 구분해야 하나요?](/tech-interview/questions/jvm-bytecode-jit/)
