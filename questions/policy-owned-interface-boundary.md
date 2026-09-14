---
id: "policy-owned-interface-boundary"
title: "인터페이스는 있지만 DB 패키지가 소유합니다. 추상화의 소유와 고수준 정책의 의존 방향은 어떻게 판단하나요?"
difficulty: "중하"
category: "설계"
tags: ["SOLID","의존성 역전","추상화","정책","심화 질문"]
related: ["solid-dependency-inversion","dependency-injection-boundaries"]
promotedFrom: {"id":"solid-dependency-inversion","prompt":"추상화가 고수준 모듈의 소유인지 저수준 모듈의 소유인지 판단하는 기준은 무엇인가요?"}
---

# 인터페이스는 있지만 DB 패키지가 소유합니다. 추상화의 소유와 고수준 정책의 의존 방향은 어떻게 판단하나요?

## 구두 답변

추상화가 어느 패키지에 있느냐뿐 아니라 메서드가 고수준 정책의 의미를 표현하고 정책이 저수준 SDK를 import하지 않는지 봅니다. DB CRUD를 그대로 복사한 interface는 결합을 남길 수 있습니다.

원자적 기록·중복·불확정·조회 같은 도메인 계약을 포트로 정의하고 adapter가 구현합니다. 조립 root는 양쪽을 알아도 정책은 구현을 몰라야 합니다. fake와 실제 adapter의 같은 행동 테스트를 유지합니다.

## 득점 포인트

- 추상화가 어느 패키지에 있느냐뿐 아니라 메서드가 고수준 정책의 의미를 표현하고 정책이 저수준 SDK를 import하지 않는지 봅니다. DB CRUD를 그대로 복사한 interface는 결합을 남길 수 있습니다.
- fake와 실제 adapter의 같은 행동 테스트를 유지합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 추상화가 어느 패키지에 있느냐뿐 아니라 메서드가 고수준 정책의 의미를 표현하고 정책이 저수준 SDK를 import하지 않는지 봅니다.

## 더 파고들 거리

- [기본 상황과 비교: 결제 규칙을 테스트할 때마다 실제 DB가 필요하고 DB 교체도 정책 코드 수정으로 이어집니다. DIP를 적용해 어떤 인터페이스와 의존 방향을 바꾸나요?](/tech-interview/questions/solid-dependency-inversion/)
