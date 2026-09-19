---
id: par-expiry-replay
title: PAR request URI의 만료와 재사용을 어떻게 설계하나요?
difficulty: 하
category: 보안
tags:
  - OAuth
  - PAR
  - 재생
related:
  - idempotency-record-expiry-contract
---
# PAR request URI의 만료와 재사용을 어떻게 설계하나요?

## 구두 답변

PAR `request_uri`는 authorization request record를 가리키는 opaque reference이므로, 설계의 기준은 문자열 자체가 아니라 record의 소유·수명·상태입니다. push 성공 때 AS는 `expires_in`을 응답하고, 저장소에는 URI 식별자, client ID, payload, 생성·만료 시각, 취소·소비 상태를 둡니다. authorize 단계에서 URI가 만료되지 않았는지, 함께 온 client 문맥과 record가 일치하는지, 이미 금지된 상태인지 확인합니다. 정확한 수명과 소비 시점은 RFC가 모든 AS에 동일한 숫자로 고정하지 않으므로 승인 화면의 체류 시간과 도난 창을 함께 평가합니다.

예를 들어 C1의 U7이 12:01에 만료된다면 12:00:40의 authorize는 정상 조회되고 12:02는 거절됩니다. C2가 U7을 제출해도 client binding 실패입니다. 일회 소비 정책이면 두 worker가 동시에 `pending`을 읽지 않도록 조건부 update로 `pending → consumed`를 한 번만 성공시켜야 합니다. 다만 다단계 동의 화면에서 조회 즉시 consumed로 바꾸면 사용자의 새로고침이 합법 거래를 깨뜨립니다. 그래서 authorize 진입·동의 완료·code 발급 중 어느 경계를 소비점으로 삼을지 먼저 정하고, 재시도 시 새 PAR를 발급할지 정의합니다.

짧은 TTL은 URI 탈취 후 재사용 창을 줄이지만 느린 사용자의 실패율, 저장소 만료 정리, 네트워크 retry 비용을 높입니다. URI가 opaque여도 possession만으로 민감한 흐름을 시작할 수 있으므로 추측 불가능성과 client/session 결합이 필요합니다. 같은 URI를 반복 허용하는 정책이라면 허용 횟수와 transaction 상태를 제한하고, “PAR가 idempotency key처럼 모든 retry를 보장한다”고 가정하지 않습니다. 로그에는 URI 원문 대신 내부 transaction ID를 남깁니다.

## 득점 포인트

- record에 client·expiry·상태를 넣고 U7의 성공·실패 시간을 추적한다.
- 동시 일회 소비를 조건부 상태 전이로 구현한다.
- TTL을 도난 창과 승인 UX·저장 비용 사이의 정책으로 판단한다.

## 감점 포인트

- opaque URI라서 만료와 client binding이 필요 없다고 한다.
- request 내용이 변하지 않으면 무기한 재사용해도 안전하다고 말한다.
- PAR 재시도가 자동으로 idempotency 결과를 보장한다고 단정한다.

## 더 파고들 거리

- request URI guessing과 swapping을 각각 어떻게 시험할까요?
- record 생성 뒤 client policy 변경을 어느 시점에 적용할까요?
