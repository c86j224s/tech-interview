---
id: oidc-logout-sid-iss
title: Back-Channel Logout의 sid와 iss는 어떤 세션을 찾기 위한 값인가요?
difficulty: 중하
category: 보안
tags:
  - OIDC
  - back-channel logout
  - sid
related:
  - jwt-vs-server-session
---
# Back-Channel Logout의 sid와 iss는 어떤 세션을 찾기 위한 값인가요?

## 구두 답변

`iss`와 `aud`는 통지가 어느 OP에서 왔고 어느 RP를 대상으로 하는지 제한하고, `sid`는 그 OP의 특정 로그인 세션과 RP 세션을 잇는 상관 키입니다. RP는 logout token을 일반 ID token처럼 사용자 로그인에 쓰지 않고, 먼저 JWT 서명과 허용 issuer, 우리 client인 audience, logout-event claim을 검증합니다. `sid=S2`가 있으면 `(issuer, client, sid)`로 세션 매핑을 찾아 S2의 RP cookie에 대응하는 서버 세션과 refresh family만 revoke합니다. 같은 사용자의 S1은 그대로 남아 있어야 합니다. `sub`만으로 찾으면 여러 기기와 브라우저가 함께 지워지는 과잉 로그아웃이 됩니다.

중요한 반례는 sid가 없는 token입니다. Back-Channel Logout의 규칙상 `sub`와 `sid` 중 적어도 하나가 있어야 하고, 유효한 `iss`·`sub`가 있으면서 sid가 없으면 해당 issuer와 이 RP에 속한 사용자의 RP 세션 전체가 대상입니다. 따라서 이를 “sid가 없으니 아무 것도 하지 않는다”로 바꾸거나 반대로 모든 provider와 모든 client를 삭제하는 것은 모두 잘못입니다. 특정 세션 상관을 반드시 요구하는 RP라면 등록 메타데이터에서 session-required 정책을 선택하고 sid 없는 token을 거절한다고 명시해야 합니다. 처리 결과는 token 식별자나 `(iss,sid)`를 멱등 키로 기록하고, 이미 revoked인 행에 같은 통지가 재도착해도 성공으로 처리합니다. 외부 결제 취소나 브라우저 cookie 삭제까지 token 자체가 수행하는 것은 아니므로 별도 경계를 둡니다.

## 득점 포인트

- iss·aud·서명 검증 후 sid가 있는 경우 특정 RP session만 찾습니다.
- sid 없는 유효 token은 해당 iss·sub의 이 RP 세션 전체 대상이라는 규칙을 설명합니다.
- 다른 client audience와 중복 전달을 격리·멱등 처리합니다.

## 감점 포인트

- sid가 없으면 아무 것도 하지 않거나 모든 provider 계정을 지운다고 단정합니다.
- audience 없이 서명만 맞는 token을 처리합니다.

## 더 파고들 거리

- session-required 등록 정책에서 sid 누락을 어떻게 거절할지 말해 보세요.
- 기존 session에 sid가 없는 경우 어떤 보정 매핑을 두겠습니까?
