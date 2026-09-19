---
id: dpop-proof-binding
title: DPoP proof가 access token을 어떻게 특정 키와 HTTP 요청에 묶나요?
difficulty: 중하
category: 보안
tags:
  - OAuth
  - DPoP
  - sender-constrained
related:
  - oauth-oidc-pkce
---
# DPoP proof가 access token을 어떻게 특정 키와 HTTP 요청에 묶나요?

## 구두 답변

핵심은 JWT 서명을 한 번 확인하는 것이 아니라, 세 가지 결합을 모두 확인하는 것입니다. 첫째 access token의 `cnf.jkt`는 발급 시 선택된 공개키의 JWK thumbprint입니다. 둘째 proof JWT header의 `jwk`와 서명은 그 공개키에 대응하는 private key가 현재 client에 있음을 보여 줍니다. 셋째 payload의 `htm`과 query·fragment를 제외한 `htu`가 실제 요청을 가리키고, resource 요청이면 `ath`가 현재 access token의 base64url SHA-256 값과 일치해야 합니다. `jti`·`iat`는 freshness와 replay 검사의 입력입니다.

예를 들어 T1의 `cnf.jkt=A`이고 client가 키 A로 `P1={htm:GET, htu:https://api.example/orders/7, ath:hash(T1)}`를 만들었다고 하겠습니다. RS는 허용 알고리즘과 `typ`·`jwk` 형식을 확인하고 서명, 시간, method, public URI, `ath`, thumbprint 순으로 검증한 뒤 권한 검사를 합니다. 키 B로 서명한 proof는 서명이 유효해도 B≠A라서 거절됩니다. A proof를 `/orders/8`에 재사용하면 `htu`가 어긋나고, T2를 끼우면 `ath`가 어긋납니다. 이 실패 순서를 분리해 두면 키 문제와 요청 변조를 같은 401로 뭉개지 않고 관측할 수 있습니다.

다만 DPoP는 private key가 탈취되거나 정상 client 프로세스가 장악된 상황을 해결하지 않습니다. 또한 proof가 통과해도 issuer·audience·expiry·scope, 주문 소유자와 action 인가는 별도입니다. proxy 뒤에서는 내부 `http://app:8080`이 아니라 trusted ingress가 확정한 외부 URI로 `htu`를 계산해야 합니다. proof 원문과 token은 로그에 남기지 않고 실패 종류와 trace ID만 남기는 것이 비용과 개인정보 노출을 줄이는 선택입니다.

## 득점 포인트

- `cnf.jkt`와 proof 공개키 thumbprint의 equality가 sender constraint의 핵심이라는 점을 설명한다.
- `htm`·`htu`·`ath`를 실제 요청과 token 원문에 대조하는 중간 상태를 제시한다.
- DPoP 통과 뒤 resource-level 인가와 private-key compromise 한계를 분리한다.

## 감점 포인트

- 서명만 검증하고 token의 `cnf`나 요청 URI를 확인하지 않는다.
- `ath`를 생략한 채 같은 키면 어떤 access token도 쓸 수 있다고 한다.
- DPoP proof가 주문 소유권까지 자동으로 허용한다고 설명한다.

## 더 파고들 거리

- proxy canonical URI를 trusted boundary에서 만드는 방법은 무엇인가요?
- jti replay cache를 여러 RS에서 원자적으로 공유하려면 어떻게 할까요?
