---
id: oauth-par-jar-integrity
title: OAuth PAR·JAR 요청 무결성
topic: 보안
summary: 브라우저 전면 요청을 백채널 PAR와 서명된 JAR로 묶어 authorization request 변조·노출을 제한합니다.
questionIds: []
prerequisites:
  - oauth2-foundations
  - login-transaction
related:
  - oauth2-foundations
  - oidc-foundations
  - login-transaction
reviewedAt: '2026-09-19'
---
# OAuth PAR·JAR 요청 무결성

OAuth authorization request를 query parameter로 브라우저에 보내면 `client_id`, `redirect_uri`, `scope`, `state` 같은 값이 user-agent의 URL을 지나갑니다. TLS는 전송 구간을 보호하지만 URL이 브라우저 기록·서버 로그·referrer에 남는 문제와, 애플리케이션 계층에서 parameter가 바뀌었는지 즉시 알기 어려운 문제까지 해결하지는 않습니다. **JAR**(JWT-secured Authorization Request)는 요청 객체를 JWT로 서명해 내용과 client 문맥을 묶고, **PAR**(Pushed Authorization Request)는 요청 payload를 백채널에서 AS에 먼저 등록한 뒤 브라우저에는 `request_uri`라는 참조만 보냅니다.

둘은 같은 기능의 중복이 아닙니다. JAR의 중심은 “이 요청 내용이 등록 client가 만든 것인가”이고, PAR의 중심은 “브라우저 front channel에 전체 payload를 싣지 않고 AS가 저장한 요청을 찾아 처리하는가”입니다. PAR가 authorization request를 자동으로 올바르게 만드는 것도, JAR가 redirect 등록·state·PKCE를 없애는 것도 아닙니다.

## 전면 authorization request의 노출면

기본 code flow에서 client는 브라우저를 `/authorize?...`로 이동시킵니다. scope가 `orders.read payments.write`라면 이 값과 redirect URI가 URL에 실립니다. 사용자가 URL을 직접 수정하거나 중간 시스템이 query를 바꾸면 AS가 변경된 값을 처리할 수 있습니다. 공격자가 scope를 넓히거나 결제 transaction의 context를 바꾸는 것은 단순 개인정보 노출을 넘어 승인 대상 자체를 바꾸는 문제입니다.

JAR는 request object에 authorization parameter를 claim으로 넣고 JWS 서명합니다. 서명된 객체에는 적절한 경우 `iss`가 client 식별자, `aud`가 AS issuer가 되며, `response_type`, `client_id`, `redirect_uri`, `scope`, `state`, `nonce`, `exp`, `iat`, `jti` 등 흐름에 필요한 값이 들어갑니다. AS는 client 등록에서 얻은 검증 키로 서명을 확인하고 issuer·audience·시간·client 정책을 검사한 뒤 어떤 parameter를 실제 요청으로 사용할지 결정합니다.

서명을 확인하지 않은 외부 query와 서명된 claim이 다를 때 우선순위를 애매하게 두면 변조가 살아납니다. 예를 들어 signed object의 scope가 `orders.read`인데 외부 query에 `payments.write`가 들어왔을 때, AS가 외부 query를 병합하면 JAR의 의미가 무너집니다. JAR request object를 사용하는 모드에서는 RFC 9101의 규칙에 따라 authorization parameter는 Request Object에서만 추출해 사용해야 합니다. query에 같은 parameter가 중복되어도 query 값을 병합하거나 우선하지 않으며, query의 client_id가 있다면 Request Object의 client_id와 같아야 합니다. JAR를 사용하지 않는 기본 요청의 query 처리와 이 규칙을 섞지 않습니다.

## JAR 서명과 parameter 조립

JAR는 JWS 또는 필요에 따라 JWE와 결합할 수 있지만, 암호화 여부가 무결성 검증을 대신하지는 않습니다. AS는 client별 허용 알고리즘·키 집합을 신뢰 설정에서 선택하고, JWT header의 `alg`·`kid`를 이용해 임의 키 URL을 따라가지 않습니다. public client라면 서명 키의 배포와 회전·등록 방식이 별도 계약이어야 하며, “JWT라서 신뢰”는 근거가 아닙니다.

검증을 다음 단계로 나누면 request object의 실패를 인증과 parameter 오류로 구분할 수 있습니다.

- request object가 JWT 문법·크기·중첩 조건을 만족하는지 확인합니다.
- client 등록 설정으로 서명 키와 허용 알고리즘을 고르고 JWS를 검증합니다.
- `iss`, `aud`, `client_id`, `iat`, `exp`, 필요 시 `jti`와 요청의 redirect·response type을 정책에 맞게 확인합니다.
- 외부 query와 signed claim의 조립 규칙을 적용하고, redirect URI를 등록값과 비교합니다.
- state·PKCE·nonce 등 로그인 transaction 값은 기존 callback 거래와 연결해 검증합니다.

JAR의 서명은 요청 객체가 client 키로 만들어졌다는 사실을 보여주지만, 그 client가 요청한 scope를 사용자가 승인했는지, callback이 같은 브라우저 거래인지, code 교환 verifier가 맞는지는 별도 단계입니다. 따라서 서명 검증 성공을 곧 authorization 완료나 로그인 성공으로 기록하면 안 됩니다.

```diagram
{"title":"JAR와 PAR의 신뢰 경계","caption":"JAR는 request 내용의 서명과 client 결합을, PAR는 payload를 AS에 저장하고 브라우저에는 참조만 운반하는 역할을 맡습니다.","rows":[[{"id":"client","label":"Client","detail":["request object 생성","PAR 백채널 제출"]}],[{"id":"asrecord","label":"AS 저장 요청","detail":["검증된 client 문맥","scope·redirect·시간"]}],[{"id":"browser","label":"Browser front channel","detail":["request_uri만 운반","전체 payload 최소화"]}],[{"id":"authorize","label":"Authorization endpoint","detail":["request_uri 조회","등록·승인·거래 검증"]}]],"edges":[{"from":"client","to":"asrecord","label":"서명·인증된 push"},{"from":"asrecord","to":"browser","label":"opaque reference 발급"},{"from":"browser","to":"authorize","label":"참조 제출"},{"from":"asrecord","to":"authorize","label":"저장 payload 사용"}]}
```

## PAR 백채널 거래

PAR endpoint는 client가 authorization request payload를 AS에 직접 push하고, 성공 응답으로 `request_uri`와 `expires_in`을 받는 흐름을 정의합니다. 이후 브라우저는 `/authorize?client_id=...&request_uri=...`처럼 참조를 보냅니다. AS는 request URI가 가리키는 record를 조회해 client 문맥과 요청 parameter를 사용합니다. 기밀 client의 PAR endpoint 인증은 client authentication 정책의 일부이며, public client의 인증 방법과 동일하게 가정하지 않습니다.

설명용 상태를 추적해 보겠습니다. client가 `T42`에 `redirect=https://app.example/cb`, `scope=orders.read`, `state=S9`, `code_challenge=C9`, `exp=12:01`을 push하고 AS가 `urn:example:par:U7`, `expires_in=90`을 돌려줍니다. 브라우저가 `U7`을 제출하면 AS는 12:00:40에 record를 찾아 `orders.read`와 등록 redirect를 사용합니다. 브라우저 query에 `scope=payments.write`를 덧붙여도, AS가 request URI record를 권위 있는 payload로 처리한다면 권한 범위가 넓어지지 않습니다. 12:02에 같은 U7을 보내면 만료 정책에 따라 거절됩니다.

PAR 자체가 URL의 모든 정보 노출을 없애지는 않습니다. `request_uri`가 referrer·로그에 남을 수 있으므로 opaque하고 추측하기 어렵게 만들어야 하며, record 안에 개인정보를 불필요하게 오래 보관하지 않습니다. request URI가 client와 분리되어 교환되거나, 한 client가 다른 client의 URI를 사용하거나, AS가 URI를 무기한 재사용하면 PAR의 백채널 경계가 약해집니다.

## 만료와 재사용 경계

PAR 규격은 response에 `expires_in`을 제공하는 흐름을 정의하지만 정확한 lifetime 숫자는 AS 정책입니다. 짧은 lifetime은 도난한 URI의 재사용 창을 줄이지만 사용자가 승인 화면에서 오래 머물거나 네트워크 재시도가 많은 환경에서는 실패율이 올라갑니다. “opaque reference라서 인증이 필요 없다”는 판단도 위험합니다. request URI를 가진 공격자가 요청 내용 전체를 다시 받거나 승인 거래를 시작할 수 있기 때문입니다.

record에는 최소한 URI 식별자, client 식별자, payload, 생성·만료 시각, 사용 또는 취소 상태를 둡니다. 동일 URI의 재사용을 허용할지 일회 소비로 할지는 authorization endpoint의 사용자 경험과 구현 계약을 먼저 결정해야 합니다. 일회 소비라면 authorize 진입에서 `pending → consumed`를 원자적으로 전환하고, 브라우저가 새로고침했을 때 애매한 상태를 사용자에게 다시 로그인하도록 안내합니다. 여러 단계 승인 화면을 지원한다면 “조회”와 “승인 완료”를 나누어 어느 시점에 소비할지 명확히 해야 합니다.

client/session binding도 필요합니다. request URI가 특정 client가 push한 record를 가리키는데 다른 `client_id`가 함께 오면 거절해야 합니다. AS가 바뀐 client policy를 record 생성 뒤 적용할지, 생성 당시 policy를 보존할지는 RFC가 제품의 모든 정책을 정해 주는 영역이 아니므로 운영 결정을 기록해야 합니다. 이 값들을 모른 채 “항상 한 번만 사용”이나 “몇 분”을 표준 의무처럼 쓰지 않습니다.

## PAR와 JAR의 조합

높은 보장이 필요한 거래에서는 client가 JAR를 만들고 PAR로 push한 뒤 authorize에는 request URI만 보냅니다. 이때 JAR는 signed `redirect_uri`, scope, response type, nonce 같은 payload가 client 키로 묶였음을 보이고, PAR는 그 payload가 user-agent query를 통과하지 않고 AS record로 전달되게 합니다. 기밀성까지 필요하면 JWE를 검토할 수 있지만, request URI와 AS record 접근 정책은 여전히 필요합니다.

조합의 상태를 다시 보면 `JAR(J42)`가 `client=C1, aud=AS1, redirect=R1, scope=orders.read, exp=12:01`을 담고 있습니다. PAR push가 서명과 client 인증을 확인하고 `U7 → J42` record를 만듭니다. authorize는 U7을 조회해 J42의 내용을 사용하고, callback 이후에는 기존 login transaction의 state·PKCE·nonce를 검증합니다. JAR만 query로 전달할 때에는 request object URI를 AS가 fetch하는 추가 위험이 생길 수 있지만, PAR는 client가 직접 payload를 제출해 이 fetch 경로를 줄이는 구성입니다.

여기서 역할을 섞으면 안 됩니다. JAR/PAR는 authorization request의 integrity와 전달 위치를 강화하지만, redirect URI 등록 검증·authorization code 일회성·PKCE verifier·OIDC ID token의 issuer/audience/nonce 검증은 살아 있습니다. 특히 state를 JAR 안에 서명했다는 이유로 callback이 어떤 브라우저 세션에서 시작됐는지 확인하지 않으면 응답 주입 방어를 잃습니다.

## 실패 시나리오와 운영 비용

대표적인 실패는 signed object의 서명은 확인하지만 `aud`를 확인하지 않는 경우, request object의 `redirect_uri`를 등록값과 비교하지 않는 경우, 외부 query를 signed claim보다 우선하는 경우입니다. `kid`를 이용해 client가 지정한 외부 JWKS URL을 그대로 fetch하면 SSRF·키 혼동 위험이 생기므로 키 소스는 등록 신뢰 경계에서 선택합니다. PAR에서도 URI를 생성 순서값처럼 예측 가능하게 만들거나, 다른 client의 URI를 받아들이거나, 만료를 무시하면 request swapping·replay가 남습니다.

운영 비용은 단순 endpoint 하나 추가보다 큽니다. AS는 record 저장·TTL 정리·동시 소비·client authentication·관측을 운영해야 합니다. 브라우저 단계에서는 request URI만 보이지만, 장애 분석에는 transaction ID와 AS 내부 record ID의 안전한 상관관계가 필요합니다. request parameter와 consent 화면의 실제 표시가 signed payload와 일치하는지 UI 테스트도 해야 합니다.

검증 시험은 다음 순서로 구성합니다. 정상 JAR의 서명·issuer·audience·redirect를 통과시킨 뒤 scope를 외부 query에서 넓혔을 때 거절 또는 signed 값 유지를 확인합니다. 다른 client 키로 서명한 객체, 만료된 `exp`, AS가 아닌 audience, 미등록 redirect, 허용하지 않은 algorithm을 각각 거절합니다. PAR URI를 다른 client와 바꾸거나 만료 뒤 재사용하고, 두 worker가 동시에 소비할 때 정책에 맞는 하나의 결과가 나오는지 확인합니다.

이 문서의 시간값과 U7/J42는 설명용 trace이며 실제 AS를 실행한 결과가 아닙니다. 근거는 RFC 9126(2021-09, Proposed Standard)과 RFC 9101(2021-08, Proposed Standard) 원문입니다. provider가 PAR/JAR를 어떻게 조합하는지, request URI를 몇 초 보존하는지, client별 parameter precedence가 무엇인지는 배포 설정으로 확인해야 합니다.

## 참고 자료와 경계

- [RFC 9126: OAuth 2.0 Pushed Authorization Requests](https://www.rfc-editor.org/rfc/rfc9126.html) — 2021-09, Proposed Standard. PAR endpoint, request URI, front-channel 노출과 URI guessing·replay·swapping 고려사항을 대조했습니다.
- [RFC 9101: OAuth 2.0 JWT-Secured Authorization Request](https://www.rfc-editor.org/rfc/rfc9101.html) — 2021-08, Proposed Standard. request object, JWS/JWE, `iss`·`aud`, parameter assembly와 validation을 대조했습니다.
- [OAuth 2.0 권한 위임](/tech-interview/notes/oauth2-foundations/), [OAuth·OIDC 로그인 거래](/tech-interview/notes/login-transaction/) — 일반 token 목적과 state·PKCE·nonce 연결을 기존 내용과 구분했습니다.
- 특정 AS의 request URI 수명, 재사용/소비 시점, client policy 변경 규칙은 이 저장소에서 확정되지 않아 제품 정책으로 남겼습니다.
