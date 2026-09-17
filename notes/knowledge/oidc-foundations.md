---
id: oidc-foundations
title: OpenID Connect 인증
topic: 보안
summary: OpenID Connect의 ID Token과 Discovery 정보를 OAuth 거래와 분리하고, issuer·subject·audience·nonce로 신원을 연결하는 순서를 설명합니다.
questionIds: []
prerequisites: [oauth2-foundations]
related: [account-linking, key-rotation, session-authority, browser-request-security]
reviewedAt: '2026-09-17'
---

# OpenID Connect 인증

## 인증 결과의 위치

OAuth 2.0은 애플리케이션이 보호된 자원에 접근할 권한을 위임하는 규격입니다. OpenID Connect(OIDC)는 그 위에 사용자가 누구인지 확인하기 위한 인증 규칙을 더합니다. 따라서 같은 token response에 access token과 ID Token이 함께 들어와도 둘을 같은 자격으로 다루지 않습니다.

ID Token은 client가 자신이 시작한 OIDC 인증 요청의 결과를 확인하는 인증 assertion입니다. 반면 access token은 Resource Server가 API 접근을 판단하는 자격입니다. Access token의 서명이 유효하다는 사실만으로 우리 서비스의 로그인 주체를 만들지 않으며, ID Token을 API bearer 자격으로 보내지도 않습니다.

이 장은 OIDC Authorization Code Flow를 기준으로 합니다. Front-channel은 사용자의 브라우저가 provider와 client 사이를 이동하는 경로이고, back-channel은 client가 token endpoint와 직접 통신하는 경로입니다. 다른 flow나 provider별 확장은 필요한 조건을 따로 표시해야 합니다.

## Discovery와 신뢰 설정

OIDC Discovery는 provider의 metadata에서 issuer, authorization endpoint, token endpoint, jwks_uri 같은 설정을 얻는 방법입니다. 이미 신뢰된 provider 설정을 배포하는 경우에는 그 설정이 대체 입력이 될 수 있습니다. 어느 경로든 client가 임의 token의 `iss`나 `kid`를 보고 키 URL을 만들지는 않습니다.

Discovery 응답의 `issuer`는 discovery에 사용한 issuer와 정확히 같아야 합니다. 다르면 그 metadata를 사용하지 않고 dependent operation을 중단합니다. 이 검사는 단순 문자열 편의 정규화가 아니라, 요청한 provider와 응답이 같은 발급자를 가리키는지 확인하는 신뢰 경계 검사입니다.

`jwks_uri`는 provider의 서명 공개 키 집합을 가져오는 주소입니다. 검증기는 등록된 issuer의 metadata에서 얻은 주소와 허용 알고리즘·키 용도를 사용합니다. Token에 적힌 임의 URL을 따라가지 않으며, 키 갱신 실패를 서명 검증 생략으로 바꾸지 않습니다.

| 설정 | 의미 | 검증 시점 |
| --- | --- | --- |
| issuer | ID Token을 발급한 provider 식별자 | 등록값·Discovery 응답·ID Token의 정확한 일치 |
| authorization_endpoint | 사용자 승인으로 이동할 주소 | 시작 거래가 선택한 provider 설정 |
| token_endpoint | code를 token으로 교환할 주소 | callback이 임의로 바꾸지 않음 |
| jwks_uri | 서명 검증용 공개 키 집합 주소 | 신뢰된 metadata에서 선택 |

## ID Token claim 계약

ID Token에는 issuer(`iss`), subject(`sub`), audience(`aud`), 만료 시각(`exp`), 발급 시각(`iat`)을 포함하는 claim 계약이 있습니다. `iss`는 어떤 provider가 발급했는지, `sub`는 그 issuer의 문맥에서 어떤 사용자인지를 나타냅니다. 내부 계정 키는 보통 `(issuer, sub)` 쌍으로 만들며 `sub`만 전역 사용자 ID처럼 쓰지 않습니다.

`aud`는 하나의 문자열일 수도 있고 배열일 수도 있습니다. 우리 RP의 등록된 `client_id`가 audience에 포함되어야 하며, 다중 audience라면 OIDC 프로파일이 요구하는 `azp` 조건도 확인합니다. “aud 전체가 언제나 client_id 하나와 정확히 같다”라고 일반화하면 배열 문맥을 잘못 거절하거나, 반대로 다른 용도의 token을 허용할 수 있습니다.

시간 claim은 `exp`가 현재보다 미래인지, `iat`가 배치가 허용한 시계 오차와 발급 시점 정책에 맞는지 확인합니다. 서버가 허용하는 알고리즘과 키 용도도 claim 검증과 함께 제한합니다. 이 시간 여유와 cache 기간은 provider별 계약과 local policy이며 OIDC Discovery가 하나의 숫자로 정해 주는 값이 아닙니다.

| Claim | 질문 | 실패 예 |
| --- | --- | --- |
| `iss` | 등록 provider가 발급했는가 | P 대신 Q가 발급 |
| `sub` | provider 안의 어느 사용자 인가 | 값 없음·내부 키로 단독 사용 |
| `aud` | 우리 client를 대상으로 했는가 | client-Q용 token |
| `azp` | 다중 audience의 authorized party가 맞는가 | 다른 client가 authorized party |
| `exp`, `iat` | 시간 정책 안에 있는가 | 만료·허용 범위를 벗어난 발급 시각 |
| `nonce` | 이번 인증 요청에 대응하는가 | 이전 요청의 nonce |

## State와 nonce의 분리

`state`는 브라우저 callback이 시작한 transaction에 속하는지 확인하는 상관값입니다. 서버는 시작할 때 세션·provider·redirect URI·만료·미사용 상태와 함께 저장하고, callback에서 일치하는 시도를 찾습니다. State는 ID Token 속 사용자를 증명하는 값이 아니며 nonce나 PKCE verifier와 같은 값을 재사용하지 않습니다.

`nonce`는 OIDC 인증 요청과 ID Token을 결합합니다. Authorization request에 nonce를 보냈다면 ID Token의 nonce가 같은지 확인해야 합니다. Nonce는 인증 요청의 재생과 다른 요청의 token 혼입을 줄이는 값이지, issuer·audience·서명 검증의 대체값이 아닙니다. Authorization Code Flow의 nonce 적용 강도는 OIDC Core와 사용하는 provider profile을 함께 확인합니다.

PKCE verifier는 authorization code 교환을 보호하는 거래별 비밀입니다. State는 callback의 브라우저 거래, PKCE는 code 교환자, nonce는 OIDC 인증 요청과 ID Token을 각각 결합한다고 기억하면 경계를 유지하기 쉽습니다. [OAuth·OIDC 로그인 거래](/tech-interview/notes/login-transaction/)는 이 세 값의 보관과 callback 상태 전이를 더 깊게 다룹니다.

```diagram
{"title":"OIDC 신원은 네 검증 축을 통과합니다","caption":"브라우저 거래의 상관관계와 ID Token의 신원·시간·요청 대응을 분리합니다. 하나가 맞아도 다른 축이 틀리면 로그인 세션을 만들지 않습니다.","rows":[[{"id":"transaction","label":"시작 거래","detail":["provider·state·nonce"]},{"id":"token","label":"ID Token","detail":["서명된 claim"]}],[{"id":"issuer","label":"issuer·키 검증","detail":["등록 issuer·jwks"]},{"id":"claims","label":"claim 검증","detail":["aud·시간·nonce"]}],[{"id":"identity","label":"외부 신원 연결","detail":["(issuer, subject)"]}]],"edges":[{"from":"transaction","to":"issuer","label":"선택한 provider"},{"from":"token","to":"issuer","label":"iss·서명"},{"from":"token","to":"claims","label":"aud·exp·iat·nonce"},{"from":"transaction","to":"claims","label":"nonce·client 문맥"},{"from":"issuer","to":"identity","label":"발급자 확정"},{"from":"claims","to":"identity","label":"검증 통과"}]}
```

## 검증 순서의 실제 흐름

예를 들어 서비스 P에 `client-P`로 로그인한다고 합시다. 시작 시 expected issuer는 <https://p.example>, redirect URI는 등록된 값, state는 `s1`, nonce는 `n-current`로 저장합니다. Callback에 `state=s1`과 code가 돌아오면 먼저 미사용·만료·세션·provider를 확인하고, token endpoint에서 code를 교환합니다.

Token response에 ID Token A가 왔는데 `iss=P`, `aud=client-Q`라면 서명과 만료가 유효해도 우리 client 대상이 아니므로 로그인 세션을 만들지 않습니다. ID Token B가 `iss=P`, `aud=client-P`이지만 `nonce=n-old`라면 이번 요청과 맞지 않아 거절합니다. ID Token C가 `iss=P`, `aud=client-P`, `nonce=n-current`, `sub=s123`이고 서명·시간도 통과한 경우에만 P의 외부 신원 `P:s123`을 조회합니다.

여기서 `sub=s123`을 내부 계정 ID 123으로 바로 저장하지 않습니다. 내부 계정 연결은 OIDC claim 검증 이후의 정책입니다. `(issuer, subject)`가 이미 A에 연결됐는지, 다른 계정에 연결됐는지, 새 로그인인지에 따라 별도 계정 처리로 분기합니다.

| 입력 | 중간 판단 | 최종 결과 |
| --- | --- | --- |
| A: `iss=P`, `aud=client-Q` | 서명은 통과, client 문맥 불일치 | 로그인 세션 없음 |
| B: `iss=P`, `aud=client-P`, `nonce=n-old` | 요청 대응 불일치 | 로그인 세션 없음 |
| C: `iss=P`, `aud=client-P`, `nonce=n-current` | issuer·aud·시간·nonce 통과 | `P:s123` lookup |

## 외부 신원과 내부 계정

OIDC 검증은 “provider가 이 client를 위한 신원 assertion을 발급했는가”를 확인합니다. 그것이 곧 “어떤 기존 내부 계정에 로그인시킬 것인가”까지 결정하지는 않습니다. Email은 표시·연락 속성으로 쓸 수 있어도, 서로 다른 provider의 같은 이메일을 자동 계정 통합의 증거로 삼지 않습니다.

기존 계정에 새 provider를 연결하는 작업은 일반 로그인과 다른 목적을 가진 transaction입니다. 현재 계정 접근, 새 provider 신원 소유, 연결 의도를 별도로 확인하고, `(issuer, subject)` unique 제약으로 두 계정에 동시에 연결되지 않게 합니다. 소유권·동시성·세션 재평가는 [외부 신원과 계정 연결](/tech-interview/notes/account-linking/)에 있습니다.

로그인 성공 후에도 내부 API는 인증과 인가를 구분합니다. `P:s123`이 확인됐다고 주문 ID를 모두 볼 수 있는 것은 아닙니다. API는 access token 또는 자체 session 문맥에서 주체를 만들고, 실제 자원·행동·조직 정책을 검사합니다.

## Discovery와 키 교체 운영

OIDC Discovery 문서는 `jwks_uri`의 의미를 설명하지만 provider별 key cache lifetime, unknown `kid` 재시도, rollover timing을 정하지 않습니다. 따라서 “표준이 10분 동안 K1을 유지하라”고 말하지 않고, 그 값은 배치의 local policy로 둡니다.

운영에서는 K2 공개키를 먼저 검증자에 도달시키고, 새 K2 token의 실제 성공을 확인한 뒤 K1 발급 중단과 허용 창 종료를 관찰합니다. 검증기 cache에서 K2가 없으면 issuer 단위의 제한된 갱신을 하고, 임의 `kid`마다 외부 요청을 만들지 않습니다. 이 과정은 [서명키·API 키의 중첩 교체와 긴급 회수](/tech-interview/notes/key-rotation/)의 운영 모형이며 Discovery의 normative timing이 아닙니다.

키가 유출된 경우 정상 중첩 기간을 기다리는 방식으로 처리하지 않습니다. 검증자에서 해당 키의 신뢰를 제거하고, 영향을 받은 session·refresh 계열 회수와 재인증 정책을 별도로 진행합니다. 이미 시작된 작업이나 access token의 잔여 허용 창은 API별 회수 경계로 측정해야 합니다.

## 구현과 장애 진단

구현 순서는 provider 설정 선택, Discovery metadata issuer 비교, token endpoint code 교환, 서명·알고리즘·issuer 검증, audience·authorized party·시간·nonce 검증, `(issuer, subject)` lookup 순서로 고정합니다. Callback에 들어온 `iss`·`kid`·redirect를 신뢰 원점으로 사용하지 않습니다.

라이브러리를 사용하더라도 기본값이 허용 알고리즘·clock skew·audience·issuer·nonce 정책과 맞는지 확인합니다. 알 수 없는 `kid`를 만나면 제한된 cache refresh와 실패 원인을 관측하고, refresh 실패를 “서명 검증 성공”으로 해석하지 않습니다. 로그에는 provider ID·transaction ID·단계·오류 분류를 남기고 ID Token 원문이나 개인정보를 불필요하게 남기지 않습니다.

로그인 실패를 하나의 `invalid token`으로 뭉개면 provider 장애·잘못된 audience·nonce 혼입·키 rollover를 구별하기 어렵습니다. `issuer_mismatch`, `unknown_kid`, `audience_mismatch`, `expired`, `nonce_mismatch`, `account_conflict`처럼 단계와 원인을 분리하되 민감한 claim 원문은 보호합니다.

## 실무 확인 시나리오

테스트 provider P와 Q를 등록하고 P 거래에 Q authorization response를 넣습니다. Response의 `iss`가 지원되는 구성이라면 expected issuer와 정확히 비교하고, mismatch인 grant flow를 중단합니다. 이 요구는 해당 grant response의 처리 범위이며 애플리케이션 세션 전체 파기를 자동으로 뜻하지 않습니다.

ID Token A·B·C를 위 표처럼 준비해 A는 audience, B는 nonce, C는 모든 조건 통과로 판정합니다. 같은 `sub` 문자열을 P와 Q에서 각각 발급해도 두 외부 identity key가 다르게 저장되는지 확인합니다. Email만 같은 두 identity가 자동으로 한 내부 계정에 병합되지 않는지도 확인합니다.

이 문서의 흐름은 공식 문서와 repository note를 2026-09-17에 대조한 설계·교육 내용입니다. 실제 provider, 브라우저, JWKS 서버를 실행해 결과를 측정한 것은 아닙니다.

## 참고 자료와 검증 범위

- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) — errata set 2, Final, dated 2023-12-15. §1의 OAuth 위 인증, §§2–3.1.3.7의 ID Token·issuer·subject·audience·시간·nonce 검증을 사용했습니다.
- [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html) — errata set 2, Final, dated 2023-12-15. §§3–5, 7.2의 metadata·issuer·jwks_uri 의미와 rollover/cache timing 부재를 사용했습니다.
- [RFC 8414: OAuth 2.0 Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414) — RFC 8414, June 2018, Proposed Standard. OAuth AS metadata와 OIDC Discovery를 합치지 않는 경계를 사용했습니다.
- [RFC 9207: OAuth 2.0 Authorization Server Issuer Identification](https://www.rfc-editor.org/rfc/rfc9207) — Proposed Standard. 이번 extract에서는 정확한 publication date를 확정하지 못했으며, 다중 AS response의 issuer 식별 범위만 사용했습니다.
- 기존 노트 [OAuth·OIDC 로그인 거래](/tech-interview/notes/login-transaction/), [외부 신원과 계정 연결](/tech-interview/notes/account-linking/), [서명키·API 키의 중첩 교체와 긴급 회수](/tech-interview/notes/key-rotation/) — repository 파일을 2026-09-17에 대조한 심화 노트입니다.

검증 범위는 공식 IETF·OpenID 원문 페이지와 기존 repository note의 파일 대조입니다. Discovery가 provider별 cache·rollover 시점을 규정한다고 확장하지 않았으며 실행 시험 결과를 주장하지 않습니다.
