# OAuth·OIDC 로컬 방어 실습

이 실습은 실제 공급자나 사용자 계정을 연결하지 않고, loopback 주소에서만 동작하는 합성 Authorization Server와 Client를 실행합니다. 목표는 Authorization Code + S256 PKCE, state, nonce, 필수 claim 검증, 일회성 code, client-bound refresh rotation, 응답 유실, JWKS key rollover를 실패 주입까지 로컬에서 관찰하는 것입니다.

## 범위와 비범위

포함 범위는 로컬 mock issuer의 discovery, authorization redirect, token endpoint, 서명된 OIDC ID Token, 제한된 refresh family 상태, loopback callback, 검증 실패 시험입니다. `jose`의 검증된 JWT 구현을 사용하며 직접 JWT 서명·검증 암호를 만들지 않습니다. 저장소와 입력에는 교육용 상한과 만료 cleanup이 적용됩니다.

포함하지 않는 것은 실제 provider 로그인, 실제 credential 수집, 계정 연결, Resource Server 인가, revocation/introspection endpoint, DPoP/mTLS, PAR/JAR, 다중 issuer 운영, TLS 종단, production key storage, rate limiting과 distributed persistence입니다. 이 실습을 운영 기능의 완전한 구현으로 해석하지 않습니다.

## 의존성과 실행

저장소 루트에서 다음을 실행합니다.

```sh
cd examples/knowledge/auth-protocol-lab
npm install --ignore-scripts
npm test
```

실습은 Node.js `>=22.12.0`을 요구하고 `jose` 버전 `6.1.0`을 고정합니다. 서버는 OS가 할당한 동적 port에 `127.0.0.1`로만 bind합니다. 테스트가 끝나면 issuer와 callback server를 `finally`에서 종료합니다. 실제 provider URL, credential 입력 화면, 외부 네트워크 의존성은 없습니다. Mock issuer의 HTTP loopback은 학습용 전송이며, 실제 OIDC Discovery의 HTTPS·TLS 인증서 검증 조건을 충족하는 배포 구성이 아닙니다.

## 방어 모델

`state`는 callback이 시작 transaction에 속하는지 연결하고, PKCE verifier는 token endpoint가 같은 code 교환자임을 확인하게 하며, `nonce`는 ID Token이 이번 OIDC 요청에 대응하는지 연결합니다. `iss`, `aud`, `exp`, `iat`, `nonce`, `sub`는 모두 필수 claim으로 검증합니다. issuer와 endpoint는 trusted issuer의 정확한 origin/path에 묶고, ID Token header와 JWKS는 RS256, `kid`, `use`, JWK type을 확인합니다.

인가 code는 60초 동안 한 번만 교환됩니다. refresh token은 원문이 아니라 SHA-256 검증 hash와 `client_id`를 family에 저장하며 성공할 때 이전 값은 consumed가 되고 새 값으로 회전합니다. 같은 predecessor 재사용은 family 전체를 회수하며 다른 client 사용은 거절됩니다. consumed 이력 상한 뒤에는 재인증을 요구합니다. 성공 commit 뒤 응답이 사라지면 client가 이전 refresh token을 다시 들고 있으므로 서버를 되돌리지 않고 재로그인 또는 별도 재전달 정책이 필요하다는 상태를 드러냅니다.

## 실패 주입과 진단

테스트는 다음 오류를 의도적으로 만듭니다.

- 다른 state: callback 상관관계 실패인 `state_mismatch`
- 다른 verifier: token endpoint의 `invalid_grant`
- 다른 nonce: ID Token 요청 결합 실패인 `nonce_mismatch`
- 다른 audience: `jose`의 audience 검증 실패
- 만료 ID Token: `jose`의 `JWTExpired`
- 필수 claim 누락: `requiredClaims` 검증 실패
- 같은 authorization code 두 번: 두 번째 `invalid_grant`
- redirect 문맥 변경: `invalid_grant`
- 다른 refresh client: `invalid_grant`
- 이전 refresh token 재사용: `refresh_reuse`
- refresh 응답 유실: client는 predecessor를 유지하지만 서버 family는 consumed 상태
- 새 `kid`: 제한된 JWKS 재조회 뒤 새 서명키 검증
- retired old key: client cache에 남은 공개키는 계속 검증 가능하다는 rollover 의미
- unknown `kid`: 한 번 갱신해도 키가 없으면 `unknown_kid`
- callback의 잘못된 method/path와 timeout
- oversized form body와 malformed JWT

로그에 token, verifier, ID Token 원문을 남기는 코드는 없습니다. 이 패키지는 단일 프로세스·단일 client의 교육 모델이며, 테스트 성공이 실제 운영 provider의 상호운용성이나 보안 인증을 의미하지 않습니다.

## 실행 판정

`npm test`가 모두 통과하면 위의 합성 상태 전이가 현재 Node 환경에서 실행됐다는 뜻입니다. 2026-09-18 Node 26에서 의존성을 설치하고 8개 테스트 그룹을 통과했습니다. 시뮬레이션을 플랫폼 통합 실행이나 실제 인증 provider 검증으로 표현하지 않습니다. RFC 9700은 현재 OAuth 보안 BCP baseline으로 참고하되 OAuth 2.1은 Active Internet-Draft이며 RFC로 표기하지 않습니다.
