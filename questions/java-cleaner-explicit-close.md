---
id: "java-cleaner-explicit-close"
title: "Cleaner를 자원 정리의 보조 장치로 사용합니다. 명시적인 close와 실행 시점·실패 책임은 어떻게 나누나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","GC","도달 가능성","순환 참조","try-with-resources","심화 질문"]
related: ["java-gc-reachability","java-final-immutability"]
promotedFrom: {"id":"java-gc-reachability","prompt":"Cleaner를 보조 안전망으로 둘 때 명시적 close와 어떤 책임을 나눌까요?"}
---

# Cleaner를 자원 정리의 보조 장치로 사용합니다. 명시적인 close와 실행 시점·실패 책임은 어떻게 나누나요?

## 구두 답변

Cleaner의 실행 시점은 명시적인 close처럼 즉시 제어되지 않으므로 필수 파일·연결 반환을 맡기지 않습니다. 명시적 close를 기본으로 하고 누락 시 보조 정리로 사용합니다.

정리 action이 원래 객체를 강하게 참조해 회수를 막지 않게 합니다. 중복 close·실패·프로세스 종료를 처리하고 자원의 내구 commit은 별도 API로 결과를 반환합니다. GC 요청을 cleanup 완료로 보지 않습니다.

## 득점 포인트

- Cleaner의 실행 시점은 명시적인 close처럼 즉시 제어되지 않으므로 필수 파일·연결 반환을 맡기지 않습니다. 명시적 close를 기본으로 하고 누락 시 보조 정리로 사용합니다.
- GC 요청을 cleanup 완료로 보지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Cleaner의 실행 시점은 명시적인 close처럼 즉시 제어되지 않으므로 필수 파일·연결 반환을 맡기지 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: 서로 참조하는 Java 객체가 있는데도 메모리 회수가 가능한가요? GC와 파일·소켓 같은 자원 반납은 어떻게 구분해야 하나요?](/tech-interview/questions/java-gc-reachability/)
