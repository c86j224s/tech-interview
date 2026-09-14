---
id: "identity-issuer-subject-key"
title: "여러 소셜 공급자의 subject를 저장할 때 어떤 복합 고유 키가 필요하며 subject 재사용 문제는 어디까지 막을 수 있나요?"
difficulty: "중하"
category: "보안"
tags: ["계정 연결","소셜 로그인","소유권","심화 질문"]
related: ["account-linking-proof","oauth-oidc-pkce"]
promotedFrom: {"id":"account-linking-proof","prompt":"공급자 subject가 재사용되지 않는다는 전제를 어떤 저장 제약으로 보강할까요?"}
---

# 여러 소셜 공급자의 subject를 저장할 때 어떤 복합 고유 키가 필요하며 subject 재사용 문제는 어디까지 막을 수 있나요?

## 구두 답변

공급자 안에서 유일한 subject는 다른 issuer의 같은 문자열과 구분해야 하므로 보통 issuer와 subject를 함께 외부 신원 키로 사용합니다. 이메일은 변경·공유될 수 있어 기본 연결 키로 대신하지 않습니다.

DB UNIQUE는 동일 조합의 중복 연결을 막지만 공급자가 실제로 subject를 재사용하지 않는다는 외부 약속 자체를 증명하지 못합니다. 공급자 이전·재등록·계정 삭제의 정책과 원본 신원 증거를 확인합니다. 다른 내부 계정에 붙은 신원을 자동으로 옮기지 않습니다.

## 득점 포인트

- 공급자 안에서 유일한 subject는 다른 issuer의 같은 문자열과 구분해야 하므로 보통 issuer와 subject를 함께 외부 신원 키로 사용합니다. 이메일은 변경·공유될 수 있어 기본 연결 키로 대신하지 않습니다.
- 다른 내부 계정에 붙은 신원을 자동으로 옮기지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 공급자 안에서 유일한 subject는 다른 issuer의 같은 문자열과 구분해야 하므로 보통 issuer와 subject를 함께 외부 신원 키로 사용합니다.

## 더 파고들 거리

- [기본 상황과 비교: 서로 다른 소셜 로그인으로 받은 이메일 주소가 같습니다. 기존 서비스 계정에 새 로그인 수단을 자동으로 연결해도 되나요?](/tech-interview/questions/account-linking-proof/)
