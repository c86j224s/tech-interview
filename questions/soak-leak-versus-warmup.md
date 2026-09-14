---
id: "soak-leak-versus-warmup"
title: "장시간 부하에서 메모리가 늘어납니다. 정상 예열·캐시·allocator 보유와 누수를 어떤 추세로 구분하나요?"
difficulty: "중하"
category: "성능"
tags: ["부하 테스트","워크로드","캐시","심화 질문"]
related: ["load-test-realism","throughput-vs-latency"]
promotedFrom: {"id":"load-test-realism","prompt":"soak test에서 누수와 단순 warm-up을 어떤 추세로 구분할까요?"}
---

# 장시간 부하에서 메모리가 늘어납니다. 정상 예열·캐시·allocator 보유와 누수를 어떤 추세로 구분하나요?

## 구두 답변

예열·cache는 일정 부하에서 한도에 수렴할 수 있지만 실제 누수는 불필요한 참조나 자원이 계속 남습니다. allocator가 해제 메모리를 보관하면 heap과 RSS 추세도 다를 수 있습니다.

같은 요청을 오래 실행하고 부하 종료 후 객체·FD·thread·queue·RSS를 대조합니다. 큰 요청 한번 뒤 풀 보관도 분리합니다. 그래프 모양만으로 확정하지 않고 retained 참조와 실제 owner를 확인합니다.

## 득점 포인트

- 예열·cache는 일정 부하에서 한도에 수렴할 수 있지만 실제 누수는 불필요한 참조나 자원이 계속 남습니다. allocator가 해제 메모리를 보관하면 heap과 RSS 추세도 다를 수 있습니다.
- 그래프 모양만으로 확정하지 않고 retained 참조와 실제 owner를 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 예열·cache는 일정 부하에서 한도에 수렴할 수 있지만 실제 누수는 불필요한 참조나 자원이 계속 남습니다.

## 더 파고들 거리

- [기본 상황과 비교: 부하 테스트의 TPS와 지연 결과가 운영 성능을 예측하려면 요청·데이터·캐시·부하 생성 조건을 무엇까지 맞춰야 하나요?](/tech-interview/questions/load-test-realism/)
