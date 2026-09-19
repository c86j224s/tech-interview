---
id: token-exchange-impersonation-vs-delegation
title: impersonation과 delegation을 어떤 정책 차이로 구분하나요?
difficulty: 중하
category: 보안
tags:
  - OAuth
  - impersonation
  - delegation
related:
  - authentication-vs-authorization
---
# impersonation과 delegation을 어떤 정책 차이로 구분하나요?

## 구두 답변

두 용어의 차이는 actor를 숨기느냐 보존하느냐만이 아니라, downstream 인가와 감사 책임을 어떤 정책으로 정하느냐에 있습니다. delegation은 “subject U가 승인한 권한을 actor S가 대행한다”는 이중 문맥을 유지합니다. impersonation은 downstream이 U의 권한으로만 보도록 만드는 효과가 있어 편리하지만, token 안에 S가 드러나지 않을 수 있습니다. 따라서 actor_token의 존재 여부 하나로 모든 profile을 기계적으로 분류하지 말고 issued token 구성과 AS 정책을 확인해야 합니다.

지원 도구 S가 고객 U의 주문을 조회하는 예를 들면, delegation 정책은 `subject=U`, `actor=S`, `audience=orders-api`, `scope=orders.read`를 발급하고 S가 해당 ticket·tenant·승인 범위에 속하는지 검사합니다. 같은 작업을 impersonation으로 허용하면 orders API는 U처럼 보이는 token을 받을 수 있지만, S의 실행 사실을 token 밖의 보호된 감사 이벤트로 남기고, 허용 역할·짧은 TTL·명시적 승인·즉시 회수 절차를 요구해야 합니다. “관리자라서 어느 사용자나 impersonate”는 기본값이 아니라 별도 고위험 권한입니다.

RFC 8693은 subject·actor 입력과 표현 가능성을 설명하지만 누가 impersonate할 수 있는지, `act`를 어떻게 발급할지는 profile에 남깁니다. 두 방식 모두 issuer·audience·scope·expiry와 실제 resource 소유권을 검사해야 하고, impersonation이라고 사용자 동의 범위를 service account 권한으로 넓혀서는 안 됩니다. 정책 선택의 비용은 delegation의 claim·검증 복잡도와 impersonation의 감사 보완·오남용 회수 부담을 비교해 결정하며, exchange 실패 때 권한이 넓은 일반 token으로 우회하지 않습니다.

## 득점 포인트

- delegation의 subject·actor 이중 문맥과 impersonation의 subject 중심 효과를 구분한다.
- 지원 도구 S와 고객 U의 승인·감사·TTL 상태를 구체적으로 제시한다.
- RFC 의미와 제품 profile의 impersonation 허용 정책을 분리한다.

## 감점 포인트

- 두 용어를 actor_token 유무 하나로만 정의한다.
- service account나 관리자라는 이유만으로 임의 impersonation을 허용한다.
- 최종 사용자만 로그에 남겨도 부인방지가 된다고 말한다.

## 더 파고들 거리

- impersonation actor를 token 밖에 기록할 감사 저장소는 어떻게 보호할까요?
- delegation과 resource-level tenant 정책을 어떤 조건으로 결합할까요?
