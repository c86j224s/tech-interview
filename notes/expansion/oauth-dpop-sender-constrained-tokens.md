---
id: oauth-dpop-sender-constrained-tokens
title: OAuth DPoP sender-constrained 토큰
topic: 보안
summary: DPoP 키쌍·proof·접근 토큰 결합으로 bearer 토큰 탈취 재사용 범위를 줄이는 조건을 다룹니다.
questionIds: []
prerequisites:
  - oauth2-foundations
  - key-rotation
related:
  - oauth2-foundations
  - session-authority
reviewedAt: '2026-09-19'
---
# OAuth DPoP sender-constrained 토큰

Bearer access token은 문자열을 가진 사람이 요청을 만들 수 있다는 모델입니다. TLS가 전송 중 탈취를 줄여도 로그, 잘못된 프록시, 악성 확장 프로그램처럼 token이 노출된 뒤의 재사용까지 없애지는 못합니다. **DPoP**(Demonstrating Proof of Possession)는 OAuth token을 공개키의 소유 증명과 HTTP 요청에 결합하는 애플리케이션 계층 방식입니다. 핵심은 “서명된 JWT가 있다”가 아니라, 매 요청마다 개인키로 만든 proof와 token 안의 키 바인딩이 같은지 확인하는 데 있습니다.

이 장에서 말하는 방어 범위는 제한적입니다. 공격자가 access token만 복사했을 때 다른 요청에 그대로 붙이는 bearer 재사용을 어렵게 만들지만, 공격자가 개인키를 함께 훔쳤거나 정상 client 실행 문맥을 장악했다면 DPoP 하나로 해결되지 않습니다. 따라서 키 생성·보관, proof 검증, replay cache, 프록시 URL 정규화, 회전 정책을 한 거래로 설계해야 합니다.

## bearer 모델과 sender constraint

OAuth 기본 access token은 RS가 `Authorization: Bearer ...`를 받아 token의 발급자·대상·scope·시간을 검증하는 구조입니다. 이때 token 전달자는 키를 제시할 필요가 없습니다. DPoP client는 요청에 `DPoP: <proof JWT>`를 추가하고, token type도 보통 `DPoP`로 사용합니다. RS는 token 검증 결과가 “이 키에 묶였다”는 사실과 proof가 “바로 이 HTTP 요청을 서명했다”는 사실을 함께 확인합니다.

공개키는 proof JWT의 헤더 `jwk`에 들어가고, private key는 client 밖으로 나가면 안 됩니다. AS가 DPoP-bound access token을 발급할 때에는 해당 공개키의 JWK SHA-256 thumbprint를 `cnf.jkt`로 token에 넣습니다. 그러므로 token 문자열을 가진 것만으로는 부족하고, 그 token이 가리키는 공개키에 대응하는 private key로 현재 proof를 만들 수 있어야 합니다. `cnf`를 확인하지 않고 proof 서명만 검사하면 어떤 유효한 키든 token을 사용할 수 있어 sender constraint가 사라집니다.

DPoP는 mTLS처럼 transport layer에 인증서를 고정하는 방식이 아니라 HTTP 헤더와 JWT로 동작합니다. 그래서 모바일 앱·브라우저처럼 TLS client certificate 운용이 어려운 환경에 적용할 수 있지만, 응용 계층이 URI 표기와 재생 방지를 정확히 구현해야 하는 부담이 생깁니다.

## proof JWT의 요청 결합

DPoP proof의 payload에는 최소한 고유한 `jti`, 생성 시각 `iat`, HTTP method를 나타내는 `htm`, query·fragment를 제외한 HTTP target URI인 `htu`가 들어갑니다. access token을 함께 제시하는 protected resource 요청에서는 token의 base64url SHA-256 해시를 `ath`로 넣어야 합니다. proof의 JWS 서명 알고리즘과 공개키는 AS/RS가 허용한 정책으로 제한하며, proof에 들어온 `alg`나 `jwk`를 맹목적으로 신뢰하지 않습니다.

검증 순서는 다음처럼 분리하면 추적하기 쉽습니다.

1. 헤더의 `typ`와 `jwk`, 알고리즘을 정책에 맞게 검사합니다.
2. 공개키로 JWT 서명을 검증하고 `iat`가 허용된 시간 창에 있는지 확인합니다.
3. `htm`을 실제 HTTP method와 비교하고, `htu`를 신뢰된 외부 요청 URI와 비교합니다.
4. access token이 있다면 `ath`를 token 원문에서 계산해 비교합니다.
5. token의 `cnf.jkt`를 proof 공개키 thumbprint와 비교합니다.
6. `jti`를 replay cache에 원자적으로 기록하면서 재사용을 거절합니다.

서명 검증은 “이 private key를 가진 누군가가 만들었다”를 말해 주지만, 요청의 목적과 freshness는 말해 주지 않습니다. 예를 들어 키 A로 서명한 proof가 `/orders/123`용인데 서버가 `/admin/export`에서 재사용을 허용하면 proof 자체는 진짜여도 요청 결합은 깨집니다. `ath`를 빼면 키는 맞지만 다른 access token을 끼워 넣을 가능성이 생깁니다.

```diagram
{"title":"DPoP 요청의 두 겹 결합","caption":"proof의 요청 필드와 access token의 cnf가 같은 공개키·같은 요청 문맥을 가리켜야 RS가 통과시킵니다.","rows":[[{"id":"proof","label":"DPoP proof","detail":["jwk·htm·htu·iat·jti","access token이면 ath"]},{"id":"token","label":"DPoP access token","detail":["cnf.jkt·issuer·audience","scope·expiry"]}],[{"id":"verify","label":"RS 결합 검증","detail":["서명·URI·method","키 thumbprint·ath·replay"]}],[{"id":"allow","label":"요청 처리","detail":["검증된 키 보유자만","해당 API 문맥에서 사용"]}]],"edges":[{"from":"proof","to":"verify","label":"현재 요청 증명"},{"from":"token","to":"verify","label":"발급 키·권한"},{"from":"verify","to":"allow","label":"모든 조건 통과"}]}
```

## 시간과 replay cache

`iat`만 검사하면 같은 proof를 짧은 시간 동안 반복할 수 있습니다. 반대로 `jti`만 검사하고 오래된 proof를 허용하면 cache가 영원히 커지고, 공격자가 과거에 캡처한 proof를 다시 시도할 창이 남습니다. 서버는 허용 clock skew와 최대 proof age를 정책으로 정하고, `jti`를 최소 그 시간보다 길게 보관해야 합니다. RFC 9449는 구현이 proof replay를 막도록 요구하지만, 정확한 cache TTL·분산 저장·nonce 사용 조건은 배포 정책으로 남습니다.

예를 들어 서버 시각이 12:00:10이고 최대 age가 300초, 허용 skew가 30초라면 `iat=11:54:00`은 370초 전이므로 거절합니다. `iat=12:00:00`, `jti=J7`은 첫 요청에서 `J7`을 저장하고 통과시키지만, 12:00:12에 같은 proof가 오면 서명이 여전히 맞아도 cache hit로 거절합니다. 두 노드가 동시에 J7을 받았을 때 둘 다 먼저 `get`하고 나중에 `set`하면 양쪽이 통과할 수 있으므로 `SETNX`와 같은 원자적 insert 또는 단일화된 replay 저장소가 필요합니다.

AS나 RS가 nonce를 요구하는 배포에서는 server-issued nonce를 proof에 넣게 할 수 있습니다. nonce는 jti 중복 추적을 대신하지 않습니다. 다만 서버가 시각을 담은 nonce를 관리하면 client가 보낸 iat와 서버 시각을 직접 비교하는 대신 nonce로 proof 수명을 제한할 수 있습니다. nonce를 오류 응답으로 받았을 때 client가 새 proof를 만들어 재시도할지, 어느 endpoint에서 같은 nonce를 인정할지 계약을 정해야 합니다. cache가 장애 났는데 검사를 생략해 허용으로 바꾸면 DPoP의 핵심 보장이 조용히 bearer로 후퇴합니다.

## 프록시와 외부 URI 정규화

`htu`는 client가 본 HTTP target URI와 RS가 비교하는 URI의 표기 계약입니다. 외부 주소가 `https://api.example/orders`인데 내부 hop은 `http://app:8080/orders`라면 내부 프레임워크의 URL을 그대로 비교해서는 정상 요청을 거절합니다. 반대로 요청의 `Host`나 `X-Forwarded-Host`를 모든 client가 주입할 수 있는 환경에서 그대로 신뢰하면 공격자가 proof 대상 URI를 바꿀 수 있습니다.

실무에서는 ingress처럼 신뢰된 proxy의 목록과 hop별 header 제거·재작성 규칙을 먼저 고정합니다. proxy가 TLS 종료 후 외부 scheme/host/port/path를 정규화해 내부에 전달하고, 애플리케이션은 그 trusted boundary에서 만든 값만 public base URL로 사용합니다. 신뢰되지 않은 직접 접근이 애플리케이션 포트에 도달한다면 forwarded header를 제거하거나 해당 경로를 차단해야 합니다. `htu`는 query와 fragment를 제외한다는 규칙도 코드로 명시합니다. query가 권한 판단에 중요하더라도 DPoP URI 비교 필드 자체와 자원 인가를 혼동하지 않아야 합니다.

실패를 재현할 때는 `https://api.example/orders` proof를 내부 `http://app:8080/orders` 요청으로 검증하는 경우, trusted proxy가 없는 `X-Forwarded-Host: evil.example` 요청, 기본 포트 생략과 trailing slash 차이를 각각 시험합니다. 정규화 결과를 로그에 남길 때는 token과 private key가 아니라 trace ID, method, 비교 결과, proxy 신뢰 판정만 남깁니다.

## 키 보관과 회전

키 회전은 token의 `cnf.jkt` 계약을 바꾸는 일입니다. client가 키 A로 token을 발급받은 뒤 로컬 키를 B로 바꾸면, A에 묶인 token을 B proof와 함께 제출할 수 없습니다. 이는 오류가 아니라 sender constraint가 정상 작동한 결과입니다. 가장 단순한 정책은 token endpoint에 기존 refresh 자격과 새 DPoP proof를 제출해 새 키 B에 묶인 token을 받는 것입니다. AS가 refresh token 자체도 DPoP-bound라면 refresh 거래에서도 현재 키 계약과 회전 허용 정책을 확인해야 합니다.

서버가 “편의를 위해 어떤 공개키든 token에 허용”하거나 `cnf.jkt` 검사를 생략하면 회전은 쉬워지지만 token 탈취 방어가 없어집니다. 반대로 짧은 access token 수명, refresh token rotation, 키 저장소의 접근 통제, 분실 키 폐기와 동시 회전의 재시도 계약을 함께 설계해야 합니다. 키 A가 유출되었다면 단순히 B를 새로 만든 것만으로 A token이 즉시 무효화되는지는 AS 정책에 달렸습니다. 해당 token 계열을 회수할 수 없다면 만료 전까지 A를 차단할 방법이 제한될 수 있음을 명시해야 합니다.

설명용 상태를 두면 `token T1: cnf=A, exp=12:10`, `client current key=A`에서 요청은 통과합니다. 12:00에 client가 B로 회전하면 `T1 + proof(B)`는 thumbprint 불일치로 거절되고, refresh 교환으로 `T2: cnf=B, exp=12:20`을 받은 뒤에야 정상 요청이 됩니다. 이 숫자는 특정 제품의 수명이 아니라 상태 전이 설명입니다.

## 구현 선택과 관측

access token이 JWT인지 opaque인지에 따라 RS가 `cnf`를 직접 읽거나 introspection으로 확인할 수 있습니다. 어느 방식이든 issuer, audience, expiry, scope 검증은 sender constraint와 별개입니다. proof 검증 성공이 주문 소유권·역할·HTTP action을 자동 허용하지도 않습니다. 기존 권한 검사처럼 검증된 주체와 실제 resource를 다시 비교해야 합니다.

중앙 replay cache는 여러 RS 인스턴스의 중복 검사를 맞추기 쉽지만 네트워크 의존성과 보존 비용이 생깁니다. 노드별 cache는 지연이 적어도 같은 proof가 다른 노드에서 통과할 수 있습니다. 분산 환경에서 허용하는 replay window와 위험을 수치로 정하고, cache 장애 시 fail-closed인지 제한된 grace인지 문서화합니다. DPoP proof 원문과 token 원문은 로그에 남기지 않고, hash 일부나 jti도 개인정보·추적 위험을 검토해 최소화합니다.

검증 메트릭은 `proof_signature_invalid`, `htu_mismatch`, `htm_mismatch`, `ath_mismatch`, `cnf_mismatch`, `iat_out_of_window`, `jti_replay`, `nonce_missing`처럼 원인을 나눠야 합니다. 같은 401이라도 키 회전 문제와 프록시 URL 문제의 대응이 다릅니다. 정상 client의 시계가 크게 어긋난 경우를 별도로 관찰하되, clock skew를 무제한 늘려 공격 창을 넓히지는 않습니다.

## 실패 시나리오와 검증 범위

다음 테스트는 DPoP를 bearer header 장식으로만 구현했는지 확인합니다. token T1이 키 A에 묶여 있는데 키 B proof로 보내면 `cnf` 불일치로 거절되어야 합니다. 키 A proof라도 `htm=GET`, 실제 요청이 POST면 거절합니다. `htu`가 `/orders/1`인 proof를 `/orders/2`에서 재사용하지 못해야 하며, access token을 바꿔 끼우면 `ath`가 실패해야 합니다. 동일 `jti`를 두 노드에 거의 동시에 보내 두 번째가 차단되는지도 확인합니다.

프록시 테스트는 public URL과 internal URL을 각각 기록하고 trusted proxy 경계를 벗어난 forwarded header가 반영되지 않는지 확인합니다. 키 회전 시험은 A token이 B proof로 실패한 뒤 정상 refresh 경로에서만 B token이 발급되는지 확인합니다. AS nonce를 사용하는 경우 stale nonce, 다른 client의 nonce, nonce 없는 proof를 각각 분리합니다.

이 장의 계산과 trace는 설명용이며 실제 authorization server나 분산 cache를 실행한 결과가 아닙니다. 근거로 사용한 규격은 RFC 9449(2023년 9월 Proposed Standard) 원문입니다. 해당 RFC는 proof claim, access token `cnf.jkt`, access token hash, replay·nonce 고려사항을 규정하지만, nonce TTL·cache 제품·proxy header 정책은 배포자가 정해야 합니다. 기존 OAuth 기초 노트의 token 목적·issuer·audience 구분을 전제로 하며, DPoP가 그 검사를 대체하지 않는다는 점을 특히 확인해야 합니다.

## 참고 자료와 경계

- [RFC 9449: OAuth 2.0 Demonstrating Proof of Possession at the Application Layer](https://www.rfc-editor.org/rfc/rfc9449.html) — 2023-09, Proposed Standard. proof JWT, `jti`·`iat`·`htm`·`htu`·`ath`, DPoP nonce, token public-key binding과 replay 고려사항을 대조했습니다.
- [OAuth 2.0 권한 위임](/tech-interview/notes/oauth2-foundations/) — access token과 refresh token의 서로 다른 사용처, issuer·audience·scope 검증을 연결했습니다.
- 프록시의 forwarded header 신뢰 범위와 실제 AS/RS의 nonce·replay-cache TTL은 이 저장소에서 확정된 운영 정책이 아니므로 특정 값으로 단정하지 않았습니다.
