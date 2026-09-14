---
id: "oidc-nonce-state-binding"
title: "OIDC의 nonce와 OAuth state는 각각 어떤 응답·세션에 묶이며 서로를 대체할 수 있나요?"
difficulty: "중하"
category: "보안"
tags: ["OAuth","OIDC","PKCE","state","심화 질문"]
related: ["oauth-oidc-pkce","authentication-vs-authorization"]
promotedFrom: {"id":"oauth-oidc-pkce","prompt":"nonce와 state가 각각 어느 세션·자격에 묶여야 하는지 비교해 보세요."}
---

# OIDC의 nonce와 OAuth state는 각각 어떤 응답·세션에 묶이며 서로를 대체할 수 있나요?

## 구두 답변

state는 요청과 callback의 연결·CSRF 방어에 사용되고 nonce는 OIDC ID token을 해당 인증 요청과 연결해 재생·혼동을 줄이는 역할입니다. PKCE·issuer·audience 검증과 서로 대체하지 않습니다.

서버가 발급한 일회성 transaction에 값·사용자 세션·기한을 묶고 callback에서 소비합니다. token의 nonce와 원래 값을 검증하며 다중 IdP·탭·응답 유실을 시험합니다.

## 득점 포인트

- state는 요청과 callback의 연결·CSRF 방어에 사용되고 nonce는 OIDC ID token을 해당 인증 요청과 연결해 재생·혼동을 줄이는 역할입니다. PKCE·issuer·audience 검증과 서로 대체하지 않습니다.
- token의 nonce와 원래 값을 검증하며 다중 IdP·탭·응답 유실을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: state는 요청과 callback의 연결·CSRF 방어에 사용되고 nonce는 OIDC ID token을 해당 인증 요청과 연결해 재생·혼동을 줄이는 역할입니다.

## 더 파고들 거리

- [기본 상황과 비교: OAuth/OIDC 로그인에서 PKCE와 state는 콜백 흐름의 어떤 공격·혼동을 각각 줄이며, 둘만으로 검증이 끝나지 않는 이유는 무엇인가요?](/tech-interview/questions/oauth-oidc-pkce/)
