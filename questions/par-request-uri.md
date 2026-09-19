---
id: par-request-uri
title: PAR를 사용하면 브라우저 authorization request의 어떤 위험이 줄어드나요?
difficulty: 중하
category: 보안
tags:
  - OAuth
  - PAR
  - authorization request
related:
  - oauth-oidc-pkce
---
# PAR를 사용하면 브라우저 authorization request의 어떤 위험이 줄어드나요?

## 구두 답변

PAR는 client가 전체 authorization request를 AS의 PAR endpoint에 백채널로 먼저 제출하고, 성공 응답의 `request_uri`를 브라우저 authorization endpoint에 보내는 방식입니다. 따라서 front channel URL에 `scope`, `redirect_uri`, 거래 상태 전체를 싣는 면을 줄이고, AS가 저장한 record를 권위 있는 요청으로 사용할 수 있습니다. URL 기록·referrer·로그 노출과 브라우저 query를 통한 parameter 변경 위험을 줄이는 것이지, 모든 callback 공격이나 승인 자체를 해결하는 것은 아닙니다.

예를 들어 C1이 T42를 push해 `redirect=https://app.example/cb`, `scope=orders.read`, `state=S9`, `code_challenge=C9`를 저장하고 U7과 `expires_in=90`을 받았다고 하겠습니다. 브라우저가 U7을 제출할 때 AS는 U7이 C1의 record인지 확인하고 저장된 값을 사용합니다. 공격자가 query에 `scope=payments.write`를 덧붙여도 저장 record를 기준으로 처리하면 권한이 넓어지지 않습니다. 반대로 U7을 C2와 함께 보내거나, 만료된 뒤 보내거나, 다른 transaction에 바꾸어 끼우면 client binding·expiry·상태 검사에서 거절해야 합니다.

PAR가 client 등록 redirect 검증, state·PKCE·OIDC nonce, authorization code 일회성을 대신하지는 않습니다. `request_uri`도 추측 불가능한 opaque 값이어야 하고, URL에 남을 수 있으므로 payload를 직접 포함하지 않는 편이 낫습니다. 정확한 수명과 일회 소비는 RFC가 하나의 초 단위 기본값으로 강제하는 영역이 아니며, 승인 화면 새로고침과 저장 TTL 비용을 함께 판단해야 합니다. 정상 push와 authorize 단계의 correlation ID를 두되 request URI·token 원문은 로그에서 최소화합니다.

## 득점 포인트

- front channel의 payload를 AS record와 opaque reference로 바꾸는 신뢰 경계를 설명한다.
- U7, C1, 90초 trace로 query 변조·client mismatch·expiry를 구분한다.
- PAR 이후에도 redirect·state·PKCE·nonce가 필요한 이유를 분리한다.

## 감점 포인트

- PAR만으로 callback CSRF나 code interception이 모두 해결된다고 한다.
- opaque reference를 무기한 재사용해도 안전하다고 단정한다.
- 브라우저 URL에서 parameter 노출이 절대 사라진다고 말한다.

## 더 파고들 거리

- JAR를 PAR endpoint에 push할 때 서명과 저장의 역할은 어떻게 나뉘나요?
- 일회 소비와 승인 화면 새로고침을 함께 설계하려면 무엇을 기록할까요?
