---
id: token-exchange-subject-actor
title: Token Exchange에서 subject token과 actor token은 무엇이 다른가요?
difficulty: 중하
category: 보안
tags:
  - OAuth
  - token exchange
  - 위임
related:
  - authentication-vs-authorization
---
# Token Exchange에서 subject token과 actor token은 무엇이 다른가요?

## 구두 답변

`subject_token`은 새 token이 누구를 대신해 권리를 행사하는지의 입력이고, `actor_token`은 그 권리를 받아 실제 교환을 수행하거나 요청을 대행하는 주체를 나타내는 입력입니다. 사용자 U가 gateway G를 통해 orders API를 호출한다면 U가 subject이고 G가 actor가 될 수 있습니다. G가 U의 token 문자열을 그대로 downstream에 전달하는 것과 달리, AS는 subject·actor·대상·scope를 다시 평가해 새 token을 발급합니다.

요청에는 token-exchange grant type, subject token과 type이 기본으로 들어가고 delegation profile에서는 actor token과 type, `audience` 또는 `resource`, 새 scope가 추가됩니다. 예를 들어 U token의 audience가 gateway이고 G가 orders-api용 token을 요청하면 AS는 G가 U를 대신할 수 있는지, orders.read를 요청할 근거가 있는지 판단합니다. issued token에는 actor가 `act` 같은 구조로 표현될 수 있지만, client가 요청 body에 `act=trusted-admin`을 넣었다고 신뢰하면 안 됩니다. AS가 검증한 actor 자격·client authentication·정책이 신뢰 근거입니다.

subject를 보존하면 downstream이 “누구의 승인 범위인가”를 판단하고, actor를 보존하면 “누가 실제 호출했는가”를 감사·정책에 사용할 수 있습니다. actor를 숨기는 결과는 impersonation처럼 보일 수 있지만, RFC 8693은 모든 제품의 composite claim과 허용 정책을 고정하지 않습니다. 따라서 issuer·audience·scope·expiry를 검증한 뒤 tenant·resource 소유권을 다시 검사하고, actor chain과 로그 보호를 별도 설계해야 합니다.

## 득점 포인트

- subject와 actor의 의미를 U·G 호출 흐름으로 분리한다.
- actor token 입력과 AS가 발급한 `act` 문맥을 임의 문자열과 구별한다.
- 새 token이 audience·scope 정책의 결과이며 downstream 인가가 남는다고 설명한다.

## 감점 포인트

- subject와 actor를 같은 사용자 ID로 합친다.
- gateway가 token을 전달하면 actor가 자동으로 증명된다고 한다.
- `act` claim 문자열만 있으면 actor 권한이 생긴다고 말한다.

## 더 파고들 거리

- 여러 exchange 단계에서 actor chain을 어느 깊이까지 보존할까요?
- impersonation을 허용해야 할 때 어떤 승인이 필요한가요?
