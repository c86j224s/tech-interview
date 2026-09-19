---
id: oidc-rp-initiated-logout
title: RP-Initiated Logout 요청에서 어떤 값을 검증하고 무엇을 보장하지 않나요?
difficulty: 중하
category: 보안
tags:
  - OIDC
  - logout
  - 세션
related:
  - oidc-nonce-state-binding
---
# RP-Initiated Logout 요청에서 어떤 값을 검증하고 무엇을 보장하지 않나요?

## 구두 답변

RP-Initiated Logout에서는 먼저 “어느 RP 세션이 이 요청을 시작했는가”와 “OP에 어떤 로그아웃 요청을 보낼 것인가”를 분리해 검증합니다. RP가 저장한 issuer와 client_id가 현재 로그인 세션의 값과 맞는지 확인하고, `id_token_hint`를 사용한다면 저장된 로그인 거래의 서명·`iss`·`aud`와 해당 client·세션 문맥을 검사합니다. OP는 현재 또는 최근 세션을 가리키는 만료된 ID Token도 로그아웃 힌트로 수용하도록 권고되므로, 로그인 때의 exp 거절 규칙을 그대로 적용해 정상 로그아웃을 막지 않습니다. `post_logout_redirect_uri`는 OP에 등록한 정확한 URI와 일치하는 값만 선택합니다. `/logout/callback?next=https://임의-호스트`처럼 요청의 URL을 그대로 복사하면 로그아웃 기능이 open redirect가 되므로 허용 목록에서 서버가 고릅니다. `state`를 넣는다면 로그아웃 거래 ID와 묶어 callback의 재전달·혼동을 검증합니다. 예를 들어 S2 세션에서 `id_token_hint`의 `aud=client-a`, redirect가 등록된 `/signed-out`이면 요청을 만들 수 있지만, `aud=client-b`나 미등록 redirect면 OP로 보내기 전에 거절합니다.

이 흐름이 보장하는 것은 OP logout endpoint로의 유효한 시작과 허용된 복귀 경로이지, 모든 자격의 즉시 폐기는 아닙니다. RP는 버튼을 누른 순간 자기 세션 행을 `revoked_at`으로 바꾸고 cookie에 만료 `Set-Cookie`를 보내며, S2에 매핑된 refresh-token family를 원자적으로 무효화합니다. 그 뒤 OP로 이동해도 되고, redirect를 잃어도 local sign-out은 끝나 있어야 합니다. OP가 성공 페이지로 돌아왔다고 RP DB 세션이 자동 삭제되거나 다른 기기의 S1 세션, 이미 발급된 access token, 진행 중인 결제가 되돌아가는 것은 아닙니다. 화면에도 “이 브라우저의 RP 로그아웃 완료”와 “OP 로그아웃 요청 결과”를 분리해 표시하고, 다른 기기 전체 종료는 별도의 계정 보안 동작으로 모델링하겠습니다.

## 득점 포인트

- 등록된 post_logout_redirect_uri의 정확한 일치와 id_token_hint의 issuer·audience 문맥을 검증합니다.
- RP local session·cookie·refresh family 회수와 OP 세션 종료 결과를 별도 상태로 기록합니다.
- S2 로그아웃과 임의 redirect 입력을 대비해 허용 범위와 실패 결과를 설명합니다.

## 감점 포인트

- OP redirect 성공을 모든 기기·토큰·외부 효과 취소로 해석합니다.
- 사용자가 준 redirect URL을 그대로 callback으로 사용합니다.

## 더 파고들 거리

- redirect 응답이 유실돼도 local revoke를 유지하는 멱등 설계를 말해 보세요.
- 여러 기기 전체 로그아웃을 현재 세션 로그아웃과 어떤 데이터 범위로 나누겠습니까?
