---
id: "promise-executor-then-throw"
title: "Promise executor와 then callback에서 각각 throw했습니다. 실행 시점과 rejection 관찰은 어떻게 다른가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","Promise","예외 전파","catch","심화 질문"]
related: ["js-promise-error-chain","js-event-loop-microtasks","js-async-await-parallel"]
promotedFrom: {"id":"js-promise-error-chain","prompt":"Promise 생성자 실행부의 동기 throw와 then 내부 throw는 관찰 시점이 어떻게 다른가요?"}
---

# Promise executor와 then callback에서 각각 throw했습니다. 실행 시점과 rejection 관찰은 어떻게 다른가요?

## 구두 답변

Promise 생성자의 executor는 생성 시 동기 실행되고 그 안의 throw는 Promise rejection으로 연결됩니다. then callback은 Promise 반응 처리 시 나중 실행되고 throw하면 반환된 다음 Promise가 거절됩니다.

executor 밖의 동기 throw와도 구분합니다. catch를 언제 붙이는지·중첩 Promise를 반환하는지에 따라 오류 관찰이 달라집니다. 외부 I/O가 이미 시작됐다면 rejection이 자동 취소나 rollback을 뜻하지 않습니다.

## 득점 포인트

- Promise 생성자의 executor는 생성 시 동기 실행되고 그 안의 throw는 Promise rejection으로 연결됩니다. then callback은 Promise 반응 처리 시 나중 실행되고 throw하면 반환된 다음 Promise가 거절됩니다.
- 외부 I/O가 이미 시작됐다면 rejection이 자동 취소나 rollback을 뜻하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Promise 생성자의 executor는 생성 시 동기 실행되고 그 안의 throw는 Promise rejection으로 연결됩니다.

## 더 파고들 거리

- [기본 상황과 비교: Promise 체인 중간에서 오류를 잡고 대체 값을 반환했습니다. 뒤의 then은 실행되며, 호출자에게 실패를 계속 전달하려면 어떻게 해야 하나요?](/tech-interview/questions/js-promise-error-chain/)
