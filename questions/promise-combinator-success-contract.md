---
id: "promise-combinator-success-contract"
title: "Promise.all·allSettled·any·race는 어떤 시점에 성공·실패하며 남은 작업을 취소하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","async/await","Promise.all","병렬 실행","취소","심화 질문"]
related: ["js-async-await-parallel","js-promise-error-chain","js-event-loop-microtasks"]
promotedFrom: {"id":"js-async-await-parallel","prompt":"`all`, `allSettled`, `any`, `race`의 성공 조건을 한 작업 표로 비교해 보세요."}
---

# Promise.all·allSettled·any·race는 어떤 시점에 성공·실패하며 남은 작업을 취소하나요?

## 구두 답변

all은 모두 이행해야 성공하고 하나의 거절로 실패할 수 있습니다. allSettled는 모두 정착한 상태를 모으며 any는 첫 이행, race는 첫 정착 결과를 따릅니다. 이 조합들은 보통 나머지 작업을 자동 취소하지 않습니다.

빈 iterable의 차이·입력 순서와 완료 순서·AggregateError를 확인합니다. 외부 변경 일부 성공 뒤 조합이 거절돼도 rollback되지 않으므로 결과 조회와 멱등 재시도가 필요합니다.

## 득점 포인트

- all은 모두 이행해야 성공하고 하나의 거절로 실패할 수 있습니다. allSettled는 모두 정착한 상태를 모으며 any는 첫 이행, race는 첫 정착 결과를 따릅니다. 이 조합들은 보통 나머지 작업을 자동 취소하지 않습니다.
- 외부 변경 일부 성공 뒤 조합이 거절돼도 rollback되지 않으므로 결과 조회와 멱등 재시도가 필요합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: all은 모두 이행해야 성공하고 하나의 거절로 실패할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 화면을 그리려면 서로 독립적인 API 두 개의 결과가 필요합니다. 순차 await와 Promise.all 중 무엇을 선택하고, 하나가 실패하면 나머지 요청은 어떻게 처리하나요?](/tech-interview/questions/js-async-await-parallel/)
