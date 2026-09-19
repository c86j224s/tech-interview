---
id: rust-future-drop-cancellation
title: 진행 중 Future를 drop하면 원격 요청도 취소된다고 볼 수 있나요?
difficulty: 중하
category: 언어·런타임
tags:
  - Rust
  - Future
  - drop
  - cancellation
related:
  - async-api-and-blocking
  - cpp-coroutine-frame-lifetime
---
# 진행 중 Future를 drop하면 원격 요청도 취소된다고 볼 수 있나요?

## 구두 답변

아니요. Future를 drop하면 그 값의 continuation과 로컬 자원이 정리되고 더 이상 poll되지 않지만, 이미 외부로 나간 효과의 상태는 자동으로 되돌아가지 않습니다. 예를 들어 timeout이 HTTP future를 drop한 시점에 client가 연결 종료를 시도할 수는 있지만, 이는 특정 client/runtime 계약이며 Rust `Future` trait의 보장이 아닙니다. 서버가 요청을 읽기 전일 수도 있고, 응답만 늦었을 뿐 주문 변경은 이미 커밋했을 수도 있습니다. 그러므로 timeout 뒤 재시도는 중복 변경을 만들 수 있습니다. idempotency key, 서버 상태 조회, 명시적 abort, 보상 작업으로 `drop`, 취소 요청, 취소 완료, 원격 결과 unknown을 분리해야 합니다.

큐 메시지도 같은 경계가 있습니다. dequeue 뒤 handler가 ack 전에 drop되면 재전달될 수 있지만, ack가 먼저 나갔다면 처리 중단과 유실 정책을 따로 확인해야 합니다. 파일은 임시 파일 작성 후 rename처럼 관찰 가능한 경계를 설계할 수 있습니다.

더 구체적으로 future F가 서버에 주문 키 K를 전송한 뒤 응답을 기다리고 있었다고 하겠습니다. t1에 서버가 K의 결과를 저장하고 t2에 timeout이 F를 drop하면, 클라이언트는 성공 응답을 못 받았어도 주문은 존재합니다. 새 키 K2로 다시 보내는 것은 취소 복구가 아니라 두 번째 주문입니다. 같은 K로 재조회하거나 재요청하여 저장된 결과를 돌려받아야 합니다. 반면 요청을 보내기 전 Future가 drop되었다면 원격 대사가 불필요할 수도 있으므로 전송·접수·확정의 관측 수준을 구분합니다.

로컬 취소 안전성도 별도입니다. `select`에서 선택되지 않은 future가 drop될 때 자료구조에서 이미 꺼낸 값이나 부분 읽기 버퍼가 유실되지 않는지 확인해야 합니다. 어떤 API는 재호출해도 진행 상태가 유지되지만 어떤 API는 중간 상태를 호출자에게 보존하라고 요구합니다. 동기 Drop에서 비동기 정리를 끝까지 await할 수 없으므로, 필수 정리는 명시적인 async 종료와 join 경계로 관리하고 Drop은 최후의 자원 반환 경로로 제한하겠습니다.

## 득점 포인트

- 로컬 drop과 원격 취소·커밋 여부를 세 상태로 나눕니다.
- HTTP timeout에서 서버 커밋 후 응답 유실이라는 반례를 듭니다.
- idempotency와 상태 조회를 재시도 정책과 연결합니다.

## 감점 포인트

- Rust Drop이 peer에 반드시 취소 패킷을 보낸다고 말합니다.
- timeout이면 서버가 변경하지 않았다고 단정합니다.
- 메모리 자원 정리가 분산 rollback을 보장한다고 설명합니다.

## 더 파고들 거리

- unknown 결과를 가진 변경 요청의 상태 머신에서 재시도를 허용하는 조건은 무엇인가요?
- stream read를 await 중 취소할 때 부분 데이터와 다음 프레임 경계를 어떻게 보존하나요?
