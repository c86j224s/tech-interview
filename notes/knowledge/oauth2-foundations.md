---
id: oauth2-foundations
title: OAuth 2.0 권한 위임
topic: 보안
summary: OAuth 2.0의 행위자와 메시지 경계를 따라 권한 위임 거래와 토큰별 책임을 실제 요청 순서로 설명합니다.
questionIds: []
prerequisites: [security-foundations]
related: [login-transaction, session-authority, browser-request-security]
reviewedAt: '2026-09-17'
---

# OAuth 2.0 권한 위임

## 권한 위임의 출발점

사용자 대신 주문 API를 호출해야 하는 애플리케이션이 있다고 합시다. 애플리케이션이 사용자의 비밀번호를 직접 받으면 비밀번호 수집·보관·변경·회수 책임까지 애플리케이션으로 퍼집니다. OAuth 2.0은 이 문제를 사용자가 승인한 범위의 접근 자격을 발급하는 일과, 그 자격으로 보호된 자원에 접근하는 일을 분리해 다룹니다.

여기서 권한 위임은 로그인과 같은 말이 아닙니다. 로그인은 주체가 누구인지 확인하는 인증이고, OAuth 2.0의 중심 질문은 특정 client가 어떤 protected resource에 어떤 범위로 접근할 수 있는지입니다. OpenID Connect는 OAuth 2.0 위에 인증 정보를 추가하는 별도 규격입니다. 따라서 OAuth access token만으로 우리 서비스의 로그인 계정을 정하지 않습니다.

이 구분을 먼저 세워 두면 “token을 받았으니 로그인 성공”이라는 설계 오류를 피할 수 있습니다. 로그인 제품이 API 접근까지 필요하다면 OAuth의 권한 결과와 OIDC의 신원 결과를 각각 검증하고, 서로 다른 사용처에 저장해야 합니다.

## 네 행위자와 신뢰 경계

OAuth 2.0의 네 행위자는 resource owner, client, authorization server, resource server입니다. Resource owner는 보호된 자원에 대한 권한을 가진 주체이고, client는 그 권한을 대신 사용하려는 애플리케이션입니다. Authorization Server(이하 AS)는 승인과 token 발급을 담당하며, Resource Server(이하 RS)는 실제 API와 데이터를 보호합니다.

한 제품이 AS와 RS를 함께 구현할 수는 있습니다. 그래도 “누가 승인·발급을 했는가”와 “누가 API 요청을 허용하는가”라는 메시지 책임은 분리해 설계해야 합니다. 역할을 한 서비스에 합쳤다는 이유로 access token을 곧바로 내부 관리자 권한으로 해석해서는 안 됩니다.

`client_id`는 등록된 client를 식별하는 값이지 그 자체로 비밀이 아닙니다. 배포된 JavaScript와 모바일 애플리케이션에 들어 있는 client_id는 공개되어도 이상하지 않습니다. 앱에 들어 있는 secret처럼 보이는 문자열도 사용자가 코드와 저장소를 통제할 수 있는 배치에서는 confidential credential로 간주하지 않습니다.

| 행위자 | 맡은 일 | 신뢰해야 할 입력 |
| --- | --- | --- |
| Resource owner | 접근을 승인할 권한의 보유 | 사용자의 실제 승인과 정책 |
| Client | 승인을 요청하고 발급 자격을 사용 | 등록 설정과 현재 거래 |
| Authorization Server | 인증·승인·code와 token 발급 | client 등록, 사용자 세션, 정책 |
| Resource Server | access token으로 API 요청 판단 | 검증된 token 문맥과 자원 정책 |

## Endpoint와 메시지 경계

Authorization endpoint는 사용자의 브라우저 또는 외부 user-agent를 거쳐 승인 화면으로 연결되는 지점입니다. Client는 여기에 response type, client_id, redirect URI, scope 같은 승인 요청을 보냅니다. 사용자가 승인하면 AS는 등록된 redirect URI로 authorization response를 돌려보냅니다.

Token endpoint는 authorization response에서 받은 code를 access token 등으로 교환하는 지점입니다. 이 교환은 authorization endpoint의 브라우저 이동과 다른 요청입니다. Client는 code와 자신의 거래 문맥을 token endpoint에 제출하고, AS는 code의 만료·일회성·client·redirect 문맥을 확인한 뒤 결과를 돌려줍니다.

```diagram
{"title":"승인과 자원 접근의 책임 경계","caption":"브라우저를 지나는 승인 응답과 직접 교환하는 token 요청을 분리합니다. access token은 RS에, refresh token은 AS에만 향합니다.","rows":[[{"id":"owner","label":"Resource owner","detail":["사용자 승인"]},{"id":"client","label":"Client","detail":["승인 요청·token 사용"]}],[{"id":"as","label":"Authorization Server","detail":["code·token 발급"]}],[{"id":"rs","label":"Resource Server","detail":["API·자원 보호"]}],[{"id":"tokens","label":"토큰 결과","detail":["code·access·refresh"]}]],"edges":[{"from":"owner","to":"as","label":"승인 화면"},{"from":"client","to":"as","label":"authorization request"},{"from":"as","to":"client","label":"code·token response"},{"from":"client","to":"rs","label":"access token"},{"from":"client","to":"as","label":"refresh token"},{"from":"as","to":"tokens","label":"발급"}]}
```

refresh token이 RS로 가지 않는 이유는 목적이 다르기 때문입니다. Refresh token은 AS에서 새 access token을 얻는 자격이고, RS가 주문 API를 처리하는 데 필요한 입력은 access token입니다. 실제 전송 방식과 저장 위치는 client 유형에 따라 달라져도 이 방향성은 유지해야 합니다.

## 토큰 목적과 수명

Authorization code는 승인 결과를 바로 API 자격으로 쓰지 않게 하는 짧은 수명의 중간값입니다. Callback URL에 code가 나타나더라도 그 문자열만으로 API를 호출하지 않습니다. Code는 token endpoint에서 거래 문맥과 함께 교환되고, 소비된 뒤 다시 사용할 수 없어야 합니다.

Access token은 RS의 protected resource 요청에 제시하는 자격입니다. RS는 단순히 서명이 맞는지만 보지 말고, 자신의 issuer·audience·scope·만료 정책에 맞는지 확인한 뒤 요청한 행동과 자원을 인가합니다. 어떤 token이 유효하다는 사실과 이 API 요청이 허용된다는 사실은 같은 문장이 아닙니다.

Refresh token은 AS에서 새 access token을 받기 위한 장기 자격입니다. 일반적인 resource request에 보내지 않으며, 로그·일반 데이터베이스·URL에 원문을 남기지 않습니다. 회전, sender constraint(자격 사용자를 특정 키나 채널에 묶는 방식), 회수 정책은 client 유형과 위협 모델, AS 지원을 함께 정해야 합니다.

| 값 | 발급·사용 주체 | 기본 목적 | 실패 시 해석 |
| --- | --- | --- | --- |
| code | AS가 client에 발급, client가 AS에 교환 | 승인 결과의 일회성 전달 | 만료·재사용·문맥 불일치 |
| access token | AS가 client에 발급, client가 RS에 제출 | 보호 자원 요청 | issuer·audience·scope·시간 거절 |
| refresh token | AS가 client에 발급, client가 AS에 제출 | access token 갱신 | 계열 회수·재사용·만료 |
| ID Token | OIDC에서 AS가 client에 발급 | 인증 결과 주장 | OAuth access token으로 대체 불가 |

## OAuth와 OIDC의 목적 차이

`openid` scope가 없는 일반 OAuth 거래는 API 접근 위임이 목적입니다. OIDC 거래는 `openid` scope와 ID Token을 추가해 client가 인증 결과를 처리할 수 있게 합니다. 두 결과가 한 token response에 함께 들어올 수 있지만, 검증 결과와 사용처를 한 변수로 뭉치지 않습니다.

다른 애플리케이션을 위한 access token이 서명상 유효하더라도 우리 client의 로그인 신원은 되지 않습니다. 마찬가지로 유효한 ID Token을 주문 API의 bearer 자격으로 보내면 RS의 access-token 정책과 맞지 않을 수 있습니다. Token의 문자열 형식이 JWT인지보다 발급 목적·audience·검증 정책이 우선입니다.

이 경계는 기존 [인증된 요청의 자원별 권한 검사](/tech-interview/notes/authentication/)와 이어집니다. 먼저 검증된 자격에서 주체 문맥을 만들고, 그 다음 서버가 읽은 실제 자원과 행동을 비교합니다. 요청 본문의 `user_id`가 token의 주체를 바꾸지 않는다는 원칙도 그대로 적용됩니다.

## 기본 거래 상태

최소 Authorization Code 거래는 `start → authorize → callback(code) → exchange → resource access` 순서로 이해할 수 있습니다. `start`에서 client는 provider 설정, redirect URI, 요청 scope, 거래 만료 시각을 선택합니다. 사용자는 AS에서 인증하고 권한을 승인한 뒤 callback으로 돌아옵니다. callback의 code 수신은 거래 완료가 아니라 다음 검증을 시작하는 상태입니다.

예를 들어 주문 화면이 `openid profile orders.read`를 요청하고, AS가 `code=C91`을 돌려줬다고 합시다. 아래 숫자는 실제 provider 응답이 아니라 상태 전이를 설명하기 위한 예시입니다.

| 시점 | Client 상태 | AS·RS에서 확인할 것 |
| --- | --- | --- |
| t0 | 거래 T1 생성, 만료 10분 | 등록 client·redirect·scope |
| t1 | 브라우저가 승인 화면으로 이동 | 사용자 승인과 redirect 등록 |
| t2 | callback에 `C91` 도착 | T1 응답인지, code 미사용인지 |
| t3 | token endpoint에 `C91` 제출 | code·client·redirect 문맥과 교환 정책 |
| t4 | access token으로 orders API 호출 | RS의 audience·scope·자원 인가 |

이 추적에서 callback은 로그인 또는 API 접근의 최종 성공이 아닙니다. t2에서 code를 받은 뒤 t3 교환이 실패하면 T1은 완료되지 않고, t3이 성공해도 t4에서 `orders.read`가 없거나 다른 audience라면 API는 거절해야 합니다. [OAuth·OIDC 로그인 거래](/tech-interview/notes/login-transaction/)는 state·PKCE·nonce를 이 상태에 묶는 방법을 별도로 다룹니다.

## 실패 경계와 진단

Code가 만료됐거나 이미 사용됐다면 token endpoint에서 교환을 거절해야 합니다. 다른 client가 시작한 code, 등록되지 않은 redirect URI, 잘못된 요청 문맥도 성공으로 바꾸지 않습니다. Callback에 code가 왔다는 사실만으로 해당 client의 소유라고 단정하지 않는 것이 핵심입니다.

RS에 다른 issuer의 access token이 들어오면 서명이 유효해도 기대 issuer에서 벗어난 것으로 거절합니다. Audience가 다른 API를 가리키거나 scope가 부족한 경우도 각각 구분해 관측하되, 응답에 token 원문이나 존재하지 않는 자원의 상세를 노출하지 않습니다.

서버가 code를 교환한 뒤 응답 전에 중단되면 provider에서는 code가 이미 소비됐을 수 있습니다. 로컬 T1을 pending으로 되돌린다고 code가 되살아나지 않습니다. 결과를 확정할 수 없는 상태에는 새 거래를 시작하도록 안내하거나, 별도 재시도 계약을 좁은 범위로 둡니다.

## 구현과 운영 기준

구현은 먼저 provider별 등록 설정을 코드 밖의 신뢰된 구성으로 고정하고, endpoint·redirect·허용 scope·issuer를 한 거래의 설정으로 선택합니다. Callback에서 받은 issuer나 redirect URL을 근거로 임의 endpoint를 조립하지 않습니다. Callback 이후의 상세 state·PKCE·nonce 순서는 [OAuth·OIDC 로그인 거래](/tech-interview/notes/login-transaction/)에서 이어집니다.

RS에는 endpoint 용도별 허용 issuer·audience·알고리즘·필수 claim·scope 정책을 둡니다. Token 검증이 통과한 뒤에도 자원 소유권과 요청 행동을 검사합니다. 자격 원문은 로그와 추적 시스템에서 제외하고, 진단에는 거래 ID·단계·실패 분류만 남깁니다.

운영 지표는 token 발급 성공률 하나로 끝내지 않습니다. 거래별 callback 거절, code 재사용, token 교환 실패, audience·scope 거절, RS의 자원 인가 거절을 단계별로 셉니다. 그래야 사용자가 승인했는데 주문 API만 실패하는 상황과 AS 장애를 구별할 수 있습니다.

## 실무 확인 시나리오

테스트용 AS와 테스트 client로 정상 code 교환을 만든 뒤 다음 순서를 재현합니다. T1에서 발급된 C91을 두 번 교환하면 한 번만 성공해야 합니다. T1의 code를 다른 client 설정에 넣거나 T1의 redirect를 바꾸면 교환되지 않아야 합니다.

Access token은 orders API에서 올바른 audience와 `orders.read`일 때만 조회를 허용합니다. 같은 issuer에서 발급됐지만 다른 audience인 token, scope가 없는 token, 만료된 token을 각각 넣어 RS의 판단을 확인합니다. ID Token을 access token 자리에 넣었을 때도 용도 불일치로 거절되어야 합니다.

이 문서의 거래 순서와 표는 설계 설명입니다. 2026-09-17에 확인한 공식 문서와 기존 repository note를 대조했지만 실제 authorization server, 브라우저, 모바일 앱을 실행한 결과는 아닙니다.

## 참고 자료와 검증 범위

- [RFC 6749: The OAuth 2.0 Authorization Framework](https://www.rfc-editor.org/rfc/rfc6749) — RFC 6749, October 2012, Proposed Standard. §§1.1, 1.3.1, 1.4–1.5, 2.2, 3, 4.1.1–4.1.4의 행위자·endpoint·code/access/refresh 구분을 사용했습니다.
- [RFC 7636: Proof Key for Code Exchange by OAuth Public Clients](https://www.rfc-editor.org/rfc/rfc7636) — RFC 7636, September 2015, Proposed Standard. PKCE의 상세 계산은 다음 심화 노트로 넘기되 code 교환과 verifier 결합이라는 범위를 사용했습니다.
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) — errata set 2, Final, dated 2023-12-15. OAuth 위의 인증, ID Token과 Authorization Code Flow의 구분을 사용했습니다.
- [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700) — RFC 9700, BCP 240, Internet Best Current Practice. 이번 감사 extract에서는 정확한 publication month/day를 확정하지 못했으며, 2026-09-17에 확인한 후속 보안 baseline으로 적용 범위를 구분해 사용했습니다.
- 기존 노트 [인증된 요청의 자원별 권한 검사](/tech-interview/notes/authentication/), [OAuth·OIDC 로그인 거래](/tech-interview/notes/login-transaction/) — repository 파일을 2026-09-17에 대조한 심화 노트입니다.

검증 범위는 공식 IETF·OpenID 원문 페이지와 기존 note의 파일 대조입니다. 이 장의 거래·실패 시나리오는 실행 결과가 아니라 구현 전에 확인할 설계 기준입니다.
