---
id: "virtual-clock-timeout-testing"
title: "실제 sleep 없이 timeout과 완료 경쟁을 시험합니다. 가상 시계와 스케줄러에 어떤 제어 지점을 두나요?"
difficulty: "중하"
category: "설계"
tags: ["의존성 주입","테스트","인터페이스","심화 질문"]
related: ["dependency-injection-boundaries","service-boundary-design"]
promotedFrom: {"id":"dependency-injection-boundaries","prompt":"시계와 스케줄러를 주입해 타임아웃 경쟁을 어떻게 재현할까요?"}
---

# 실제 sleep 없이 timeout과 완료 경쟁을 시험합니다. 가상 시계와 스케줄러에 어떤 제어 지점을 두나요?

## 구두 답변

시계 조회와 timer 등록·실행을 분리된 의존성으로 주입합니다. 테스트가 시각을 전진시키고 특정 완료 신호를 먼저 게시해 timeout 전후 순서를 재현하게 합니다.

가상 시계를 바꿔도 실제 DB·스레드가 멈추는 것은 아니므로 통합 시험은 별도입니다. 같은 deadline을 반복 대기에서 유지하고 취소·완료의 단일 결과 전이를 검사합니다. 무한 대기하는 테스트를 막는 실제 watchdog도 둡니다.

## 득점 포인트

- 시계 조회와 timer 등록·실행을 분리된 의존성으로 주입합니다. 테스트가 시각을 전진시키고 특정 완료 신호를 먼저 게시해 timeout 전후 순서를 재현하게 합니다.
- 무한 대기하는 테스트를 막는 실제 watchdog도 둡니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 시계 조회와 timer 등록·실행을 분리된 의존성으로 주입합니다.

## 더 파고들 거리

- [기본 상황과 비교: 외부 API를 호출하고 실제 시간을 기다리는 코드의 실패를 테스트하기 어렵습니다. 의존성 주입은 어떻게 도움이 되며 어디까지 적용하나요?](/tech-interview/questions/dependency-injection-boundaries/)
