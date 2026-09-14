---
id: "node-nexttick-microtask-context"
title: "Node에서 nextTick과 Promise callback의 순서를 확인합니다. 실행 문맥·모듈 종류·버전을 왜 함께 고정해야 하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","이벤트 루프","마이크로태스크","Promise","심화 질문"]
related: ["js-event-loop-microtasks","js-promise-error-chain","js-async-await-parallel"]
promotedFrom: {"id":"js-event-loop-microtasks","prompt":"Node의 `process.nextTick`과 Promise microtask의 우선순위를 어떤 버전에서 재현할까요?"}
---

# Node에서 nextTick과 Promise callback의 순서를 확인합니다. 실행 문맥·모듈 종류·버전을 왜 함께 고정해야 하나요?

## 구두 답변

Node의 nextTick 큐와 Promise microtask는 현재 실행 문맥과 drain 시점의 영향을 받습니다. CommonJS top-level과 이미 microtask 안에서 실행되는 ESM 등 조건을 고정하지 않고 한 순서를 보편 규칙으로 외우지 않습니다.

실제 Node 버전·모듈·I/O callback 안의 최소 코드를 실행해 기록합니다. nextTick 연쇄는 이벤트 루프를 굶길 수 있어 긴 작업을 분할하고 timer·I/O·화면 계약과 구분합니다.

## 득점 포인트

- Node의 nextTick 큐와 Promise microtask는 현재 실행 문맥과 drain 시점의 영향을 받습니다. CommonJS top-level과 이미 microtask 안에서 실행되는 ESM 등 조건을 고정하지 않고 한 순서를 보편 규칙으로 외우지 않습니다.
- nextTick 연쇄는 이벤트 루프를 굶길 수 있어 긴 작업을 분할하고 timer·I/O·화면 계약과 구분합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Node의 nextTick 큐와 Promise microtask는 현재 실행 문맥과 drain 시점의 영향을 받습니다.

## 더 파고들 거리

- [기본 상황과 비교: 한 JavaScript 실행 흐름에서 동기 로그, 이미 이행된 Promise의 콜백, 지연 0인 setTimeout을 등록했습니다. 왜 등록 순서와 실행 순서가 다를 수 있나요?](/tech-interview/questions/js-event-loop-microtasks/)
