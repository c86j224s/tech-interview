---
id: oauth-deployment
title: OAuth·OIDC 실무 배치와 운영
topic: 보안
summary: 브라우저·모바일·기기·서비스 배치에서 토큰 경계를 정하고 갱신·회수·키 교체를 실제 장애 순서로 운영하는 방법을 설명합니다.
questionIds: []
prerequisites: [oauth2-foundations, oidc-foundations]
related: [refresh-rotation, session-authority, key-rotation, device-authorization, authentication]
reviewedAt: '2026-09-17'
---

# OAuth·OIDC 실무 배치와 운영

## 배치 결정을 시작하는 경계

OAuth·OIDC를 제품에 넣을 때 먼저 정할 것은 라이브러리 이름이 아니라 token이 어디에 머물고, 어느 component가 어떤 API를 대신 호출하는지입니다. 같은 주문 화면이라도 브라우저 JavaScript가 API를 직접 호출할지, backend-for-frontend(BFF)가 session cookie를 받고 대신 호출할지에 따라 노출·회수·CSRF의 경계가 달라집니다.

배포된 JavaScript의 client secret은 confidential credential이 아닙니다. 모바일 앱과 일반 native app도 설치된 코드와 저장소를 사용자가 통제할 수 있으므로 일반적으로 public client로 취급합니다. 따라서 “secret을 앱에 넣었으니 code interception이 해결된다”는 설계를 출발점으로 삼지 않습니다.

운영 설계의 기본 흐름은 사용자의 승인과 code 교환, ID Token 신원 검증, API access token 사용, refresh와 회수를 서로 다른 상태로 기록하는 것입니다. 한 단계의 성공을 다음 단계의 성공으로 복사하지 않아야 장애 원인과 회수 범위를 찾을 수 있습니다.

## 브라우저 전용 배치

Browser-only public client는 외부 authorization server에서 Authorization Code + PKCE 거래를 시작하고, callback에서 code를 교환한 뒤 access token으로 API를 호출하는 구조입니다. PKCE는 code만 가로챈 공격자가 verifier 없이 교환하지 못하게 하지만, 브라우저 실행 코드의 XSS·token exfiltration 위협을 없애지는 않습니다.

등록된 redirect URI와 제출 URI는 정확히 일치시키고, 로그인 시작 transaction에는 state를 묶습니다. State를 확인해도 로그인 뒤 내부 return path가 임의 외부 URL로 열리면 open redirect 문제가 남습니다. Return path는 별도의 허용 목록으로 제한합니다.

Access token을 브라우저 메모리에 둘지 다른 저장소에 둘지는 API 호출 구조와 위협 모델의 선택입니다. Local storage가 자동으로 안전한 금고가 되는 것은 아니며, HttpOnly cookie가 모든 XSS 피해를 막는 것도 아닙니다. 브라우저가 cookie를 자동 첨부하는 구조라면 CSRF 방어와 origin 정책을 함께 설계합니다.

| 항목 | Browser-only의 실제 경계 | 남는 문제 |
| --- | --- | --- |
| client 유형 | public client | 배포 코드에 secret 없음 |
| code 교환 | 브라우저가 직접 수행 가능 | PKCE·redirect·state 필요 |
| API 호출 | browser가 access token 제출 | token 노출 시 API 사용 가능 |
| session 상태 | 브라우저 저장소·메모리 | XSS·회수 지연·새로고침 복구 |

## BFF와 절충 배치

Full BFF는 backend가 AS에 confidential client로 code 교환을 수행하고 access·refresh token을 브라우저 JavaScript 밖에 두는 설계입니다. 브라우저에는 자체 session cookie를 주고, `/api/orders` 같은 내부 endpoint가 upstream API를 proxy합니다. 이때 browser는 OAuth token을 직접 다루지 않고 BFF가 upstream audience·scope·목적지를 고정합니다.

BFF session cookie는 Secure와 HttpOnly를 사용해 전송·스크립트 접근 범위를 줄이는 방향으로 설계합니다. 그러나 cookie가 자동 전송되는 요청에는 CSRF 방어가 필요하고, XSS가 같은 origin에서 session으로 요청을 실행하는 피해는 남습니다. 기존 [쿠키 요청 위조와 스크립트 실행의 다른 경계](/tech-interview/notes/browser-request-security/)의 SameSite·origin·CSRF 원칙을 OAuth session boundary에 적용합니다.

Token-mediating backend는 backend가 refresh token을 보관하지만 browser에 access token을 내주는 절충안입니다. Full BFF보다 proxy 기능을 덜 만들 수 있지만 browser token theft exposure가 남습니다. 둘 중 어느 설계를 택할지는 API 수, 브라우저가 직접 호출해야 하는 외부 endpoint, XSS·CSRF 위협, 운영팀이 감당할 session 상태에 근거해 결정합니다. 이 비교는 규격의 확정된 제품 요구가 아니라 배치 설계 모델입니다.

```diagram
{"title":"같은 주문 화면의 두 token 경계","caption":"두 배치는 API 요청과 자격 보관 위치가 다릅니다. BFF가 token 노출을 줄여도 session으로 행동하는 injected code와 CSRF 방어는 별도 문제입니다.","rows":[[{"id":"browser","label":"브라우저 화면","detail":["UI·내부 요청"]}],[{"id":"direct","label":"Browser-only","detail":["access token 직접 전송"]},{"id":"bff","label":"Full BFF","detail":["session cookie만 수신"]}],[{"id":"api","label":"Orders API","detail":["audience·scope·자원 인가"]}],[{"id":"as","label":"Authorization Server","detail":["code·token 발급"]}]],"edges":[{"from":"browser","to":"direct","label":"직접 code·API"},{"from":"browser","to":"bff","label":"session 요청"},{"from":"direct","to":"api","label":"access token"},{"from":"bff","to":"api","label":"proxy token"},{"from":"direct","to":"as","label":"PKCE 교환"},{"from":"bff","to":"as","label":"backend 교환"}]}
```

## 모바일과 native redirect

Native app은 embedded webview에서 provider login을 수행하기보다 external user-agent를 사용합니다. 사용자가 이미 로그인한 브라우저의 session과 provider의 보안 UI를 활용하고, 앱 내부에 비밀번호를 직접 입력받지 않기 위한 경계입니다. Native app은 일반적으로 public client이므로 PKCE를 기본으로 합니다.

Redirect 선택지는 app-claimed HTTPS, loopback redirect, custom scheme 등으로 나뉩니다. App-claimed HTTPS는 해당 앱이 domain을 주장하는 방식이고, loopback은 기기 안의 local listener로 돌아오는 예외입니다. Loopback에서는 동적 port를 쓰는 계약이 가능하지만 이 예외를 일반 웹 callback의 느슨한 port 매칭으로 확대하지 않습니다.

Custom scheme은 다른 앱이 callback을 가로챌 가능성이 있으므로 등록·검증을 엄격히 하고 PKCE를 함께 사용합니다. 공격자가 `code=C1`을 가로채도 `verifier=V1`을 갖지 못하면 token endpoint 교환이 실패해야 합니다. 앱에 들어 있는 secret 문자열을 추가해 이 위협이 confidential client로 바뀐다고 설명하지 않습니다.

| 환경 | 사용자 승인 경로 | callback 경계 | 중심 자격 보호 |
| --- | --- | --- | --- |
| 모바일 | external browser | claimed HTTPS 또는 등록 scheme | per-request PKCE |
| 데스크톱 native | external browser 또는 loopback | 동적 loopback port 예외 | verifier·OS 저장소 |
| embedded webview | 앱 안의 내장 화면 | 권장 배치 아님 | provider 정책·자격 노출 위험 |

## Device Authorization 선택

TV나 CLI처럼 안전한 redirect를 받기 어려운 기기는 Device Authorization Grant를 고려합니다. 기기는 `device_code`와 `user_code`, 승인 URI, 만료 시각, polling `interval`을 받습니다. `device_code`는 token endpoint를 polling하는 자격이고, `user_code`는 사람이 승인 화면에서 요청을 찾는 표시값이므로 둘을 같은 노출 경계로 취급하지 않습니다.

사용자 승인 화면에는 app, device, 요청 목적, 권한 범위를 보여 줍니다. 공격자가 자기 TV의 user_code를 피해자에게 입력시키는 경우 이런 정보가 없으면 피해자는 자기 기기를 승인한다고 착각할 수 있습니다. QR이나 짧은 코드는 장기 자격이나 강한 기기 소유 증명이 아닙니다.

Polling interval이 없으면 RFC 8628에 따라 기본 5초를 사용합니다. `authorization_pending`은 기다리고, `slow_down`은 이후 간격을 5초 늘리며, `expired_token`과 거절 상태는 polling을 종료합니다. 네트워크 backoff는 전체 만료 기한을 늘리지 않습니다.

예를 들어 TV가 t0에 `D7`, `U4`, interval 5초를 받았다고 합시다. t0+1초 요청은 정한 간격보다 이르고, t0+5초에 아직 승인 전이면 `authorization_pending`입니다. t0+10초에 서버가 `slow_down`을 주면 이후 요청 간격을 5초 늘려 최소 t0+20초 이후로 미룹니다. 승인과 발급이 끝나도 응답이 유실될 수 있으므로, polling마다 새 token을 발급하지 않고 발급 상태와 좁은 재전달 또는 새 흐름을 구분합니다.

## 서비스 간 위임

Backend가 사용자의 권한으로 downstream API를 호출하는 경우, 기술적으로 강한 service account의 권한이 사용자 요청을 넓히지 않게 해야 합니다. Token Exchange에서 `subject_token`은 대표되는 주체를, 선택적인 `actor_token`은 실제 행동 주체를 나타냅니다. `audience` 또는 `resource`는 어느 downstream 목적지인지 고르고, scope는 필요한 최소 권한으로 줄입니다.

Impersonation은 downstream이 subject를 호출 주체처럼 보는 제한된 문맥이고, delegation은 subject와 actor를 구분할 수 있는 문맥입니다. 어떤 형태를 선택했는지 token claim·audit·downstream 정책에 드러나야 합니다. Token Exchange가 원 token을 자동 회수하거나 권한 수명을 자동 결합한다고 가정하지 말고, 만료·회수·재승인 정책을 별도로 계약합니다.

예를 들어 주문 backend가 사용자 U의 `orders.read`만 필요하고 service S가 실제 호출자라고 합시다. 교환 요청의 subject는 U, actor는 S, audience는 `orders-api`, scope는 `orders.read`로 제한합니다. `billing-api` audience나 `orders.write`를 함께 넣으면 사용자 요청을 넘어선 권한이며 API가 거절해야 합니다.

| 입력 | 예시 | 설계 질문 |
| --- | --- | --- |
| `subject_token` | 사용자 U | 누구의 권한을 대표하는가 |
| `actor_token` | 서비스 S | 누가 실제 호출하는가 |
| `audience` | orders-api | 어느 downstream만 받는가 |
| `scope` | orders.read | 어떤 최소 행동인가 |

## Access token 수명과 갱신

Access token은 짧은 사용 창을, refresh token은 AS에서 새 access token을 얻는 장기 갱신을 담당합니다. Refresh token은 RS 요청에 보내지 않으며, public client에는 sender constraint 또는 rotation을 적용하는 현재 BCP 지침을 client 유형과 조건에 맞게 해석합니다. 모든 client에 같은 강도를 기계적으로 복사하지 않습니다.

회전 상태를 `family=F7`, current version 7, 현재 원문 R7의 검증 hash로 두면, 두 탭이 동시에 R7을 제출해도 권위 저장소에서 version 7 조건을 만족하는 한 요청만 version 8과 R8을 커밋해야 합니다. 다른 요청은 old-token 상태가 되며 정상 동시 요청과 탈취 재사용을 bearer만으로 완벽히 구분할 수 없으므로 제한적 복구 또는 재로그인 정책이 필요합니다. 상세 상태 전이는 [갱신 토큰 회전의 원자성과 응답 유실](/tech-interview/notes/refresh-rotation/)에 있습니다.

커밋 뒤 응답이 유실되면 서버에 R8 hash만 있어 R8 원문을 되살릴 수 없습니다. 동일 transaction ID에 묶인 암호화 결과를 짧은 TTL·횟수로 재전달하거나, 새 authorization 흐름을 시작하게 합니다. 무제한으로 R7을 다시 허용하면 회전 경계와 재사용 탐지가 사라집니다.

## 회수와 현재 상태

Revocation endpoint는 HTTPS POST form을 받고 refresh token 회수를 지원해야 하며, access token 회수는 권고됩니다. `token_type_hint`는 조회 힌트일 뿐이고, 힌트 검색에 실패했다고 다른 지원 token type을 건너뛰지 않습니다. HTTP 200은 이미 invalid한 token에도 사용될 수 있으므로 token이 정상적으로 사용 가능하다는 증명이 아닙니다.

Introspection은 인증된 Resource Server가 AS에 token의 `active` 상태와 적용 가능한 만료·회수·audience·scope를 질의하는 방식입니다. Opaque token에 특히 유용하지만 token 형식 자체로 적용 범위를 제한하지 않습니다. Positive 결과 cache는 token의 `exp`를 넘길 수 없고, 회수 직후 stale 허용을 줄이려면 local cache·replica lag·민감 작업 정책을 함께 계산해야 합니다.

예를 들어 관리자 회수가 t0에 F7을 무효화했지만 API가 positive introspection을 60초 cache하고 replica lag가 최대 20초라면, 단순 합산의 설계 상한은 약 80초가 될 수 있습니다. 이는 측정된 운영 결과가 아니라 cache·replica 가정에서 나온 계산 모델입니다. 즉시 회수가 필요하면 민감 write 전에 권위 상태와 실행 조건을 다시 확인합니다.

## JWKS와 키 교체

OIDC Discovery의 `jwks_uri`는 서명 공개키 집합의 위치를 알려 주지만 provider별 cache lifetime, unknown `kid` retry, rollover timing까지 정하지 않습니다. 이 값들은 local SLO와 provider 계약으로 둡니다. 검증기는 token의 임의 URL을 따라가지 않고 trusted issuer metadata와 허용 알고리즘을 사용합니다.

정상 교체는 K2 공개키 선배포, 모든 validator가 K2를 검증할 수 있는지 확인, K2 발급 전환, 마지막 K1 발급의 허용 수명과 시계 오차 관찰, K1 제거 순서입니다. K1 제거 시점을 계획상의 전환 시각으로 잡으면 오래된 worker가 만든 K1 token을 너무 일찍 거절할 수 있습니다. 이 운영 모델의 세부 상태는 [서명키·API 키의 중첩 교체와 긴급 회수](/tech-interview/notes/key-rotation/)를 참조합니다.

Unknown `kid`가 오면 issuer 단위 singleflight로 갱신 요청을 합치고, deadline·backoff·jitter·bounded negative cache를 둡니다. 갱신 실패를 서명 검증 생략으로 바꾸지 않으며, 임의 `kid` 1만 개가 들어와도 외부 요청이 1만 개 생기지 않게 합니다. 유출된 K1은 정상 overlap으로 보호하지 않고 신뢰 제거·영향 session/refresh 회수·재인증으로 처리합니다.

## 운영 진단과 구현 기준

배치별로 다음 상태를 명시적으로 기록합니다. browser transaction, provider issuer, code 교환, ID Token 검증, access-token 사용, refresh family, revocation, introspection freshness, JWKS snapshot입니다. 하나의 `authenticated=true` 플래그에 이 정보를 압축하면 어느 자격이 어느 API에 허용됐는지 추적할 수 없습니다.

장애 진단은 실패 단계로 나눕니다. `redirect_mismatch`, `state_mismatch`, `code_reuse`, `verifier_mismatch`, `issuer_mismatch`, `audience_mismatch`, `nonce_mismatch`, `refresh_reuse`, `introspection_stale`, `unknown_kid` 같은 분류를 provider·client·API별로 집계합니다. Token·verifier·ID Token 원문은 로그와 일반 지표에 넣지 않습니다.

BFF는 token 추출을 줄여도 XSS가 session으로 행동하는 문제와 CSRF를 자동 해결하지 않습니다. Device Authorization은 user_code 화면이 부실하면 승인 피싱이 남습니다. JWKS singleflight는 provider가 잘못된 키를 계속 내놓는 상황을 해결하지 않습니다. 각 방어가 줄이는 위협과 남기는 위협을 운영 문서에 함께 기록합니다.

## 실무 확인 시나리오

합성 AS, 테스트 browser, mobile redirect harness, BFF proxy, 두 개 이상의 validator를 사용해 정상·실패 순서를 재현합니다. Browser-only는 access token이 API로 가고 BFF는 session cookie만 browser에 가는지 확인합니다. Cross-site 상태 변경 요청과 XSS로 session 요청이 가능한 경우를 분리해 판단합니다.

모바일에서는 custom scheme interception, verifier 불일치, redirect path 변경, embedded webview를 시험합니다. Device flow에서는 5초 interval, `slow_down`, user_code 대입 제한, 승인 직후 응답 유실, 만료를 시간을 제어해 확인합니다. 서비스 위임에서는 잘못된 actor·audience·resource·scope가 downstream에서 거절되는지 봅니다.

운영 상태를 바꿀 때는 K2 선배포 후 실제 K2 검증 성공을 확인하고, K1 마지막 발급·사용량을 보고 제거합니다. F7 회수 뒤 access token과 positive introspection cache가 언제까지 허용되는지 계산하고, 그 값이 실제 환경 측정인지 설계 상한인지 구분해 기록합니다.

이 장에서 제시한 합성 시나리오와 숫자 추적은 실행 결과가 아닙니다. 2026-09-17에 확인한 공식 문서와 기존 repository note를 대조한 교육용 설계이며, 실제 인증 서버·브라우저·모바일 앱·BFF·다중 지역 cache를 실행하지 않았습니다.

## 참고 자료와 검증 범위

- [RFC 8252: OAuth 2.0 for Native Apps](https://www.rfc-editor.org/rfc/rfc8252) — RFC 8252. 이번 extract에서는 정확한 publication metadata를 확정하지 못했으며, §§5–8.5의 external user-agent, public native client, claimed HTTPS·loopback·custom scheme 경계를 사용했습니다.
- [RFC 8628: OAuth 2.0 Device Authorization Grant](https://www.rfc-editor.org/rfc/rfc8628) — RFC 8628, August 2019, Proposed Standard. §§3.2–3.5, 5.1–5.7의 device/user code와 polling 오류·간격을 사용했습니다.
- [RFC 8693: OAuth 2.0 Token Exchange](https://www.rfc-editor.org/rfc/rfc8693) — RFC 8693, 2020, Proposed Standard. 이번 extract에서는 더 정확한 publication date를 확정하지 못했으며, §§1–2.3, 4.1의 subject·actor·audience·resource·scope 구분을 사용했습니다.
- [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700) — RFC 9700, BCP 240, Internet Best Current Practice. 정확한 publication month/day는 이번 extract에서 확정하지 못했으며, 2026-09-17 확인 기준의 PKCE·redirect·refresh·mix-up 관련 지침을 적용 범위와 함께 사용했습니다.
- [RFC 7009: OAuth 2.0 Token Revocation](https://www.rfc-editor.org/rfc/rfc7009) — RFC 7009, August 2013, Proposed Standard. §§2–2.2의 revocation request·hint·200 semantics를 사용했습니다.
- [RFC 7662: OAuth 2.0 Token Introspection](https://www.rfc-editor.org/rfc/rfc7662) — RFC 7662, October 2015, Proposed Standard. §§2–2.3, 4의 authenticated introspection·active·cache 상한을 사용했습니다.
- [RFC 9449: OAuth 2.0 Demonstrating Proof of Possession at the Application Layer](https://www.rfc-editor.org/rfc/rfc9449) — RFC 9449, Proposed Standard. 이번 extract에서는 정확한 publication date를 확정하지 못했으며, §§1–7의 HTTPS·key-bound proof와 public refresh 조건을 선택적 sender constraint로 사용했습니다.
- 기존 노트 [쿠키 요청 위조와 스크립트 실행의 다른 경계](/tech-interview/notes/browser-request-security/), [갱신 토큰 회전의 원자성과 응답 유실](/tech-interview/notes/refresh-rotation/), [JWT·서버 세션의 현재 권한과 회수 지연](/tech-interview/notes/session-authority/), [서명키·API 키의 중첩 교체와 긴급 회수](/tech-interview/notes/key-rotation/), [입력이 불편한 기기의 승인과 토큰 발급](/tech-interview/notes/device-authorization/) — repository 파일을 2026-09-17에 대조한 심화 노트입니다.

브라우저-only·BFF·token-mediating backend 비교는 확정된 RFC/BCP 제품 요구가 아니라 위 규격과 기존 note를 바탕으로 한 설계 모델입니다. 검증 범위는 공식 IETF·OpenID 페이지와 기존 repository note의 파일 대조이며, 실제 provider·브라우저·모바일·BFF·다중 지역 실행이나 성능 benchmark는 수행하지 않았습니다.
