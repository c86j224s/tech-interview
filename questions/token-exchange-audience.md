---
id: token-exchange-audience
title: Token Exchange에서 audience와 scope를 새 서비스에 맞게 왜 좁혀야 하나요?
difficulty: 하
category: 보안
tags:
  - OAuth
  - audience
  - scope
related:
  - oauth-oidc-pkce
---
# Token Exchange에서 audience와 scope를 새 서비스에 맞게 왜 좁혀야 하나요?

## 구두 답변

권한 격리를 목표로 한 서비스 설계에서는 교환 token의 audience와 scope를 실제 downstream에 맞춰 좁히는 것이 기본 선택입니다. 다만 이것이 RFC 8693이 모든 교환에 강제하는 단일 audience 규칙은 아닙니다. RFC는 여러 `resource`·`audience` 요청을 허용하고 scope 의미도 서비스별 계약에 맡기므로, 여러 대상 token을 발급하는 profile은 그 필요성과 격리 비용을 명시해야 합니다.

예를 들어 U의 원래 scope가 `{orders.read, payments.read}`이고 G가 inventory에서 조회한다고 하겠습니다. 이 배포 정책에서 G는 `audience=inventory-api`, `scope=inventory.read`를 요청하고, AS는 U의 승인·G의 actor 권한·inventory 자원 정책을 모두 확인합니다. 결과에 필요 없는 orders·payments 권한을 자동 합집합하지 않는 것은 least privilege 정책의 결과입니다. token을 billing에 보내면 issuer가 같아도 audience 검증에서 거절해야 합니다. 반대로 하나의 업무가 inventory와 pricing을 동시에 호출해야 한다면 별도 token 두 개나 다중 resource profile을 명시적으로 선택할 수 있으며, 그것을 무조건 위반이라고 부를 수는 없습니다.

scope 문자열이 같아 보여도 resource server의 의미가 다를 수 있으므로 AS·RS 계약을 함께 고정합니다. audience·scope가 통과해도 tenant, 주문 소유자, 현재 action은 RS가 다시 검사합니다. exchange 실패 때 넓은 원래 token을 fallback으로 보내면 narrowing 정책을 우회하므로 금지하고, 서비스별 발급 지연·캐시·회수 단위를 운영 비용으로 측정합니다.

## 득점 포인트

- “이 서비스 설계에서는”이라는 정책 범위와 RFC의 다중 resource 허용을 구분한다.
- U/G/inventory trace에서 요청 scope와 발급 scope의 차이를 설명한다.
- audience 통과 뒤 tenant·resource 권한이 남는다고 말한다.

## 감점 포인트

- single audience를 RFC의 보편 의무로 단정한다.
- 원래 scope와 요청 scope를 자동 합집합해도 안전하다고 한다.
- 교환 실패 시 원래 넓은 token을 downstream fallback으로 보낸다.

## 더 파고들 거리

- resource와 audience를 함께 쓸 때 provider profile 차이는 무엇인가요?
- 서비스별 token 발급 지연과 캐시 비용은 어떻게 측정할까요?
