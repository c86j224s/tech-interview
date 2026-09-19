---
id: dpop-proxy-uri
title: 프록시 뒤에서 DPoP htu를 검증할 때 내부 URL과 외부 URL을 어떻게 구분하나요?
difficulty: 중하
category: 보안
tags:
  - DPoP
  - 프록시
  - HTTP
related:
  - http-proxy-forwarded-trust
---
# 프록시 뒤에서 DPoP htu를 검증할 때 내부 URL과 외부 URL을 어떻게 구분하나요?

## 구두 답변

`htu` 비교 기준은 client가 실제로 본 public target URI이며, 애플리케이션의 내부 socket 주소가 아닙니다. 사용자가 `https://api.example/orders`로 요청했고 ingress가 `http://app:8080/orders`로 전달했다면 proof의 `htu`는 전자와 비교해야 정상 요청이 통과합니다. 그러나 애플리케이션이 모든 `X-Forwarded-Host`를 그대로 믿으면 client가 `evil.example`을 주입해 서버가 엉뚱한 public URI를 기준으로 삼을 수 있습니다.

구현은 먼저 trusted proxy 경계를 고정합니다. ingress가 외부 TLS 종료, 허용 host, scheme, port, path prefix를 검사하고 내부 hop에서 들어온 전달값을 제거·재작성한 뒤, 애플리케이션은 그 trusted 결과만 canonical public URI의 입력으로 사용합니다. 직접 app 포트에 접근할 수 있다면 forwarded header를 무시하거나 경로를 차단해야 합니다. 그 다음 `htm`은 실제 method와, `htu`는 query와 fragment를 제외한 외부 URI와 비교합니다. 기본 포트 생략, trailing slash, percent-encoding, path prefix 처리 규칙도 모든 검증기에서 동일해야 합니다.

예를 들어 P1의 대상이 `https://api.example/orders`인데 내부 URL을 비교하면 false negative가 납니다. 반대로 신뢰되지 않은 요청이 `X-Forwarded-Host: api.example`를 넣어 true가 되면 false positive입니다. URI 검증이 통과해도 audience·scope와 tenant·주문 소유자 인가는 별도입니다. 특히 query가 업무 의미를 가지는 API라면 DPoP의 `htu`가 query를 제외한다는 이유로 query 검사를 생략하면 안 됩니다. canonical URI와 proxy 신뢰 판정만 구조화 로그로 남기는 것이 운영 비용을 줄입니다.

## 득점 포인트

- public URI를 만드는 trusted proxy와 내부 listen 주소를 분리한다.
- forwarded header의 제거·재작성과 canonicalization 규칙을 구현 계약으로 둔다.
- `htu` 성공 뒤에도 audience·scope·resource 인가가 남는다고 설명한다.

## 감점 포인트

- 내부 `http://app:8080`을 모든 proof의 비교 기준으로 사용한다.
- client가 보낸 Host나 forwarded header를 무조건 신뢰한다.
- `htu`가 맞으면 query 권한과 resource 소유권도 끝났다고 한다.

## 더 파고들 거리

- 여러 public host를 allowlist로 지원할 때 canonical 기준은 어떻게 정할까요?
- path prefix를 ingress가 추가하는 환경의 테스트 행렬은 무엇인가요?
