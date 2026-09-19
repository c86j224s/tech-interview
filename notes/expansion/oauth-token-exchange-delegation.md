---
id: oauth-token-exchange-delegation
title: OAuth Token Exchange의 subject·actor 위임
topic: 보안
summary: RFC 8693의 subject token과 actor token을 구분해 대행 호출의 권한·audience·위임 범위를 설계합니다.
questionIds: []
prerequisites:
  - oauth2-foundations
  - authentication
related:
  - authentication
  - oauth2-foundations
reviewedAt: '2026-09-19'
---
# OAuth Token Exchange의 subject·actor 위임

마이크로서비스 사이에서 사용자 token을 그대로 전달하면 수신 서비스의 audience와 권한이 맞지 않거나, 모든 서비스가 원래 token의 넓은 scope를 재사용하게 됩니다. 반대로 gateway가 자기 service account token만 사용하면 downstream은 실제 사용자의 권한·감사 주체를 잃습니다. OAuth 2.0 Token Exchange는 기존 security token을 입력으로 받아 다른 resource에 맞는 새 token을 발급하는 거래를 표현합니다.

이때 가장 중요한 구분은 **subject**와 **actor**입니다. subject는 발급된 권한이 누구를 대신하는지를 가리키고, actor는 그 권한을 실제로 위임받아 요청을 수행하는 중간 주체입니다. RFC 8693은 `subject_token`, 선택적인 `actor_token`, `audience`·`resource`, `scope`를 교환 입력으로 정의하고, delegation에서는 actor 정보를 `act` 같은 방식으로 표현할 수 있게 합니다. 구체적인 claim 구성과 “어떤 교환을 허용할지”는 AS 정책이 정합니다.

## 원래 token 전달의 한계

사용자 U가 `orders.read payments.read`를 가진 token을 gateway G에 보내고, G가 inventory 서비스 I를 호출한다고 해 보겠습니다. U의 token audience가 주문 API인데 I가 이를 그대로 받아들이면 audience 검증이 약해집니다. scope도 I가 필요로 하는 `inventory.read`와 정확히 맞지 않을 수 있습니다. 이를 해결하려고 G가 자기 token만 보내면 I는 호출 주체를 G로만 보며 U의 승인 범위를 알 수 없습니다.

Token exchange는 G가 U의 token을 검증받고 I용 새 token을 받는 경계입니다. 새 token은 원래 문자열의 복사본이 아니라, AS가 exchange 요청의 subject·actor·수신자·scope 정책을 재평가해 발급하는 결과입니다. AS는 G가 U를 대신해 I를 호출할 수 있는지 판단하고, 허용하지 않는 scope나 audience를 줄일 수 있습니다. 교환 성공이 원래 token의 모든 권한을 downstream에 전파한다는 뜻은 아닙니다.

subject와 actor를 분리하지 않으면 감사 로그에서 “누가 데이터의 권리를 가졌는가”와 “누가 네트워크 호출을 수행했는가”가 합쳐집니다. 사용자 승인 없이 service account가 사용자처럼 보이는 impersonation을 허용하면 책임 추적과 정책 경계가 약해집니다.

## RFC 8693 거래 입력

표준적인 token exchange 요청은 `grant_type=urn:ietf:params:oauth:grant-type:token-exchange`, `subject_token`, `subject_token_type`를 중심으로 구성됩니다. `actor_token`과 `actor_token_type`은 delegation을 표현할 때 추가할 수 있고, `audience` 또는 `resource`는 발급 token의 수신 대상을 좁히는 입력입니다. `scope`는 새 token에서 요청하는 권한이며, AS는 원래 token과 actor 정책을 고려해 승인하거나 축소합니다.

`resource`와 `audience`를 무조건 같은 문자열이라고 단정하지 않습니다. RFC는 relationship을 정의하지만, 실제 profile은 어떤 리소스 식별자를 쓰는지 확인해야 합니다. downstream이 하나라면 `audience=inventory-api`처럼 명시하고, 여러 resource에 동시에 유효한 token을 만들 이유가 없다면 단일 수신자로 제한합니다. scope는 “원래 scope의 교집합”만으로 충분하지 않을 수 있습니다. G가 I를 호출할 수 있는 서비스 정책, 사용자의 tenant, 현재 작업 종류가 함께 판단 대상입니다.

발급 결과는 access token, token type, `expires_in`, 선택적 scope 등을 가질 수 있습니다. opaque token이면 I가 introspection으로 subject·actor·audience·scope를 확인하고, JWT면 신뢰된 issuer의 claim을 검증합니다. 어느 경우든 I는 token이 유효하다는 이유만으로 주문 소유권 같은 resource-level 인가를 생략하지 않습니다.

```diagram
{"title":"사용자 권한을 서비스별 token으로 축소","caption":"gateway는 사용자의 권한을 그대로 복사하지 않고 actor로 식별된 채 inventory audience와 최소 scope의 새 token을 받습니다.","rows":[[{"id":"user","label":"Subject U","detail":["사용자 token","orders·payments 권한"]},{"id":"gateway","label":"Actor G","detail":["현재 호출 서비스","허용된 대행 주체"]}],[{"id":"exchange","label":"Token Exchange","detail":["subject·actor 검증","audience·scope 정책"]}],[{"id":"issued","label":"I용 access token","detail":["audience=inventory","scope=inventory.read"]}],[{"id":"resource","label":"Inventory RS","detail":["U를 대신한 G 호출","자원별 인가 추가"]}]],"edges":[{"from":"user","to":"exchange","label":"subject_token"},{"from":"gateway","to":"exchange","label":"actor_token·client auth"},{"from":"exchange","to":"issued","label":"새 권한 문맥 발급"},{"from":"issued","to":"resource","label":"대상 API 제출"}]}
```

## subject와 actor의 감사 의미

subject는 “이 token이 누구를 대신하여 권리를 행사하는가”입니다. actor는 “그 권리를 가지고 현재 요청을 실행하는 주체는 누구인가”입니다. 예를 들어 사용자가 주문을 조회하도록 승인했고 gateway가 order service를 호출한다면 subject는 U, actor는 G가 됩니다. order service는 민감한 작업에서 두 값을 모두 확인해 “U가 허용한 작업을 G가 대행했는가”를 판단할 수 있습니다.

`act` claim은 actor 정보를 전달하는 대표적 표현이지만, claim이 있다는 사실만으로 actor를 믿으면 안 됩니다. AS가 검증·발급한 token의 서명과 issuer를 확인하고, G가 U를 대신할 수 있는 등록 정책을 확인해야 합니다. client가 임의의 `actor=trusted-admin` 문자열을 request에 넣었다고 해서 권한이 생기지 않습니다. actor token 또는 client authentication과 AS policy가 신뢰 근거입니다.

여러 단계의 체인은 `U ← G ← O`처럼 읽을 수 있습니다. G가 U를 대신하고, O가 G의 결과를 다시 shipping service에 전달한다면 최종 token에 바로 앞 actor만 남길지, 이전 actor chain을 구조적으로 보존할지 profile과 정책을 정해야 합니다. 오래된 중간 주체를 모두 토큰에 넣으면 감사에는 도움이 되지만 토큰 크기·개인정보·검증 비용이 늘어납니다. 반대로 최종 사용자만 남기면 실제 호출자와 승인 경로가 사라집니다.

## audience와 scope 축소

교환된 token을 billing과 inventory 양쪽에서 모두 받게 만들면 한 서비스의 credential 탈취가 다른 서비스로 확장될 수 있습니다. 따라서 실제 호출 대상 audience를 명시하고, 필요한 scope만 신청합니다. 예를 들어 U의 원래 token이 `orders.read payments.refund`를 포함해도, G가 inventory에서 재고를 조회하는 요청에는 `inventory.read`만 요청하고 `payments.refund`를 복제하지 않습니다.

설명용 trace에서 U token의 scope 집합이 `{orders.read, payments.read}`, G가 I에 필요한 scope를 `{inventory.read}`로 요청했다고 하겠습니다. AS 정책이 U의 위임과 G의 서비스 권한을 모두 인정하지 않으면 교환은 실패합니다. 인정하더라도 결과는 `{inventory.read}` 또는 더 좁은 집합이어야 하며, `{orders.read, payments.read, inventory.read}`로 자동 합집합을 만들면 안 됩니다. `audience=inventory`도 token 검증 대상의 하나이며, I가 아닌 billing API에 보내면 거절되어야 합니다.

범위를 좁히면 기능이 깨질 수 있습니다. 하나의 사용자 요청에서 order와 inventory를 동시에 다뤄야 한다면 서비스별로 별도 token을 만들거나, 여러 resource를 허용하는 명시적 profile을 사용해야 합니다. 편의를 이유로 모든 downstream을 audience에 넣는 것은 설계 선택이 아니라 공격 표면 확대입니다. scope 명칭의 의미는 해당 AS와 resource server 계약으로 고정하고, 문자열 이름만 보고 동등하다고 가정하지 않습니다.

## delegation과 impersonation 정책

Delegation은 downstream이 “U를 대신해 G가 수행했다”는 이중 문맥을 볼 수 있게 합니다. 감사·승인 정책은 G가 허용된 actor인지, 작업이 사용자 승인 범위에 있는지, G가 가진 서비스 권한이 추가 범위를 만들지 않는지 판단합니다. Impersonation은 downstream에서 G가 보이지 않거나 U의 권한을 그대로 가진 것처럼 보이는 효과를 만들 수 있습니다. 따라서 support tool이 사용자를 impersonate할 수 있는지, 아니면 support actor로 읽기만 가능한지 별도 정책으로 둬야 합니다.

RFC 8693은 두 형태의 보안 의미를 정책과 구성에 맡깁니다. 표준이 token endpoint 파라미터만 보고 “이것은 항상 delegation”이라고 결정해 주지 않습니다. 어떤 issued token이 composite인지, `act`를 어떻게 넣을지, impersonation을 허용할 actor가 누구인지는 profile별 계약입니다. 구현 문서에서 subject/actor를 한 claim에 문자열로 합치지 말고, downstream의 인가 규칙과 감사 출력 필드를 각각 정합니다.

예를 들어 지원 도구 S가 고객 U의 주문을 조회해야 한다면 delegation 정책은 `subject=U`, `actor=S`, `scope=orders.read`, `audience=orders-api`, ticket 또는 승인 근거를 요구할 수 있습니다. impersonation 정책은 U의 일반 UI와 같은 결과를 줄 수 있지만, 그 경우 감사 로그에 S가 사라지지 않도록 별도 out-of-band 기록이 필요합니다. “관리자라서 어느 사용자나 impersonate”는 업무 규칙이 아니라 보안 영향이 큰 권한이므로 명시적 승인·짧은 수명·감사·회수를 둡니다.

## 연쇄 교환의 검증과 관측

gateway G가 받은 token을 order service O용으로 교환하고, O가 shipping S용 token을 다시 교환하는 경우 각 단계는 독립적인 exchange입니다. O는 자신이 받은 token의 issuer, subject, actor, audience, scope, expiry를 확인하고, S로 넘길 수 있는 actor인지 정책을 적용합니다. O가 client가 제공한 `act`를 그대로 복사해 새 token을 만들면 actor 위조가 가능합니다. 새 token은 AS가 검증한 현재 actor와 허용 chain을 바탕으로 발급해야 합니다.

로그에는 `exchange_id`, 원래 subject 식별자(정책이 허용한 형태), actor 서비스 ID, 요청 audience, 승인 scope, 결과, 거절 이유를 구조화할 수 있습니다. subject가 개인정보일 수 있으므로 원문을 모든 로그에 넣지 말고 내부 식별자·보호된 감사 저장소를 사용합니다. token 원문과 secret은 남기지 않습니다. “최종 API에서 403”만 기록하면 어느 교환 단계에서 범위가 줄었는지 알 수 없으므로 단계별 correlation을 둡니다.

장애 시 fallback도 중요한 경계입니다. token exchange가 일시 실패했다고 원래 사용자 token을 모든 downstream에 다시 보내는 우회는 audience·actor 모델을 무력화합니다. 재시도는 idempotent한 교환 요청 또는 발급 결과의 안전한 캐시 정책으로 좁혀야 하며, 실제 RFC가 재시도 저장을 자동 보장하지는 않습니다. 권한 회수와 token TTL의 관계도 명시합니다. 이미 발급된 짧은 token이 즉시 무효화되는지 여부는 AS/RS 정책에 달려 있습니다.

## 실패 시나리오와 검증 범위

테스트는 먼저 U token을 G가 I audience·최소 scope로 교환하는 정상 경로를 확인합니다. `actor_token`이 없는 요청을 delegation 전용 정책에 넣었을 때 실패해야 하고, G가 허용되지 않은 actor일 때도 거절합니다. U token의 scope를 그대로 복제하려는 요청, audience를 billing으로 바꾸는 요청, client가 가짜 `act` claim을 넣는 요청을 분리해 시험합니다.

연쇄 시험에서는 U→G→O→S 각 token의 subject와 actor가 기대한 chain을 가지는지, O가 S용 token의 audience를 주문 API로 잘못 설정하지 않는지 확인합니다. impersonation이 허용되지 않은 tenant에서 같은 subject를 요청하면 거절되어야 합니다. exchange 후 downstream resource에 접근할 때도 소유자·상태·행동 인가를 별도로 적용합니다.

이 문서의 U/G/O/S와 scope 집합은 설명용 trace이며 실제 AS를 실행한 결과가 아닙니다. 근거는 RFC 8693(2020-01, Proposed Standard) 원문이며, `subject_token`·`actor_token`, resource/audience/scope 관계, `act`·`may_act` 표현의 존재를 확인했습니다. 어떤 claim을 issued token에 넣고, 체인을 몇 단계 보존하며, impersonation을 누구에게 허용할지는 profile-specific policy로 남아 있으므로 특정 제품의 기본 동작처럼 단정하지 않았습니다.

## 참고 자료와 경계

- [RFC 8693: OAuth 2.0 Token Exchange](https://www.rfc-editor.org/rfc/rfc8693.html) — 2020-01, Proposed Standard. subject/actor semantics, audience·resource·scope 관계, `act`·`may_act`를 대조했습니다.
- [OAuth 2.0 권한 위임](/tech-interview/notes/oauth2-foundations/) — access token의 audience·scope·issuer 검증과 resource server 책임을 연결했습니다.
- [인증된 요청의 자원별 권한 검사](/tech-interview/notes/authentication/) — token 검증 뒤 실제 자원·행동 권한을 다시 검사하는 원칙을 연결했습니다.
- actor chain의 보존 형식, impersonation 승인 정책, provider별 claim profile과 TTL은 RFC가 단일 기본값을 정하지 않으므로 배포 전에 별도 결정해야 합니다.
