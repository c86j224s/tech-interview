---
id: swift-actor-await-revalidation
title: actor가 잔액 확인 뒤 await 결제를 기다릴 때 재개 후 검사를 다시 해야 하는 이유는 무엇인가요?
difficulty: 중하
category: 모바일
tags:
  - Swift
  - actor
  - await
  - reentrancy
related:
  - swift-completion-cancel-once
---
# actor가 잔액 확인 뒤 await 결제를 기다릴 때 재개 후 검사를 다시 해야 하는 이유는 무엇인가요?

## 구두 답변

재개 후 검사가 필요한 이유는 actor가 메서드 전체를 잠그는 transaction이 아니기 때문입니다. `balance=100`에서 A와 B가 각각 70원을 요청하면 A가 잔액을 읽고 결제 승인을 `await`하는 동안 B도 같은 100을 읽을 수 있습니다. B가 먼저 예약을 확정했거나 다른 작업이 version을 1로 바꿨다면 A가 돌아온 뒤의 조건은 await 전과 다릅니다. 따라서 재개 직후 현재 잔액, 요청 세대, reservation 상태를 다시 확인하고, 불일치하면 결과를 늦은 결과로 폐기합니다.

다만 외부 승인 API가 이미 성공한 뒤 재검사가 실패할 수 있습니다. 이때 로컬에서 실패를 반환한다고 서버 결제가 취소되는 것은 아니므로 멱등 key로 상태를 조회하거나 환불·보류·대사 중 정책이 필요합니다. 가장 안전한 선행 선택은 await 전에 actor 내부에서 70원을 reservation으로 잠그고, 승인 성공 시 committed로 바꾸는 것입니다. `await`가 항상 실제 중단된다는 뜻은 아니지만 중단 가능성이 있으므로 이 순서로 설계합니다.

실패 처리를 구체화하면 A의 승인 응답에 `requestID=A`가 들어와도 현재 원장에 A reservation이 `pending`인지 확인해야 합니다. B가 먼저 70원을 확정해 balance가 30이 된 상태에서 A가 성공하면, A를 조용히 실패시키는 대신 승인 조회를 통해 서버의 결제 상태를 확인하고 환불 또는 보류 레코드를 만들어야 합니다. 이처럼 재검사는 경쟁을 감지하는 장치이고, 외부 결제의 exactly-once를 만들어 주는 장치는 아닙니다.
운영 로그에는 `observedVersion`, `resumedVersion`, gateway response, reconciliation outcome을 함께 남깁니다. 그래야 단순 잔액 부족과 “승인은 됐지만 로컬 커밋이 거부된” 보상 경로를 구분할 수 있습니다.
## 득점 포인트

- A와 B가 각각 `100`을 읽고 같은 외부 승인을 기다리는 상태 추적을 제시합니다.
- actor 직렬 실행과 await 사이 재진입을 구분하고, 재개 후 version 또는 reservation을 다시 검사합니다.
- 외부 승인 성공과 로컬 상태 반영을 분리해 멱등 조회·환불·대사 경계를 설명합니다.

## 감점 포인트

- actor이므로 A가 반환할 때까지 B가 절대 실행되지 않는다고 단정합니다.
- 재검사 실패나 `Task.cancel()`이 이미 성공한 서버 결제를 자동으로 rollback한다고 말합니다.
- 잔액만 다시 읽고 요청 ID·세대·외부 멱등 키를 확인하지 않습니다.

## 더 파고들 거리

- reservation이 승인 timeout 뒤에도 남을 때 만료 시각과 재조정 작업을 어떻게 둘지 설명해 보세요.
- A 승인이 늦게 도착하고 사용자가 취소한 경우 사용자 응답과 결제 원장을 어떤 상태로 나눌지 비교해 보세요.
