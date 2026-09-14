---
id: "shared-abortsignal-completed-results"
title: "여러 fetch가 AbortSignal을 공유합니다. 일부 완료 뒤 abort하면 결과와 아직 진행 중인 작업은 어떻게 나누나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","async/await","Promise.all","병렬 실행","취소","심화 질문"]
related: ["js-async-await-parallel","js-promise-error-chain","js-event-loop-microtasks"]
promotedFrom: {"id":"js-async-await-parallel","prompt":"여러 fetch에 하나의 AbortSignal을 공유할 때 이미 완료된 응답은 어떻게 처리할까요?"}
---

# 여러 fetch가 AbortSignal을 공유합니다. 일부 완료 뒤 abort하면 결과와 아직 진행 중인 작업은 어떻게 나누나요?

## 구두 답변

이미 완료한 요청의 외부 효과나 받은 데이터가 abort로 사라지지 않습니다. 완료 결과와 아직 진행 중인 요청을 각각 상태로 추적하고 필요한 정책에 따라 보존·폐기합니다.

fetch 헤더 응답과 body 소비도 다른 단계라 body 읽기가 abort될 수 있습니다. 같은 controller를 다른 수명 작업에 무심코 공유하지 않습니다. 변경 재시도는 서버 결과 조회·멱등 키를 사용합니다.

## 득점 포인트

- 이미 완료한 요청의 외부 효과나 받은 데이터가 abort로 사라지지 않습니다. 완료 결과와 아직 진행 중인 요청을 각각 상태로 추적하고 필요한 정책에 따라 보존·폐기합니다.
- 변경 재시도는 서버 결과 조회·멱등 키를 사용합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 이미 완료한 요청의 외부 효과나 받은 데이터가 abort로 사라지지 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: 화면을 그리려면 서로 독립적인 API 두 개의 결과가 필요합니다. 순차 await와 Promise.all 중 무엇을 선택하고, 하나가 실패하면 나머지 요청은 어떻게 처리하나요?](/tech-interview/questions/js-async-await-parallel/)
