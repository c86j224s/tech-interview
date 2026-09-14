---
id: "account-link-session-binding"
title: "로그인한 계정에 다른 소셜 계정을 연결합니다. 연결 callback을 원래 세션과 브라우저 요청에 어떻게 묶나요?"
difficulty: "중하"
category: "보안"
tags: ["계정 연결","소셜 로그인","소유권","심화 질문"]
related: ["account-linking-proof","oauth-oidc-pkce"]
promotedFrom: {"id":"account-linking-proof","prompt":"계정 연결 요청에 세션·브라우저·CSRF 방어를 어떻게 바인딩할까요?"}
---

# 로그인한 계정에 다른 소셜 계정을 연결합니다. 연결 callback을 원래 세션과 브라우저 요청에 어떻게 묶나요?

## 구두 답변

계정 연결 시작 시 서버가 일회성 transaction을 만들고 현재 로그인 세션·대상 계정·공급자·만료를 묶습니다. callback에서는 state와 코드 교환 검증 뒤에도 원래 사용자 세션과 새 공급자 신원의 소유 증명을 대조해야 합니다.

다른 탭의 callback이나 로그아웃 뒤 돌아온 요청을 원래 승인처럼 처리하지 않습니다. transaction 소비와 연결 고유 제약을 원자적으로 적용하고 재전달에는 기존 결과를 조회합니다. IP 일치는 보조 신호일 뿐 소유 증명이 아닙니다.

## 득점 포인트

- 계정 연결 시작 시 서버가 일회성 transaction을 만들고 현재 로그인 세션·대상 계정·공급자·만료를 묶습니다. callback에서는 state와 코드 교환 검증 뒤에도 원래 사용자 세션과 새 공급자 신원의 소유 증명을 대조해야 합니다.
- IP 일치는 보조 신호일 뿐 소유 증명이 아닙니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 계정 연결 시작 시 서버가 일회성 transaction을 만들고 현재 로그인 세션·대상 계정·공급자·만료를 묶습니다.

## 더 파고들 거리

- [기본 상황과 비교: 서로 다른 소셜 로그인으로 받은 이메일 주소가 같습니다. 기존 서비스 계정에 새 로그인 수단을 자동으로 연결해도 되나요?](/tech-interview/questions/account-linking-proof/)
