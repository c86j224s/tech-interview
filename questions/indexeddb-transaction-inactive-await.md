---
id: indexeddb-transaction-inactive-await
title: readwrite 트랜잭션에서 비동기 공백 뒤에도 같은 트랜잭션이 유효하다고 보면 안 되는 이유는 무엇인가요?
difficulty: 중하
category: 웹
tags:
  - IndexedDB
  - transaction
  - versionchange
  - schema upgrade
related:
  - transaction-and-lost-update
---
# readwrite 트랜잭션에서 비동기 공백 뒤에도 같은 트랜잭션이 유효하다고 보면 안 되는 이유는 무엇인가요?

## 구두 답변

IndexedDB 트랜잭션은 async 함수가 끝날 때까지 붙잡히는 객체가 아니라 IDB 요청 이벤트의 활성 구간을 중심으로 수명이 진행됩니다. `get()`의 success 처리 중 바로 다음 `put()`을 접수하는 흐름과, success 뒤 `await fetch()`나 `setTimeout()`을 거치는 흐름은 다릅니다. 후자의 이벤트 태스크가 끝나면 트랜잭션이 inactive가 될 수 있어 같은 tx에 넣은 `put()`이 TransactionInactiveError로 실패할 수 있습니다.

구체적으로 t0에 `{version:3, amount:100}`을 읽고 t1에 원격 환율을 요청하면, t2에서 결과를 받은 시점에는 처음 트랜잭션을 계속 쓸 수 있다고 가정하지 않습니다. 새 readwrite 트랜잭션을 만들고 version을 다시 확인해 아직 3인지 검증합니다. 다른 탭이 4로 갱신했다면 덮어쓰지 않고 충돌로 표시하거나 최신 레코드를 다시 읽습니다. 이 조건부 쓰기가 네트워크와 DB를 하나의 원자 단위로 만드는 것은 아니지만 lost update를 줄입니다. 또한 request success는 한 요청의 결과일 뿐 commit이 아니므로, 실제 저장 성공은 tx complete까지 확인해야 합니다.

이 구분은 단순히 오류를 피하는 문제가 아니라 원자성의 범위를 정하는 문제입니다. 환율 서버가 성공해도 DB 쓰기가 실패할 수 있고, 반대로 DB 요청이 성공 이벤트를 보여도 트랜잭션 전체가 abort될 수 있습니다. 그래서 원격 결과를 메모리에 보관한 뒤 새 트랜잭션을 열고, `get`과 조건 확인과 `put`을 가능한 한 한 활성 요청 흐름 안에 배치합니다. 충돌이면 자동 재시도 횟수를 제한하고 사용자가 이미 편집한 값과 서버 계산값을 덮어쓰지 않도록 선택지를 제공합니다.

## 득점 포인트

- IDB 이벤트 콜백의 active 구간과 await·타이머 뒤 inactive 경계를 구별합니다.
- 네트워크 호출을 트랜잭션 밖으로 빼고 version 조건을 재검사합니다.
- request success와 transaction complete를 서로 다른 성공 신호로 설명합니다.

## 감점 포인트

- async 함수의 스택이 살아 있으므로 IndexedDB tx도 계속 활성이라고 말합니다.
- 원격 호출까지 readwrite의 원자성이 보호한다고 주장합니다.
- get 성공을 최종 커밋으로 해석합니다.

## 더 파고들 거리

- 동일 success 이벤트 안의 다음 요청과 setTimeout 뒤 요청을 작은 재현으로 어떻게 비교하겠습니까?
- version 충돌을 자동 재시도와 사용자 충돌 중 어느 쪽으로 보낼지 어떤 불변식으로 정하겠습니까?
