---
id: login-transaction
title: OAuth·OIDC 로그인 거래
topic: 보안
summary: 브라우저의 시작 세션에서 코드 교환과 ID token 검증까지 따라가며 PKCE·state·nonce·issuer의 서로 다른 결합 대상을 설명합니다.
questionIds: [oauth-oidc-pkce, oidc-nonce-state-binding]
---

# OAuth·OIDC 로그인 거래

## callback code와 로그인 신원 확정의 분리

로그인은 브라우저 왕복, authorization code 교환, ID token 검증, 서비스 계정 연결이라는 서로 다른 단계의 거래입니다. 앞 단계의 성공이 뒤 단계의 신원 확정을 대신하지 않으며, 각 단계가 같은 시도를 가리키는지 확인해야 합니다.

브라우저 탭 A에서 공급자 P로 로그인을 시작하고 탭 B에서는 공급자 Q로 시작했다고 합시다. 두 탭의 콜백이 순서대로 돌아온다는 보장은 없습니다. 서버가 세션에 마지막 공급자 하나만 저장하거나, 콜백에 온 코드를 아무 token endpoint에나 보내면 서로 다른 로그인 시도가 섞입니다.

**OAuth**는 API 접근 권한 위임을 다루며, **OIDC**는 그 위에서 로그인 신원을 확인하는 규칙을 제공합니다. access token을 받았다는 사실만으로 우리 서비스의 로그인 계정을 정하지 않습니다. OIDC ID token을 올바른 요청·발급자·클라이언트 문맥에서 검증한 뒤 계정 모델로 연결합니다.

## state·PKCE verifier·nonce 결합 대상

| 값 | 처음 보관할 상태 | 돌아올 때 확인하는 관계 |
| --- | --- | --- |
| state | 로그인 시도와 시작 브라우저 세션 | 이 callback이 그 시도에 대한 응답인가 |
| PKCE verifier | 해당 시도의 비밀 난수 | 받은 code가 원래 challenge를 만든 클라이언트에 의해 교환되는가 |
| nonce | 해당 OIDC 인증 요청 | ID token이 그 인증 요청에 대응하는가 |

PKCE의 S256 challenge는 `BASE64URL(SHA256(verifier))`입니다. authorization 요청에는 challenge를 보내고, token endpoint의 코드 교환에는 원래 verifier를 보냅니다. 새 verifier를 만들거나 challenge와 함께 verifier를 공개하면 결합 목적을 잃습니다. SPA·모바일 앱에 배포한 client secret은 비밀 클라이언트의 안전한 비밀로 가정할 수 없습니다.

`state`는 URL에 돌아왔다는 사실만으로 통과시키지 않고, 서버가 시작할 때 저장한 세션·만료·미사용 시도에서 같은 값을 찾아 대조합니다. `nonce`는 ID token 안의 값과 그 OIDC 인증 요청에 저장한 값을 비교해, 서명된 토큰이 이번 요청에 대응하는지 확인합니다. Authorization Code Flow에서 nonce를 보냈다면 반드시 검사하고, 사용하는 프로파일이 nonce를 요구하면 생성 단계에서 빠지지 않게 하되, 모든 Code Flow에 똑같은 nonce 필수 조건이 있다고 일반화하지 않습니다.

## 시도별 로그인 상태 분리

```diagram
{"title":"코드와 신원 응답을 시작 시도에 연결합니다","caption":"화살표는 검증 순서입니다. 공급자와 redirect URI는 callback 입력이 아니라 시작할 때 선택한 신뢰 설정에서 가져옵니다.","rows":[[{"id":"start","label":"시도 T 생성","detail":["세션·공급자·기한","state·verifier·nonce"]}],[{"id":"callback","label":"callback 결합 확인","detail":["세션·state·미사용"]}],[{"id":"exchange","label":"등록 endpoint에서 교환","detail":["code + 원래 verifier"]}],[{"id":"identity","label":"ID token 문맥 검증","detail":["서명·iss·aud·시간·nonce"]}]],"edges":[{"from":"start","to":"callback","label":"authorization 응답"},{"from":"callback","to":"exchange","label":"그 시도만 진행"},{"from":"exchange","to":"identity","label":"신원 증명 확인"}]}
```

`T={session_id, provider_id, redirect_uri, expires_at, state_hash, verifier, nonce, status}`처럼 시도별 레코드를 생각할 수 있습니다. verifier는 교환에 원문이 필요하므로 해시만 저장해서는 교환할 수 없습니다. 짧게 보관하고 접근을 제한하며 로그·추적 시스템에서 제외합니다. state 검증용 해시와 verifier의 보관 목적은 다릅니다.

선택 기준은 공급자 수와 클라이언트 형태에 따라 달라집니다. 서버가 callback을 받는 confidential client라도 PKCE·state·redirect URI 검증을 별도로 유지하고, SPA·모바일처럼 client secret을 숨길 수 없는 클라이언트는 공개 클라이언트로 취급합니다. nonce는 OIDC 요청과 ID token의 결합에 사용하며 OAuth access token의 권한 범위를 대신하지 않습니다.

탭 A와 B에는 서로 다른 T를 줍니다. callback 처리자가 T를 `pending → exchanging`으로 조건부 변경하면 같은 code를 두 worker가 동시에 교환하는 것을 줄일 수 있습니다. 서버가 교환 응답을 받기 전에 중단되면 provider에서는 code가 이미 소비됐을 수 있습니다. 로컬 상태를 pending으로 되돌린다고 provider의 일회성 code가 되살아나지는 않습니다. 결과를 확정할 수 없는 시도는 새 로그인을 안내하는 등 명시적인 복구 경로가 필요합니다.

## 서명 검증과 토큰 사용 문맥

검증기는 서버가 신뢰한 공급자 설정으로 알고리즘·키 집합을 선택합니다. 토큰에 적힌 issuer를 보고 임의 URL을 방문하지 않습니다. 여러 공급자를 지원하면 미검증 issuer는 등록된 설정을 찾는 힌트로만 쓰고, 최종 검증에서 정확한 issuer와 시작 시도의 공급자를 대조합니다.

ID token의 audience가 우리 client인지, 만료·not-before 등 시간 조건이 맞는지, 필요한 경우 다중 audience의 authorized party 등 프로파일 조건을 만족하는지 확인합니다. 서명이 같은 키로 유효하더라도 다른 애플리케이션용 ID token이나 API access token을 로그인 증명으로 받으면 안 됩니다. 검증된 OIDC 라이브러리를 사용하되 기본 옵션이 우리 배치의 요구와 일치하는지 확인합니다.

redirect URI는 등록값과 프로토콜 규칙에 맞게 엄격히 제한합니다. 로그인 이후 돌아갈 앱 내부 경로도 별도 허용 정책으로 다룹니다. state를 검증했다고 임의 외부 return URL까지 신뢰할 수는 없습니다.

## 실패 단계별 로그인 검증 시험

테스트 계정과 로컬 가짜 공급자를 사용해 탭 A의 state를 B 세션에 붙이면 코드 교환 전에 거절되는지 확인합니다. 올바른 state라도 다른 verifier이면 token endpoint에서 실패해야 하고, 교환이 성공해도 nonce·issuer·audience가 다르면 로그인 세션을 만들면 안 됩니다.

동일 callback 동시 도착, 만료된 시도, 교환 성공 직후 프로세스 중단, 공급자 Q의 유효한 토큰을 P 시도에 넣는 경우를 각각 시험합니다. 실패 로그에는 시도 ID와 단계·사유를 남기고 code·verifier·토큰 원문은 남기지 않습니다. 이 노트의 흐름은 설계 모형이며 특정 공급자의 실제 로그인을 실행한 결과는 아닙니다.

예상 결과는 탭 A의 state를 탭 B의 시도 레코드에 넣으면 code 교환 전에 거절되고, 올바른 state에 잘못된 verifier를 넣으면 token endpoint 교환이 실패하는 것입니다. 교환 자체가 성공해도 nonce·issuer·audience 검증이 실패하면 서비스 로그인 세션을 만들지 않아야 하며, 응답 유실 뒤에는 code가 재사용되지 않을 수 있음을 UI 복구 경로에 반영합니다.
