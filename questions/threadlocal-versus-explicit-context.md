---
id: "threadlocal-versus-explicit-context"
title: "요청 문맥을 ThreadLocal에 넣는 것과 인자로 전달하는 것을 테스트 격리·비동기 전파로 어떻게 비교하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","ThreadLocal","스레드 풀","remove","요청 격리","심화 질문"]
related: ["java-threadlocal-pool","java-synchronized-volatile"]
promotedFrom: {"id":"java-threadlocal-pool","prompt":"메서드 인자 전달과 ThreadLocal의 테스트 격리성을 어떻게 비교할까요?"}
---

# 요청 문맥을 ThreadLocal에 넣는 것과 인자로 전달하는 것을 테스트 격리·비동기 전파로 어떻게 비교하나요?

## 구두 답변

명시적 인자는 의존성과 테스트 입력을 드러내고 ThreadLocal은 호출 경로를 줄이는 대신 스레드 재사용·비동기 전파·정리 책임을 숨길 수 있습니다.

요청별 값은 finally remove·scope 복원을 지키고 executor 전환의 전달을 명시합니다. 인증 주체와 단순 로그 상관 ID를 혼동하지 않습니다. 병렬 테스트는 전역 초기화보다 독립 문맥을 만들어 격리합니다.

## 득점 포인트

- 명시적 인자는 의존성과 테스트 입력을 드러내고 ThreadLocal은 호출 경로를 줄이는 대신 스레드 재사용·비동기 전파·정리 책임을 숨길 수 있습니다.
- 병렬 테스트는 전역 초기화보다 독립 문맥을 만들어 격리합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 명시적 인자는 의존성과 테스트 입력을 드러내고 ThreadLocal은 호출 경로를 줄이는 대신 스레드 재사용·비동기 전파·정리 책임을 숨길 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 요청별 사용자 정보를 ThreadLocal에 넣은 뒤 스레드 풀에서 다음 요청이 잘못된 사용자를 봅니다. 재사용 스레드와 remove의 관계는 무엇인가요?](/tech-interview/questions/java-threadlocal-pool/)
