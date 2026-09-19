---
id: jar-par-composition
title: PAR와 JAR를 함께 쓰면 각각 어떤 신뢰 경계를 맡나요?
difficulty: 중하
category: 보안
tags:
  - OAuth
  - PAR
  - JAR
related:
  - oauth-oidc-pkce
---
# PAR와 JAR를 함께 쓰면 각각 어떤 신뢰 경계를 맡나요?

## 구두 답변

JAR와 PAR는 겹치는 기술이 아니라 서로 다른 경계를 강화합니다. JAR는 request object의 `redirect_uri`, scope, response type, nonce 같은 내용이 등록 client의 키로 만들어졌고 AS를 대상으로 한다는 무결성과 발신자 결합을 맡습니다. PAR는 그 payload를 AS가 백채널로 받아 record로 저장하고, 브라우저에는 `request_uri`라는 참조만 운반하게 해 front-channel 노출·변조 면을 줄입니다. JAR만 쓰면 서명된 내용은 보장해도 URL 운반과 request object fetch 문제가 남고, PAR만 쓰면 AS에 저장되지만 client 서명까지 요구하는지는 구성에 달립니다.

상태를 `J42: iss=C1, aud=AS1, redirect=R1, scope=orders.read, exp=12:01`, `U7 → J42`로 두겠습니다. PAR push에서 client authentication과 JAR 서명을 통과시킨 뒤 U7을 만들고, authorize에서는 U7의 record를 찾아 처리합니다. 브라우저 query에 `scope=payments.write`를 추가해도 JAR Request Object 사용 모드에서는 signed object의 parameter만 사용하고, query client_id가 있으면 C1과 같아야 합니다. 따라서 조합을 설명할 때 “상황에 따라 merge”라고 쓰지 말고 적용 모드와 RFC 9101 규칙을 명시해야 합니다.

둘을 사용해도 state·PKCE·redirect 등록·code 일회성·OIDC nonce는 남습니다. JAR 서명은 callback을 시작한 브라우저를 증명하지 않고, PAR URI는 로그인 결과를 완성하지 않습니다. request URI 수명, record 소비 시점, client policy 변경, replay cache는 AS 운영 계약입니다. 기밀성이 필요하면 JWE를 검토하되, 암호화가 등록 키 검증이나 저장 record 접근 통제를 대신하지 않습니다. 장애 시 원래 query를 fallback으로 허용하면 두 경계를 동시에 우회하므로 명시적 실패가 안전합니다.

## 득점 포인트

- JAR의 서명·client 결합과 PAR의 백채널 저장·참조 운반을 구분한다.
- J42/U7 상태와 외부 scope 변조에서 Request Object-only 규칙을 적용한다.
- state·PKCE·redirect·nonce가 여전히 필요한 이유를 설명한다.

## 감점 포인트

- 두 기술이면 모든 callback 공격이 해결된다고 한다.
- JAR와 PAR를 같은 기능의 중복으로만 설명한다.
- 외부 parameter 충돌을 구현자 임의 merge로 남긴다.

## 더 파고들 거리

- JWE confidentiality와 request URI record 보호는 어떻게 다를까요?
- provider profile의 JAR assembly를 어떤 상호운용 테스트로 확인할까요?
