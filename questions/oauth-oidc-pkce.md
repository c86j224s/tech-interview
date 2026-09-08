---
id: oauth-oidc-pkce
title: "OAuth/OIDC 로그인에서 PKCE와 state는 콜백 흐름의 어떤 공격·혼동을 각각 줄이며, 둘만으로 검증이 끝나지 않는 이유는 무엇인가요?"
difficulty: 하
category: 보안
tags:
  - "OAuth"
  - "OIDC"
  - "PKCE"
  - "state"
related: ["authentication-vs-authorization"]
---

# OAuth/OIDC 로그인에서 PKCE와 state는 콜백 흐름의 어떤 공격·혼동을 각각 줄이며, 둘만으로 검증이 끝나지 않는 이유는 무엇인가요?

## 구두 답변

여기서는 인증 코드를 받은 뒤 토큰으로 교환하는 **Authorization Code Flow**에 PKCE와 state를 사용하는 로그인을 설명합니다. PKCE는 authorization code와 처음 로그인 흐름을 시작한 클라이언트를 연결합니다. 클라이언트가 예측하기 어려운 `code_verifier`(나중에 제출할 비밀값)를 만들고 S256 방식으로 그 SHA-256 해시를 base64url 인코딩한 `code_challenge`(서버에 미리 보내는 검증값)를 authorization 요청에 보낸 뒤, token 교환 때 verifier를 제출합니다. 중간에서 code를 얻은 공격자가 verifier를 모르면 교환하기 어렵게 하는 장치입니다. `state`는 브라우저 세션에 묶인 임의 값을 저장하고 콜백에서 비교해, 내가 시작하지 않은 authorization response를 내 로그인 요청으로 받아들이는 혼동을 줄입니다.

두 장치는 구분해서 이해해야 하지만 공격 방어 역할이 일부 겹칠 수 있습니다. 검증된 PKCE 흐름이 CSRF 방어에 쓰이는 경우도 있으므로 지원 프로토콜의 요구를 확인하겠습니다. 여기서는 state로 브라우저 요청을 연결하고 PKCE로 코드 교환을 보호하는 구성을 사용하며, 리다이렉트 주소와 세션 검증을 생략하지 않겠습니다. OAuth access token은 권한 위임을 위한 토큰이고, 로그인 신원은 OIDC ID token의 issuer(발급자), audience(이 토큰을 받도록 지정된 클라이언트), 서명과 만료 등 해당 흐름의 검증 규칙을 확인해야 합니다. **Code Flow에서 nonce는 요청 시 선택 사항이며, 보냈다면 ID 토큰에 같은 nonce가 존재하는지 반드시 검증**합니다. nonce는 로그인 요청과 토큰을 묶는 임의값입니다. nonce를 보내지 않은 유효한 Code Flow까지 claim이 없다는 이유만으로 거절해서는 안 됩니다. 다른 흐름이나 별도 보안 프로파일에서는 nonce가 필수일 수 있으므로 이 조건을 모든 OIDC 흐름으로 일반화하지 않겠습니다. 다른 발급자의 토큰이나 우리 앱이 아닌 audience의 토큰을 받으면 로그인 성공으로 처리하지 않습니다. redirect URI는 사전 등록한 값과 엄격히 일치시킵니다. 모바일·SPA 공개 클라이언트에 숨겨 둔 client secret이 안전하다고 가정하지 않습니다.

검증 실패·재사용 code·다른 audience/issuer·nonce 불일치·잘못된 redirect를 거절하고, code·verifier·토큰을 로그에 남기지 않겠습니다. 성공 경로보다 콜백을 다른 세션에 주입하거나 기기를 바꾼 경우의 세션 연결을 시험해 OAuth 위임과 OIDC 인증을 혼동하지 않는지 확인합니다.

## 득점 포인트

- PKCE의 verifier/challenge와 state의 세션 연결 역할을 분리한다.
- OAuth access token과 OIDC ID token 검증을 구분한다.
- redirect·issuer·audience·재사용 code의 거절 경로를 확인하고, Code Flow에서는 요청에 nonce를 보냈을 때 그 존재와 일치를 검증한다고 설명한다.

## 감점 포인트

- PKCE가 모든 CSRF·callback 검증을 대체한다고 말한다.
- access token만 있으면 신원·audience 검증이 끝난다고 말한다.
- 모바일·SPA에 넣은 client secret을 비밀로 가정한다.
- Code Flow에서 nonce가 언제나 필수라고 말하거나, 요청에 보낸 nonce를 반환 토큰과 비교하지 않는다. 선택적으로 보내는 것과 보낸 뒤 반드시 검증하는 것은 다른 조건이다.

## 더 파고들 거리

- nonce와 state는 각각 어떤 대상을 검증하고 어디에 묶어 보관해야 하나요?
- 여러 IdP를 지원할 때 issuer와 redirect 응답의 혼동을 어떻게 막을까요?
- 로그인을 시작한 기기와 callback을 받은 기기가 다르면 어떤 세션·사용자 승인 연결이 필요한가요?
