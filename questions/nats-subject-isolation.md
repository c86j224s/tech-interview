---
id: nats-subject-isolation
title: "NATS subject 이름에 tenant와 environment를 넣는 것만으로 메시지가 격리되지 않는 이유와 필요한 인가 설정은 무엇인가요?"
difficulty: 중하
category: 보안
tags: ["NATS","subject","권한"]
related: ["nats-subject-queue-group","authentication-vs-authorization"]
---

# NATS subject 이름에 tenant와 environment를 넣는 것만으로 메시지가 격리되지 않는 이유와 필요한 인가 설정은 무엇인가요?

## 구두 답변

`tenant-a.prod.orders`처럼 subject 이름에 경계를 표시하는 것은 라우팅 규칙일 뿐 접근 통제가 아닙니다. 클라이언트가 publish·subscribe할 subject를 임의로 지정할 수 있다면 이름 규칙만으로 다른 tenant의 데이터를 막을 수 없습니다. NATS account·user·connection 자격과 publish/subscribe permission(발행·구독 권한), wildcard 범위를 함께 설정해 실제 보안 경계를 만들어야 합니다. 이름을 `tenant-a`로 붙였더라도 권한이 `>`로 열려 있으면 다른 테넌트 subject를 읽을 수 있습니다.

서비스별로 필요한 subject만 최소 권한으로 허용하고, `>` 같은 넓은 wildcard(여러 subject를 한 번에 가리키는 패턴)와 request-reply inbox(응답을 받는 임시 subject) 권한을 제한하겠습니다. 범위를 넓게 열면 한 서비스가 다른 테넌트의 메시지까지 구독하는 실패가 생깁니다. 다중 테넌트 서버가 사용자 입력으로 subject를 조립한다면 tenant 소유권과 허용된 환경을 먼저 검증하고, 입력을 그대로 subject 경계로 사용하지 않습니다. account 사이 import/export를 쓴다면 어느 subject가 어떤 신뢰 경계를 넘어가는지 명시합니다.

자격을 교체하거나 회수할 때 이미 연결된 client에 정책이 언제 적용되는지도 확인해야 합니다. 교차 tenant publish·subscribe, wildcard 확장, 잘못된 environment, 권한 회수 후 장기 연결을 시험하고, 로그에는 자격 원문 대신 주체·subject·결과를 남깁니다. 메시지 payload에 비밀을 넣지 않는 것도 subject 권한과 별개의 최소화 원칙입니다.

## 득점 포인트

- subject 네이밍과 실제 인가 경계를 분리한다.
- wildcard·inbox·account import/export를 권한 설계에 포함한다.
- 입력 검증과 자격 회수 시점의 테스트를 제시한다.

## 감점 포인트

- subject에 tenant 이름이 있으면 접근이 자동 차단된다고 말한다.
- 편의를 위해 모든 publish·subscribe wildcard를 허용한다.
- 사용자 입력을 검증 없이 subject로 조립한다.

## 더 파고들 거리

- account 간 import/export가 만들 수 있는 신뢰 경계와 최소 범위는 무엇인가요?
- 응답 subject 권한을 일시 허용할 때 누가·언제·어디까지 발행할 수 있나요?
- 자격 회수가 기존 장기 연결에 반영되는 시점을 어떻게 실험할까요?
