---
id: "browser-microtask-starvation"
title: "microtask가 계속 다음 microtask를 만듭니다. 렌더링과 입력이 굶지 않도록 언제 실행권을 넘기나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","이벤트 루프","마이크로태스크","Promise","심화 질문"]
related: ["js-event-loop-microtasks","js-promise-error-chain","js-async-await-parallel"]
promotedFrom: {"id":"js-event-loop-microtasks","prompt":"브라우저 microtask 폭주가 렌더링·입력 지연으로 이어지는 경로는 무엇인가요?"}
---

# microtask가 계속 다음 microtask를 만듭니다. 렌더링과 입력이 굶지 않도록 언제 실행권을 넘기나요?

## 구두 답변

microtask 처리 중 계속 새 microtask를 추가하면 다음 task·렌더 기회가 지연될 수 있습니다. await Promise.resolve만 반복하는 것이 항상 브라우저에 렌더 기회를 주는 것은 아닙니다.

작업을 시간 budget으로 나누고 task·scheduler·worker 등 적절한 양보 수단을 선택합니다. requestAnimationFrame 안 긴 계산도 프레임을 막을 수 있습니다. 입력·프레임·loop lag와 전체 완료 시간을 비교합니다.

## 득점 포인트

- microtask 처리 중 계속 새 microtask를 추가하면 다음 task·렌더 기회가 지연될 수 있습니다. await Promise.resolve만 반복하는 것이 항상 브라우저에 렌더 기회를 주는 것은 아닙니다.
- 입력·프레임·loop lag와 전체 완료 시간을 비교합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: microtask 처리 중 계속 새 microtask를 추가하면 다음 task·렌더 기회가 지연될 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 한 JavaScript 실행 흐름에서 동기 로그, 이미 이행된 Promise의 콜백, 지연 0인 setTimeout을 등록했습니다. 왜 등록 순서와 실행 순서가 다를 수 있나요?](/tech-interview/questions/js-event-loop-microtasks/)
