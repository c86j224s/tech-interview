---
id: "promise-rejection-nearest-handler"
title: "여러 then·catch가 연결돼 있습니다. throw·반환값·다시 던짐에 따라 어느 handler가 오류를 받나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","Promise","예외 전파","catch","심화 질문"]
related: ["js-promise-error-chain","js-event-loop-microtasks","js-async-await-parallel"]
promotedFrom: {"id":"js-promise-error-chain","prompt":"여러 catch에서 가장 가까운 rejection 경계는 어떻게 선택되나요?"}
---

# 여러 then·catch가 연결돼 있습니다. throw·반환값·다시 던짐에 따라 어느 handler가 오류를 받나요?

## 구두 답변

then이 throw하거나 거절된 Promise를 반환하면 다음 rejection handler로 전파됩니다. catch가 값을 반환하면 그 다음은 이행될 수 있고 다시 throw하면 거절이 이어집니다.

중첩 Promise를 반환하지 않으면 체인이 그 작업을 기다리지 않아 오류가 분리될 수 있습니다. finally는 값 대체와 다른 계약이지만 자체 throw는 결과를 바꿀 수 있습니다. 각 단계의 반환 Promise와 실행 시각을 확인합니다.

## 득점 포인트

- then이 throw하거나 거절된 Promise를 반환하면 다음 rejection handler로 전파됩니다. catch가 값을 반환하면 그 다음은 이행될 수 있고 다시 throw하면 거절이 이어집니다.
- 각 단계의 반환 Promise와 실행 시각을 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: then이 throw하거나 거절된 Promise를 반환하면 다음 rejection handler로 전파됩니다.

## 더 파고들 거리

- [기본 상황과 비교: Promise 체인 중간에서 오류를 잡고 대체 값을 반환했습니다. 뒤의 then은 실행되며, 호출자에게 실패를 계속 전달하려면 어떻게 해야 하나요?](/tech-interview/questions/js-promise-error-chain/)
