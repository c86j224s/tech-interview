---
id: authentication
title: 인증·인가와 자격 수명
topic: 보안
summary: 로그인 신원, 자원별 인가, OAuth/OIDC·토큰·회수·복구 경계를 구분합니다.
questionIds: [authentication-vs-authorization, oauth-oidc-pkce, jwt-vs-server-session, refresh-token-rotation, account-linking-proof, mfa-recovery-policy, network-tls-mtls-identity, security-jwt-algorithm-confusion, security-password-reset-token, agent-least-privilege]
---

# 인증·인가와 자격 수명

## 로그인은 모든 자원의 열쇠가 아닙니다

인증은 누가 요청했는지 확인하고 인가는 그 주체가 특정 대상에 어떤 행동을 할 수 있는지 결정합니다. 로그인한 사용자가 주문 ID를 바꿔 다른 사람의 주문을 조회할 때, 로그인 검사는 통과해도 자원 소유권 검사는 거절해야 합니다.

```text
principal = authenticate(request.credentials)
resource = load_target(request.resource_id)
authorize(principal, action, resource, current_policy)
apply_change_with_current_version_condition()
```

요청 본문의 user_id·tenant_id는 주체의 증명이 아닙니다. 신뢰된 인증 문맥에서 범위를 얻어야 합니다. 권한 검사 뒤 소유권이 바뀔 수 있으면 변경 시점의 버전·조건을 함께 검사합니다.

## OAuth/OIDC의 주요 경계

OAuth는 위임된 접근 권한을 다루고 OIDC는 그 위에서 로그인 신원 정보를 다루는 계약을 제공합니다. 이름이 비슷해도 access token과 ID token을 모든 API에서 같은 용도로 받으면 안 됩니다.

- **state**: 원래 요청과 callback을 연결하고 요청 혼동·CSRF를 줄이는 데 사용합니다.
- **PKCE**: 인가 코드 교환을 원래 verifier 보유자와 연결합니다.
- **nonce**: OIDC 인증 요청과 ID token을 연결하는 데 사용합니다.
- **issuer·audience·서명·만료 검증**: 누가 누구를 위해 발급한 자격인지 확인합니다.

어느 하나도 나머지를 대체하지 않습니다. 소셜 계정 연결에는 `(issuer, subject)` 같은 신원 키를 사용하고 이메일 일치만으로 계정을 자동 합치지 않습니다.

## JWT와 서버 세션

JWT의 로컬 서명 검증은 요청마다 중앙 조회를 줄일 수 있지만 즉시 회수·현재 사용자 상태는 별도입니다. 짧은 만료는 회수 지연을 줄일 뿐 즉시 무효화하지 않습니다. 서버 세션도 cache나 replica가 낡으면 회수 지연이 생길 수 있습니다.

토큰의 alg·kid는 신뢰 정책을 선택하는 권한이 아닙니다. 허용 알고리즘·발급자·키 집합은 서버 정책으로 제한합니다. 모르는 kid마다 임의 URL을 조회하거나 무제한 재시도하지 않습니다.

## Refresh 회전과 동시성

회전은 이전 refresh token을 소비하고 새 자격을 발급하는 상태 전이입니다. 여러 탭의 정상 갱신과 탈취 재사용이 같은 모양일 수 있어 client 직렬화·서버 원자 상태·제한된 재전달·재인증 정책을 함께 설계합니다.

응답을 잃었다고 무조건 새 계열을 만들거나 모든 기기를 즉시 회수하는 것은 다른 비용을 만듭니다. 동일 결과를 재전달하려면 원문 토큰을 복원할 안전한 저장이 필요하며 **해시만으로 원문을 되돌릴 수는 없습니다.**

## 가장 약한 복구 경로

MFA·패스키가 강해도 이메일·지원센터가 쉽게 새 자격을 등록해 주면 그 경로가 우회가 됩니다. 재설정 토큰에는 예측 불가능성 외에 대상·용도·만료·단일 소비·안전한 URL 생성이 필요합니다. 복구 직후 민감 변경 제한과 기존 기기 알림을 검토합니다.

mTLS도 서비스 신원을 인증하는 수단이지 최종 사용자·테넌트 인가를 대신하지 않습니다. 에이전트·서비스의 재위임에서 원래 사용자의 권한을 관리자 계정으로 넓히지 않습니다.

## 연습

유효한 다른 사용자 토큰, 잘못된 issuer·audience, 만료·회수 직후 cache hit, 동시 refresh, 재설정 토큰 동시 소비를 시험합니다. 정상 거절과 인프라 장애를 구분하고 로그에 원문 자격을 남기지 않습니다.
