---
id: "http-cookies-samesite"
title: "SameSite 쿠키를 설정하면 CSRF가 모두 막히나요? same-site와 same-origin은 어떻게 다른가요?"
answerMinutes: 5
followups: [{"id": "csrf-vs-xss", "prompt": "브라우저의 요청 위조와 스크립트 실행은 서로 어떤 방어 경계를 요구하나요?"}, {"id": "cors-preflight", "prompt": "브라우저의 교차 출처 허용 검사와 API의 사용자 인가는 왜 별도인가요?"}, {"id": "oauth-oidc-pkce", "prompt": "코드 교환과 callback의 요청·발급자 혼동을 PKCE·state·issuer로 어떻게 나누어 검증하나요?"}]
difficulty: "중하"
category: "보안"
tags: ["HTTP", "보안", "CSRF"]
related: ["csrf-vs-xss", "cors-preflight", "oauth-oidc-pkce"]
---

# SameSite 쿠키를 설정하면 CSRF가 모두 막히나요? same-site와 same-origin은 어떻게 다른가요?

## 구두 답변

SameSite는 사이트 간 요청에서 쿠키 전송을 제한하는 브라우저 정책이고 origin의 scheme·host·port 구분과 같지 않습니다. 같은 사이트의 다른 origin이나 브라우저 동작·요청 유형을 고려해야 합니다.

### 동작 원리와 전제

Strict·Lax·None의 전송 조건을 로그인 흐름과 함께 검증합니다. None은 현대 브라우저에서 Secure 요구와 연결되며 HTTPS 기밀성이 인가를 대신하지 않습니다. Lax의 최상위 탐색 조건 때문에 GET으로 상태를 바꾸는 설계는 위험합니다.

### 선택과 실패 처리

CSRF token과 Origin 검사, 안전한 HTTP 메서드 의미를 조합합니다. HttpOnly는 스크립트의 쿠키 읽기를 줄이지만 XSS가 사용자의 권한으로 요청하는 것을 모두 막지는 않습니다. 쿠키 domain·path를 좁히고 소셜 로그인 callback의 호환을 확인합니다.

### 구체적인 사례와 검증

같은 조직의 하위 도메인이 같은 site에 속할 수 있어 한 하위 도메인의 취약점이 쿠키 정책과 결합하는 경로를 봐야 합니다. origin 검사는 scheme·host·port의 더 좁은 경계를 표현합니다. 소셜 로그인이나 외부 결제에서 돌아오는 navigation은 쿠키 전송 조건에 영향을 받아 정상 흐름도 깨질 수 있으므로 정책 변경 전 실제 브라우저로 검증합니다. 세션 쿠키의 domain을 넓히는 것이 편리해도 불필요한 하위 도메인에 접근 범위를 줄 수 있습니다. Secure·HttpOnly·SameSite가 각각 전송 기밀성·스크립트 읽기·교차 사이트 전송을 다루는 다른 속성임을 설명하겠습니다.

교차 사이트 폼·하위 도메인·리다이렉트·새 탭·브라우저별 정책을 시험합니다. 인증 쿠키가 안 보내져 정상 로그인만 깨지는 오탐도 봅니다. 쿠키 옵션은 공격 경로별로 다른 방어이므로 한 속성을 만능 보안으로 설명하지 않겠습니다.

## 득점 포인트

- 핵심 구분: SameSite는 사이트 간 요청에서 쿠키 전송을 제한하는 브라우저 정책이고 origin의 scheme·host·port 구분과 같지 않습니다.
- 선택 조건: CSRF token과 Origin 검사, 안전한 HTTP 메서드 의미를 조합합니다.
- 검증 기준: 교차 사이트 폼·하위 도메인·리다이렉트·새 탭·브라우저별 정책을 시험합니다.

## 감점 포인트

- same-site가 same-origin과 같고 SameSite만으로 모든 CSRF가 막힌다고 한다.

## 더 파고들 거리

- 브라우저의 요청 위조와 스크립트 실행은 서로 어떤 방어 경계를 요구하나요?
- 브라우저의 교차 출처 허용 검사와 API의 사용자 인가는 왜 별도인가요?
- 코드 교환과 callback의 요청·발급자 혼동을 PKCE·state·issuer로 어떻게 나누어 검증하나요?
