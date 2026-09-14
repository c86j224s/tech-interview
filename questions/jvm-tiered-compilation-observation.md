---
id: "jvm-tiered-compilation-observation"
title: "JVM의 계층형 컴파일이 예열 중 일어납니다. 컴파일 스레드·코드 전환과 요청 지연을 어떻게 관찰하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JVM","바이트코드","인터프리터","JIT","예열","심화 질문"]
related: ["jvm-bytecode-jit"]
promotedFrom: {"id":"jvm-bytecode-jit","prompt":"계층형 컴파일의 전환과 컴파일 스레드 비용을 어떻게 관찰할까요?"}
---

# JVM의 계층형 컴파일이 예열 중 일어납니다. 컴파일 스레드·코드 전환과 요청 지연을 어떻게 관찰하나요?

## 구두 답변

계층형 JIT는 수집한 실행 정보를 바탕으로 다른 최적화 수준의 코드를 만들 수 있습니다. 예열 중 클래스 로딩·컴파일 CPU·코드 교체가 요청 지연과 겹칠 수 있습니다.

JFR·컴파일 로그 등 지원 도구로 시각을 대조하고 cold·warm·steady 상태를 따로 측정합니다. 실험 루프의 dead-code elimination·상수 접기·부하 차이를 피하며 최신 JDK의 실제 compiler 설정을 기록합니다.

## 득점 포인트

- 계층형 JIT는 수집한 실행 정보를 바탕으로 다른 최적화 수준의 코드를 만들 수 있습니다. 예열 중 클래스 로딩·컴파일 CPU·코드 교체가 요청 지연과 겹칠 수 있습니다.
- 실험 루프의 dead-code elimination·상수 접기·부하 차이를 피하며 최신 JDK의 실제 compiler 설정을 기록합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 계층형 JIT는 수집한 실행 정보를 바탕으로 다른 최적화 수준의 코드를 만들 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Java 서버가 시작 직후에는 느리다가 같은 요청을 반복하면 빨라집니다. 인터프리터와 JIT가 어떤 역할을 하며 성능 측정에서 예열을 왜 구분해야 하나요?](/tech-interview/questions/jvm-bytecode-jit/)
