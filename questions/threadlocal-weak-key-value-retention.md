---
id: "threadlocal-weak-key-value-retention"
title: "ThreadLocal 키는 약한 참조인데 장수 worker에서 값이 남습니다. 키 회수와 value 정리의 차이는 무엇인가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","ThreadLocal","스레드 풀","remove","요청 격리","심화 질문"]
related: ["java-threadlocal-pool","java-synchronized-volatile"]
promotedFrom: {"id":"java-threadlocal-pool","prompt":"ThreadLocalMap의 약한 키와 남은 값이 장수 워커에 미치는 영향은 무엇인가요?"}
---

# ThreadLocal 키는 약한 참조인데 장수 worker에서 값이 남습니다. 키 회수와 value 정리의 차이는 무엇인가요?

## 구두 답변

ThreadLocalMap의 키가 약해도 entry의 value는 thread 수명에 연결되어 남을 수 있고 정리는 관련 map 연산에 의존할 수 있습니다. 키가 GC됐다고 value가 즉시 해제된다고 가정하지 않습니다.

요청 finally에서 remove하고 큰 값·class loader 참조를 피합니다. pool thread가 계속 살아 있는 재배포·예외 경로를 heap dump와 반복 테스트로 확인합니다.

## 득점 포인트

- ThreadLocalMap의 키가 약해도 entry의 value는 thread 수명에 연결되어 남을 수 있고 정리는 관련 map 연산에 의존할 수 있습니다. 키가 GC됐다고 value가 즉시 해제된다고 가정하지 않습니다.
- pool thread가 계속 살아 있는 재배포·예외 경로를 heap dump와 반복 테스트로 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: ThreadLocalMap의 키가 약해도 entry의 value는 thread 수명에 연결되어 남을 수 있고 정리는 관련 map 연산에 의존할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 요청별 사용자 정보를 ThreadLocal에 넣은 뒤 스레드 풀에서 다음 요청이 잘못된 사용자를 봅니다. 재사용 스레드와 remove의 관계는 무엇인가요?](/tech-interview/questions/java-threadlocal-pool/)
