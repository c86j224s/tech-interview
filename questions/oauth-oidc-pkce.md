---
id: oauth-oidc-pkce
title: "OAuth/OIDC 로그인에서 PKCE와 state는 콜백 흐름의 어떤 공격·혼동을 각각 줄이며, 둘만으로 검증이 끝나지 않는 이유는 무엇인가요?"
answerMinutes: 5
followups: [{"id":"device-code-login","prompt":"redirect를 받을 브라우저가 없는 콘솔에서 로그인하려면, authorization code 흐름 대신 기기 코드와 별도 승인 화면을 어떻게 사용할까요?"},{"id":"account-linking-proof","prompt":"OIDC ID token의 이메일이 기존 계정과 같을 때 자동 연결하지 않으려면 공급자 subject와 사용자 의도를 어떻게 확인하나요?"},{"id":"csrf-vs-xss","prompt":"로그인 callback에 교차 사이트 이동이 필요하고 브라우저 쿠키로 세션을 만들 때 CSRF와 XSS 방어를 어떻게 분리하나요?"}]
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

Authorization Code Flow에서 PKCE와 state는 서로 다른 대상을 보호합니다. PKCE는 authorization code를 처음 흐름을 시작한 클라이언트에 묶고, state는 브라우저의 로그인 요청과 callback 응답을 묶어 다른 흐름의 응답을 주입하는 혼동을 줄입니다. 둘을 사용해도 redirect URI, issuer·audience·서명·만료와 OIDC ID token의 조건을 생략할 수는 없습니다. OAuth의 권한 위임과 OIDC의 로그인 신원 확인도 별도로 검증해야 합니다.

### 코드 교환과 브라우저 흐름을 묶습니다

클라이언트는 예측하기 어려운 `code_verifier`를 만들고 그 S256 결과를 `code_challenge`로 authorization 요청에 보냅니다. callback으로 받은 code를 token endpoint에서 교환할 때 같은 verifier를 제출하고, 서버가 challenge와 일치하는지 확인합니다. 중간에서 code만 얻은 공격자는 verifier를 모르므로 자신이 만든 클라이언트나 callback에서 쉽게 교환하기 어렵습니다. 공개 클라이언트인 모바일 앱과 SPA에 client secret을 숨겨 두었다고 가정하지 않고 PKCE를 필수 방어선으로 삼겠습니다.

로그인을 시작할 때 state를 브라우저 세션의 연결 시도에 저장하고 callback에서 같은 값인지 비교합니다. state는 code의 소유권을 증명하는 값이 아니라 이 브라우저가 시작한 응답인지 확인하는 값입니다. 연결 시도에는 허용된 redirect URI, 선택한 IdP, 만료 시각, 원래 계정·장치 세션을 함께 기록하고, callback이 다른 세션이나 이미 소비된 시도에 붙으면 거절합니다. redirect URI는 등록값과 엄격히 일치시켜 공격자가 callback을 다른 곳으로 보내지 못하게 합니다.

### OIDC 신원을 별도로 검증합니다

OAuth access token은 API 권한을 위한 토큰이고, 그 access token이 곧 우리 서비스의 로그인 신원을 증명한다고 단정하지 않습니다. OIDC를 사용한다면 ID token의 서명, issuer, 우리 client를 위한 audience, 만료·발급 시각과 필요한 claim을 검증합니다. Code Flow에서 nonce를 요청에 보냈다면 반환된 ID token의 nonce가 같아야 합니다. nonce를 보내지 않은 Code Flow의 유효한 token에 nonce가 없다는 이유로 무조건 거절한다고 일반화하지 않되, 사용하는 프로파일에서 nonce를 요구한다면 그 계약을 따릅니다.

여러 IdP를 지원할 때 issuer를 사용자 입력 이메일이나 callback host로 추정하지 않고 시작한 공급자 설정과 비교합니다. 다른 audience의 ID token, 재사용 code, 잘못된 issuer·redirect, 만료·nonce 불일치·verifier 불일치를 거절하고 code·verifier·token 원문은 로그에 남기지 않습니다. 로그인 성공 뒤에는 공급자 subject와 우리 계정의 연결 정책도 별도로 적용합니다.

테스트는 callback을 다른 브라우저 세션에 주입하는 경우, code 가로채기, 다른 IdP·audience·redirect, nonce를 보냈을 때 불일치, 공개 클라이언트 secret 노출, code 재사용을 포함합니다. PKCE나 state 하나가 ‘OAuth 검증 완료’라는 결론이 아니라, 각 값이 어떤 흐름과 자격을 묶는지 설명할 수 있어야 합니다.

PKCE 검증은 authorization 요청 때 만든 verifier를 클라이언트의 연결 시도 상태에 보관하고 토큰 교환에 사용한 뒤 안전하게 폐기하는 것까지 포함합니다. challenge를 평문 verifier와 함께 보내거나, callback에서 받은 값을 새로 생성한 verifier와 비교하면 코드 탈취 방어가 성립하지 않습니다. state를 URL에만 둔 채 클라이언트가 보관한 시작 세션·연결 시도와 대조하지 않는 구현도 응답 주입을 막지 못합니다. 모바일 앱에서는 등록된 redirect 방식과 앱 간 link 탈취 가능성을 별도로 확인하고, SPA에서는 브라우저에 배포된 코드를 비밀 클라이언트로 보지 않습니다. 검증을 통과한 뒤에도 우리 계정에 어떤 로그인 수단을 연결할지는 계정 모델의 소유권 정책으로 다시 판단합니다.

## 득점 포인트

- PKCE의 verifier/challenge와 state의 브라우저 흐름 연결을 구분한다.
- OAuth access token과 OIDC ID token의 검증 목적을 나눈다.
- redirect·issuer·audience·nonce·재사용 code를 조건부 계약으로 검증한다.
- 공개 클라이언트의 secret 가정과 로그 원문 노출을 배제한다.

## 감점 포인트

- PKCE가 state·redirect·ID token 검증을 모두 대체한다고 말한다.
- access token만 있으면 로그인 신원과 audience가 확인됐다고 말한다.
- 모바일·SPA의 client secret을 안전한 비밀로 가정한다.
- Code Flow의 nonce 조건을 보낸 경우에도 검증하지 않거나 모든 흐름에 같은 조건을 무리하게 일반화한다.

## 더 파고들 거리

- nonce와 state가 각각 어느 세션·자격에 묶여야 하는지 비교해 보세요.
- 여러 IdP의 동일 이메일과 서로 다른 issuer를 계정 모델에서 어떻게 처리할까요?
- callback 응답 유실과 code 재시도를 안전하게 처리하는 상태는 무엇일까요?
