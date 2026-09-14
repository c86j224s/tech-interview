---
id: "mutation-test-detection-power"
title: "테스트 검출력을 확인하려고 코드를 의도적으로 바꿉니다. mutation testing의 생존 변이와 동등 변이는 어떻게 해석하나요?"
difficulty: "중하"
category: "설계"
tags: ["TDD","테스트 우선","리팩터링","회귀 테스트","심화 질문"]
related: ["tdd-red-green-refactor","dependency-injection-boundaries"]
promotedFrom: {"id":"tdd-red-green-refactor","prompt":"실패를 확인하기 위해 구현을 일부러 깨뜨리는 검증과 mutation testing은 어떤 차이가 있을까요?"}
---

# 테스트 검출력을 확인하려고 코드를 의도적으로 바꿉니다. mutation testing의 생존 변이와 동등 변이는 어떻게 해석하나요?

## 구두 답변

변이 테스트는 조건·연산 등 코드를 작은 방식으로 바꾸어 기존 테스트가 오류를 검출하는지 확인합니다. 살아남은 변이가 모두 실제 결함은 아니고 의미가 같은 동등 변이도 있을 수 있습니다.

라인 실행률과 assertion 검출력을 구분합니다. timeout·무한 루프·test isolation을 관리하고 중요한 불변식의 반례를 회귀로 남깁니다. 변이 점수만 올리려고 구현 세부사항에 과도하게 결합하지 않습니다.

## 득점 포인트

- 변이 테스트는 조건·연산 등 코드를 작은 방식으로 바꾸어 기존 테스트가 오류를 검출하는지 확인합니다. 살아남은 변이가 모두 실제 결함은 아니고 의미가 같은 동등 변이도 있을 수 있습니다.
- 변이 점수만 올리려고 구현 세부사항에 과도하게 결합하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 변이 테스트는 조건·연산 등 코드를 작은 방식으로 바꾸어 기존 테스트가 오류를 검출하는지 확인합니다.

## 더 파고들 거리

- [기본 상황과 비교: 테스트를 먼저 썼지만 바로 통과했습니다. 이것도 TDD의 Red-Green-Refactor라고 할 수 있을까요?](/tech-interview/questions/tdd-red-green-refactor/)
