---
id: acme-challenge-boundary
title: ACME HTTP-01과 DNS-01 challenge를 어떤 도메인 통제 조건으로 선택하나요?
difficulty: 중하
category: 보안
tags:
  - ACME
  - challenge
  - DNS
related:
  - security-ssrf-url-fetch
---
# ACME HTTP-01과 DNS-01 challenge를 어떤 도메인 통제 조건으로 선택하나요?

## 구두 답변

HTTP-01과 DNS-01 중 하나를 기술 이름만으로 고르지 않고, 어떤 control plane을 자동화할 수 있으며 그 권한과 노출을 감당할 수 있는지 비교하겠습니다. HTTP-01은 CA가 특정 HTTP 경로에서 challenge 응답을 확인하므로 외부 CDN·LB가 해당 경로를 안정적으로 라우팅해야 합니다. DNS-01은 DNS TXT 기록에 control proof를 두므로 wildcard와 비HTTP origin에 유리할 수 있지만, 자동화 secret이 zone 변경 권한을 갖는 범위를 좁혀야 합니다.

외부 CDN 뒤 `api.example`을 갱신한다고 하겠습니다. 모든 edge가 `/.well-known/acme-challenge/<token>`을 origin 인증으로 막지 않고 동일하게 반환할 수 있으면 HTTP-01을 선택할 수 있습니다. 그렇지 않고 wildcard나 내부 origin처럼 HTTP 노출을 만들기 어렵다면 DNS provider의 특정 zone·TXT record만 조작하는 DNS-01을 검토합니다. DNS 전파 지연, 오래된 TXT record, provider API 장애를 retry와 cleanup에 넣고, challenge secret을 애플리케이션 DB나 일반 사용자 데이터로 보내지 않습니다.

ACME challenge는 인증서 subject에 대한 도메인 통제 증명이지 사용자 로그인이나 API 인가가 아닙니다. 따라서 challenge route가 성공해도 서비스 관리 API 권한이 생기지 않으며, DNS API 계정이 탈취되면 해당 계정이 조작할 수 있는 zone 전체가 위험해집니다. 두 방식 모두 외부 관찰 지점에서 성공 여부를 확인하고, CA별 challenge 지원과 rate limit은 RFC의 일반 흐름과 별도로 선택한 CA 문서를 확인하겠습니다.


구체적인 관찰값으로 선택합니다. HTTP-01은 CA가 TCP 80에서 `/.well-known/acme-challenge/<token>`을 조회하므로 CDN의 모든 edge가 인증 redirect나 오래된 cache 없이 동일 token을 반환하는지 확인합니다. 80번 경로가 차단되거나 multi-edge가 서로 다른 origin을 가리키면 authorization이 실패합니다. DNS-01은 `_acme-challenge.example` TXT에 token을 게시하고 외부 resolver에서 새 값이 보이는지 확인하므로 wildcard authorization과 HTTP 서비스가 없는 origin에 적합하지만, 자동화 계정이 zone 전체를 수정하면 탈취 시 blast radius가 커집니다. 따라서 특정 zone과 TXT record 조작 권한만 주고 오래된 TXT의 cleanup과 전파 timeout을 기록합니다. 어느 challenge를 통과해도 이는 CA가 subject 도메인 통제를 확인한 것일 뿐 앱 로그인·관리 API 권한이 아닙니다. 이 환경에서는 CA에 실제 요청을 보내지 않았으므로 edge·DNS 관찰은 설계 trace이며, 선택한 CA가 지원하는 challenge와 rate limit은 별도 문서로 확인합니다.

## 득점 포인트

- HTTP-01의 라우팅·캐시 경계와 DNS-01의 zone 권한을 비교한다.
- challenge 성공과 앱 인증·인가를 분리한다.
- wildcard·CDN·DNS 전파라는 선택 조건을 구체화한다.

## 감점 포인트

- DNS-01이면 모든 DNS 권한을 자동화 계정에 준다.
- challenge token을 사용자 인증 또는 앱 데이터로 취급한다.

## 더 파고들 거리

- HTTP-01의 CDN cache와 multi-edge 응답을 어떤 외부 probe로 검증할까요?
- DNS-01 secret을 zone·record 단위로 제한하면서 갱신을 복구하려면 어떻게 할까요?
