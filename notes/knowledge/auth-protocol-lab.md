---
id: auth-protocol-lab
title: OAuth·OIDC 방어 실습
topic: 보안
summary: 로컬 loopback mock issuer와 client로 Authorization Code·S256 PKCE·state·nonce·필수 claim 검증·일회성 code·client-bound refresh rotation·응답 유실·JWKS 교체를 실패 주입까지 실행합니다.
questionIds: []
prerequisites: [oauth2-foundations, oidc-foundations, oauth-deployment, login-transaction, refresh-rotation, key-rotation]
related: [session-authority, browser-request-security]
reviewedAt: '2026-09-18'
---

# OAuth·OIDC 방어 실습

## 실습 목표

OAuth와 OIDC를 “토큰을 받는 로그인 함수”로 축약하지 않고, 서로 다른 신뢰 경계와 상태 전이를 실행으로 확인합니다. 이 실습은 실제 공급자나 사용자의 계정을 사용하지 않는 합성 환경입니다. Authorization Server와 Client를 한 Node 프로세스 안에서 시작하되, 네트워크 listener는 `127.0.0.1`의 운영체제 할당 port에만 열립니다.

확인할 핵심은 다음입니다.

- Authorization Code가 `client_id`, redirect URI, S256 PKCE verifier에 묶이고 한 번만 소비되는지 확인합니다.
- `state`가 callback transaction을, `nonce`가 OIDC ID Token을 이번 요청에 각각 묶는지 확인합니다.
- ID Token을 검증할 때 신뢰한 issuer의 JWKS와 허용 알고리즘을 사용하고 `iss`, `aud`, `exp`, `iat`, `nonce`, `sub`를 필수 claim으로 검사하는지 확인합니다.
- Refresh token이 client에 묶여 회전하고 predecessor 재사용을 거절하는지, 성공 commit 뒤 응답이 유실됐을 때 서버 상태를 되돌리지 않는지 확인합니다.
- 새 `kid`를 만났을 때 제한된 JWKS 갱신 뒤 검증하고, 검증 실패를 키 조회 장애의 이유로 생략하지 않는지 확인합니다.
- 저장소와 입력이 제한되어 hostile body, pending transaction, code, refresh family가 무한히 쌓이지 않는지 확인합니다.

```diagram
{"title":"OAuth·OIDC 검증 경계","caption":"callback 상관관계, code 교환, ID Token 검증은 서로 다른 단계입니다.","rows":[[{"id":"start","label":"로그인 시작","detail":["state·nonce·verifier 생성"]}],[{"id":"callback","label":"callback 검증","detail":["state·만료·일회성"]}],[{"id":"token","label":"code 교환","detail":["client·redirect·PKCE 결합"]}],[{"id":"identity","label":"ID Token 검증","detail":["서명·issuer·audience","시간·nonce·subject"]}]],"edges":[{"from":"start","to":"callback","label":"authorization redirect"},{"from":"callback","to":"token","label":"code + verifier"},{"from":"token","to":"identity","label":"신원 assertion"}]}
```

## 기본 모델

OAuth 2.0에서 resource owner는 권한을 승인하고, client는 그 권한을 사용하려 하며, authorization server(AS)는 승인과 token 발급을 담당하고, resource server(RS)는 API 접근을 판단합니다. 이 실습은 RS를 구현하지 않으므로 access token의 문자열을 API 권한으로 시험하지 않습니다. Access token, refresh token, ID Token은 목적과 수신 endpoint가 다릅니다.

OIDC는 OAuth 위에 인증 결과를 추가합니다. ID Token은 client가 자신의 요청 결과인지 확인하는 서명된 assertion이고 access token은 RS의 API 자격입니다. 따라서 access token을 로그인 계정의 증거로 쓰지 않고, ID Token 검증이 통과한 뒤에만 `(issuer, subject)`라는 외부 신원 키를 만들 수 있습니다. 이 실습은 계정 연결을 구현하지 않으므로 그 키를 저장하지 않습니다.

세 검증값은 같은 값이 아닙니다.

| 값 | 결합하는 대상 | 실패하면 중단할 단계 |
| --- | --- | --- |
| `state` | 브라우저 callback과 시작 transaction | callback 상관관계 |
| PKCE `verifier` | authorization code와 token 교환 client | token endpoint 교환 |
| `nonce` | OIDC authorization request와 ID Token | ID Token 신원 검증 |

`S256` challenge는 `BASE64URL(SHA-256(ASCII(verifier)))`이며 매 시도마다 새 verifier를 만듭니다. Client는 verifier를 authorization request에 보내지 않고 token request에만 제출합니다. AS는 code 생성 당시의 challenge와 비교한 뒤에만 code를 소비합니다.

## 정상 거래 추적

구체적인 T1 거래를 따라가면 browser redirect와 back-channel token 교환이 분리됩니다.

| 시점 | 상태 | 검증과 다음 행동 |
| --- | --- | --- |
| t0 | Client가 verifier `V1`, challenge `C1`, state `S1`, nonce `N1`을 생성 | issuer metadata에서 endpoint를 선택하고 T1에 저장합니다. |
| t1 | 브라우저가 `/authorize`로 이동 | AS가 client 등록 값, loopback redirect URI, `S256`, state, nonce를 확인합니다. |
| t2 | callback에 `code=C1-code`, `state=S1` 도착 | Client가 미사용·미만료 T1을 찾고 state를 확인합니다. callback 도착만으로 로그인 성공으로 만들지 않습니다. |
| t3 | Client가 `/token`에 code와 `V1` 제출 | AS가 client, redirect URI, challenge를 확인하고 code를 일회 소비합니다. |
| t4 | ID Token `iss=P`, `aud=local-client`, `exp`, `iat`, `nonce=N1`, `sub` 수신 | Client가 서명·알고리즘·issuer·audience·필수 claim·시간·nonce·subject를 확인합니다. |
| t5 | 검증 통과 | 실습 결과에만 claims를 반환합니다. 실제 제품에서는 이후 별도 계정 연결·세션 발급 정책이 필요합니다. |

state가 맞아도 verifier가 틀리면 code 교환이 실패하고, code 교환이 성공해도 nonce나 audience가 틀리면 로그인 세션을 만들지 않습니다. state mismatch는 해당 pending transaction을 정리하며, callback은 정해진 `GET /callback` 경로만 받습니다.

## 코드 구성

`src/lab.mjs`에는 `MockIssuer`와 `LoopbackClient`가 있습니다. MockIssuer는 discovery, authorization, token, JWKS endpoint를 제공하고 LoopbackClient는 discovery를 검증한 뒤 callback listener를 열어 code를 교환하고 ID Token을 검증합니다.

`MockIssuer`는 `jose`의 `generateKeyPair('RS256')`와 `SignJWT`를 사용합니다. 공개 JWK에는 `kid`, `alg`, `use`, `key_ops`가 있고 ID Token에는 `iss`, `aud`, `iat`, `exp`, `nonce`, `sub`가 들어갑니다. 검증은 `jwtVerify`에 `issuer`, `audience`, `algorithms: ['RS256']`, `requiredClaims: ['iss', 'aud', 'exp', 'iat', 'nonce', 'sub']`를 전달합니다. 직접 JWT 서명·검증 암호나 임의 parser를 만들지 않습니다.

Discovery metadata의 issuer와 endpoint는 trusted issuer와 정확히 같은 origin 및 고정 path인지 확인합니다. JWKS 응답은 크기, JWK 타입, `kid`, `alg`, `use`를 확인하며 unknown `kid`에서 한 번만 새로 읽습니다. HTTP loopback mock은 교육용 전송이며 실제 OIDC 배포의 HTTPS/TLS 인증서 검증을 대표하지 않습니다.

Code 저장소와 Client pending 저장소는 각각 만료 항목을 정리하고 상한을 둡니다. Code record는 `expiresAt`, `clientId`, `redirectUri`, `codeChallenge`, `nonce`, `used`를 묶습니다. token endpoint는 만료·사용·문맥·verifier를 확인한 뒤 `used=true`로 바꿉니다.

Refresh family는 원문이 아닌 `sha256(refreshToken)`을 현재 hash로 보관하고 `clientId`도 함께 묶습니다. 갱신 성공 시 이전 hash를 consumed 집합에 넣고 version을 증가시키며 새 원문의 hash로 교체합니다. 같은 predecessor가 다시 들어오면 해당 family 전체를 회수하고, 다른 client의 사용도 거절합니다. consumed 이력 상한에 도달하면 옛 hash를 버리는 대신 재인증을 요구합니다. 응답을 버리는 테스트는 server commit을 되돌리지 않습니다.

## 실행 단계

저장소 루트에서 다음 명령을 실행합니다.

```sh
cd examples/knowledge/auth-protocol-lab
npm install --ignore-scripts
npm test
```

`package.json`은 Node `>=22.12.0`과 `jose@6.1.0`을 고정합니다. 설치 시 lifecycle script를 실행하지 않고, 테스트 자체도 외부 provider나 cloud endpoint를 호출하지 않습니다. 테스트는 issuer와 callback server를 `finally`에서 닫아 포트와 핸들 누수를 줄입니다.

## 실패 주입

`test/lab.test.mjs`는 정상 결과와 경계별 실패 결과를 함께 확인합니다.

1. S256 계산과 RFC 7636 verifier 길이·문법 경계를 확인합니다.
2. state 변경이 `state_mismatch`로 callback transaction을 거절하는지 확인합니다.
3. verifier 변경이 AS의 `invalid_grant`를 만드는지 확인합니다.
4. nonce 변경이 `nonce_mismatch`인지 확인합니다.
5. audience 변경이 `jwtVerify`를 거절하는지 확인합니다.
6. 만료 ID Token이 `JWTExpired`로 거절되는지 확인합니다.
7. `exp` 누락이 `requiredClaims`로 거절되는지 확인합니다.
8. 같은 authorization code 두 번과 다른 redirect URI를 거절하는지 확인합니다.
9. refresh token이 client에 묶이고 predecessor replay가 `refresh_reuse`인지 확인합니다.
10. 응답 유실 뒤 predecessor가 consumed 상태로 남는지 확인합니다.
11. 새 `kid`가 JWKS를 갱신하게 하며, old key가 client cache에 있으면 검증이 계속되는 사실과 실제 unknown `kid` 거절을 분리해 확인합니다.
12. callback의 잘못된 method/path, callback timeout, oversized request body, malformed JWT를 확인합니다.

원문 자격 대신 `state_mismatch`, `token_exchange_400`, `nonce_mismatch`, `unknown_kid`, `refresh_reuse`처럼 단계와 분류를 기록합니다. token·verifier·ID Token 원문을 출력하지 않습니다.

## 규격 기준과 버전 상태

- RFC 6749는 OAuth 행위자, authorization/token endpoint와 code·access·refresh token 목적을 정의합니다.
- RFC 7636은 per-request verifier, S256 계산, 43–128자 문법과 불일치 시 `invalid_grant`를 다룹니다.
- OpenID Connect Core 1.0은 OAuth 위의 인증, ID Token, issuer·subject·audience·시간·nonce 검증을 정의합니다.
- OpenID Connect Discovery 1.0은 metadata issuer와 `jwks_uri`를 정의하며 provider별 cache lifetime·unknown-kid retry·rollover timing까지 정하지 않습니다.
- RFC 9700(BCP 240)은 공식 RFC Editor 페이지에서 Best Current Practice로 표시된 현재 OAuth 보안 baseline입니다. 정확한 publication month/day는 이번 확인에서 확정하지 않았습니다.
- OAuth 2.1은 2026-09-17 확인 기준 `draft-ietf-oauth-v2-1-16` Active Internet-Draft이며 RFC 번호가 없습니다.

## 실습의 한계

이 lab은 실제 provider·브라우저·Resource Server·분산 persistence·TLS를 실행하지 않습니다. revocation·introspection, DPoP/mTLS, PAR/JAR, native external user-agent, BFF, Resource Server의 audience/scope 인가, rate limit, 운영 secret storage는 별도 설계가 필요합니다. `jose`가 ID Token 검증을 수행하더라도 provider의 실제 discovery 응답, 네트워크 장애, clock skew 계약, 키 유출 회수를 검증한 것이 아닙니다. 메모리 저장소의 상한과 cleanup은 이 단일 프로세스 교육 fixture의 방어 장치이지 분산 원자성 구현이 아닙니다.

## 참고 자료

- [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749) — §§1.1, 1.3.1, 1.4–1.5, 2.2, 3, 4.1.1–4.1.4.
- [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636) — §§4.1–4.6, 7.1, Appendix A.
- [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700) — §§2.1, 2.1.1–2.1.2, 2.2.2, 4.5.3.1–4.5.3.2.
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) — errata set 2, Final, 2023-12-15.
- [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html) — errata set 2, Final, 2023-12-15.
- [OAuth 2.1 draft-16](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-16) — Active Internet-Draft이며 RFC가 아닙니다.

## 코드 위치

[OAuth·OIDC 방어 실습 코드](https://github.com/c86j224s/tech-interview/tree/main/examples/knowledge/auth-protocol-lab/)에서 실행합니다. 2026-09-18 Node 26에서 8개 테스트 그룹을 통과했습니다.
