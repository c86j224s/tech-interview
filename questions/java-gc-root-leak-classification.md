---
id: "java-gc-root-leak-classification"
title: "힙 덤프에서 오래 살아 있는 객체를 찾았습니다. thread·static·JNI 등 root 경로를 어떻게 분류해 원인을 찾나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","GC","도달 가능성","순환 참조","try-with-resources","심화 질문"]
related: ["java-gc-reachability","java-final-immutability"]
promotedFrom: {"id":"java-gc-reachability","prompt":"GC root 종류별로 힙 덤프에서 누수 경로를 어떻게 분류할까요?"}
---

# 힙 덤프에서 오래 살아 있는 객체를 찾았습니다. thread·static·JNI 등 root 경로를 어떻게 분류해 원인을 찾나요?

## 구두 답변

살아 있는 thread stack·static·JNI handle 등에서 목표 객체까지 이어지는 강한 경로를 찾습니다. 큰 객체 자체가 아니라 그것을 계속 유지하는 owner를 확인해야 합니다.

장기 cache·ThreadLocal·listener·class loader 수명을 분류하고 실제 기능 종료 후 경로가 끊기는지 봅니다. GC 호출 직후 크기 하나보다 반복 부하의 retained 추세와 root 변화를 비교합니다.

## 득점 포인트

- 살아 있는 thread stack·static·JNI handle 등에서 목표 객체까지 이어지는 강한 경로를 찾습니다. 큰 객체 자체가 아니라 그것을 계속 유지하는 owner를 확인해야 합니다.
- GC 호출 직후 크기 하나보다 반복 부하의 retained 추세와 root 변화를 비교합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 살아 있는 thread stack·static·JNI handle 등에서 목표 객체까지 이어지는 강한 경로를 찾습니다.

## 더 파고들 거리

- [기본 상황과 비교: 서로 참조하는 Java 객체가 있는데도 메모리 회수가 가능한가요? GC와 파일·소켓 같은 자원 반납은 어떻게 구분해야 하나요?](/tech-interview/questions/java-gc-reachability/)
