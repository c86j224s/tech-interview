---
id: "fake-real-repository-contract-tests"
title: "가짜 DB는 테스트를 통과하지만 실제 DB는 경쟁에서 실패합니다. 두 구현에 공유할 계약 테스트는 무엇인가요?"
difficulty: "중하"
category: "설계"
tags: ["의존성 주입","테스트","인터페이스","심화 질문"]
related: ["dependency-injection-boundaries","service-boundary-design"]
promotedFrom: {"id":"dependency-injection-boundaries","prompt":"가짜 DB와 실제 DB의 계약 테스트를 어떻게 공유할까요?"}
---

# 가짜 DB는 테스트를 통과하지만 실제 DB는 경쟁에서 실패합니다. 두 구현에 공유할 계약 테스트는 무엇인가요?

## 구두 답변

저장소의 원자 생성·중복 결과·version 충돌·rollback·미존재·권한 오류를 같은 시나리오로 검사합니다. fake의 단일 스레드 동작이 실제 DB보다 강한 보장을 주지 않게 해야 합니다.

빠른 fake 테스트는 정책 분기, 실제 DB 테스트는 잠금·고유 제약·격리·네트워크 실패를 맡깁니다. 결과만 아니라 외부 효과·처리 기록을 확인합니다. 인터페이스가 exists와 insert를 나눠 경쟁을 강요하면 조건부 생성의 의미로 다시 설계합니다.

## 득점 포인트

- 저장소의 원자 생성·중복 결과·version 충돌·rollback·미존재·권한 오류를 같은 시나리오로 검사합니다. fake의 단일 스레드 동작이 실제 DB보다 강한 보장을 주지 않게 해야 합니다.
- 인터페이스가 exists와 insert를 나눠 경쟁을 강요하면 조건부 생성의 의미로 다시 설계합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 저장소의 원자 생성·중복 결과·version 충돌·rollback·미존재·권한 오류를 같은 시나리오로 검사합니다.

## 더 파고들 거리

- [기본 상황과 비교: 외부 API를 호출하고 실제 시간을 기다리는 코드의 실패를 테스트하기 어렵습니다. 의존성 주입은 어떻게 도움이 되며 어디까지 적용하나요?](/tech-interview/questions/dependency-injection-boundaries/)
