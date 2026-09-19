---
id: jar-signed-parameters
title: JAR 서명 요청 객체가 authorization parameter 변조를 어떻게 막나요?
difficulty: 중하
category: 보안
tags:
  - OAuth
  - JAR
  - JWT
related:
  - security-jwt-algorithm-confusion
---
# JAR 서명 요청 객체가 authorization parameter 변조를 어떻게 막나요?

## 구두 답변

JAR는 client가 authorization parameter를 Request Object JWT의 claim으로 만들고 등록된 키로 서명하게 합니다. AS는 JWT 형식만 보는 것이 아니라 client 설정에서 허용 알고리즘과 키를 선택해 JWS를 검증하고, `iss`, `aud`, `client_id`, `redirect_uri`, `response_type`, `iat`·`exp`를 정책과 대조합니다. RFC 9101의 Request Object 사용 모드에서는 authorization parameter를 Request Object에서만 추출해야 하므로, 같은 이름의 외부 query가 있어도 병합하거나 query 값을 우선하면 안 됩니다. query에 `client_id`가 있다면 Request Object의 `client_id`와 같아야 합니다.

예를 들어 C1의 JAR가 `aud=AS1`, `redirect=R1`, `scope=orders.read`, `exp=12:01`인데 브라우저 query가 `scope=payments.write`로 바뀌었다고 하겠습니다. AS는 query scope를 합쳐 권한을 확대하지 않고 signed object의 `orders.read`만 사용합니다. query client_id가 C2로 바뀌면 claim과 불일치하여 거절합니다. 다른 client 키, AS가 아닌 audience, 만료된 exp, 등록되지 않은 redirect, 허용하지 않은 alg도 각각 실패시켜야 합니다. `kid`에 따라 임의 JWKS URL을 fetch하지 말고 등록된 trust configuration에서 키를 선택합니다.

이 성공은 요청 무결성과 client 결합의 성공이지 승인·로그인 완료가 아닙니다. 등록 redirect 비교, 사용자의 consent, callback state, code 교환 PKCE verifier, OIDC nonce는 뒤에서 별도로 확인합니다. JAR를 쓰지 않는 기본 query 요청의 조립 규칙과 JAR 규칙을 한 코드 경로에서 무심코 섞으면 precedence 버그가 생기므로 모드를 먼저 판정하고 테스트해야 합니다. JWE가 confidentiality를 추가하더라도 signature·issuer·audience 검증을 대체하지 않습니다.

## 득점 포인트

- RFC 9101의 Request Object-only parameter 사용과 query client_id equality를 정확히 말한다.
- C1·AS1·R1·scope 충돌에서 실제 거절·사용 값을 추적한다.
- JAR 무결성과 승인·callback·PKCE 검증을 별도 단계로 둔다.

## 감점 포인트

- 외부 query scope를 signed scope보다 우선해 권한을 확대한다.
- 서명되었다는 이유로 issuer·audience·redirect를 검사하지 않는다.
- JAR 성공을 사용자 승인이나 로그인 완료로 기록한다.

## 더 파고들 거리

- request_uri 방식 JAR가 만드는 fetch와 SSRF 경계는 무엇인가요?
- JAR와 PAR 조합에서 parameter 조립 모드를 어떻게 호환성 시험할까요?
