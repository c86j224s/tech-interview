---
id: nats-subject-isolation
title: "NATS subject 이름에 tenant와 environment를 넣는 것만으로 메시지가 격리되지 않는 이유와 필요한 인가 설정은 무엇인가요?"
answerMinutes: 5
followups: [{"id":"nats-subject-queue-group","prompt":"같은 subject를 여러 서비스가 받아야 하지만 서비스 내부 인스턴스끼리만 분산해야 한다면 권한과 queue group을 어떻게 조합하나요?"},{"id":"nats-core-jetstream","prompt":"tenant별 subject 권한은 맞지만 소비자가 잠시 내려갔다면 어떤 저장·재전달 정책이 격리와 함께 필요할까요?"},{"id":"authentication-vs-authorization","prompt":"연결 자격은 유효하지만 요청 payload의 tenant가 다를 때 메시지 서비스에서 어떤 주체·자원 검사를 추가하나요?"}]
difficulty: 중하
category: 보안
tags: ["NATS","subject","권한"]
related: ["nats-subject-queue-group","authentication-vs-authorization"]
---

# NATS subject 이름에 tenant와 environment를 넣는 것만으로 메시지가 격리되지 않는 이유와 필요한 인가 설정은 무엇인가요?

## 구두 답변

`tenant-a.prod.orders`처럼 subject 이름에 tenant와 environment를 넣는 것은 메시지 분류와 라우팅 규칙일 뿐 접근 통제가 아닙니다. 클라이언트가 publish나 subscribe 대상에 임의 문자열을 넣을 수 있고 `>` 권한을 갖고 있다면 다른 tenant의 subject도 읽거나 쓸 수 있습니다. 실제 격리는 NATS account·user·connection 자격과 publish/subscribe permission이 wildcard 범위까지 제한할 때 생깁니다. 이름은 경계를 표현하지만 권한이 경계를 강제합니다.

### 명명과 인가를 함께 설계합니다

먼저 subject 계층을 소비자의 필요에 맞춰 정합니다. 특정 서비스가 `tenant-a.prod.orders.created`만 읽어야 한다면 그 subject와 필요한 request-reply inbox만 허용하고, 편의를 위해 `>` 전체를 열지 않겠습니다. `*`와 `>`의 매칭 범위가 다르므로 한 토큰만 필요한 구독과 여러 토큰 하위 트리를 읽는 구독을 분리합니다. publish와 subscribe 권한도 따로 주어야 합니다. 이벤트를 읽을 수 있어도 다른 tenant의 이벤트를 발행할 권한까지 생겨서는 안 됩니다.

다중 테넌트 서버가 사용자 입력으로 subject를 조립한다면 먼저 인증된 주체가 어느 tenant와 environment에 속하는지 검사합니다. 입력 문자열을 그대로 subject prefix로 삼으면 `../` 같은 파일 경로 문제가 아니라도, 허용되지 않은 tenant 이름·wildcard 토큰·예약된 응답 subject로 범위를 탈출할 수 있습니다. 정규화된 내부 tenant ID와 허용된 환경 목록을 사용하고, 서비스가 실제로 subscribe한 목록을 배포 검증에서 확인하겠습니다.

### 연결과 교차 경계를 운영합니다

account 간 import/export나 service gateway를 사용하면 원래 account 경계를 넘는 신뢰 경로가 만들어집니다. 어느 account가 어느 원본 subject를 어떤 방향으로 전달하는지 명시하고, 필요한 이벤트만 좁게 매핑합니다. request-reply의 inbox는 응답을 받을 임시 subject라서 넓은 publish 권한으로 대체하지 않습니다. 응답을 발행할 수 있는 주체와 수명도 제한하고, 사용자가 지정한 reply subject를 그대로 믿지 않겠습니다. payload에 비밀을 넣지 않는 것은 subject 인가와 별도의 최소화 원칙입니다.

자격 회수 후 기존 TCP 연결이 언제 정책을 다시 평가하는지 NATS 배포와 인증 방식의 계약을 확인합니다. 회수했다고 장기 연결이 즉시 모든 구독을 멈춘다고 가정하지 않고, 연결 종료·재인증·정책 전파 지연을 검증합니다. 로그에는 자격 원문 대신 주체, account, subject, publish/subscribe 방향, 허용·거절 결과를 남깁니다.

테스트는 tenant 교차 subscribe와 publish, environment 변경, wildcard 확장, 잘못된 inbox, account export, 회수 직후 장기 연결을 포함합니다. 정상 subject 이름이 보이는지만 확인하지 않고, 악의적인 연결 자격이 실제로 다른 tenant 메시지를 받지 못하며 허용된 메시지는 잃지 않는지까지 확인하는 것이 격리의 기준입니다.

subject 권한을 설계할 때 이름의 토큰 구분 자체도 고정하겠습니다. tenant ID에 점이나 wildcard 문자를 허용하면 의도한 한 토큰이 여러 토큰으로 해석될 수 있으므로 내부 식별자를 별도 인코딩하거나 허용 문자 집합을 제한합니다. 구독 권한이 `tenant-a.>`라면 해당 tenant의 모든 하위 이벤트를 읽는다는 의미이므로 새로 추가된 민감 subject까지 자동으로 노출되는지 검토해야 합니다. 반대로 서비스별 구독을 하나씩 나누면 정책 수가 늘어나는 운영 비용이 생기므로, 권한 템플릿과 정책 변경 테스트를 자동화하겠습니다. 격리의 증거는 설정 파일이 아니라 서로 다른 자격으로 실제 publish·subscribe를 시도했을 때의 broker 결과입니다.

## 득점 포인트

- subject 명명과 broker의 실제 publish/subscribe 인가를 분리한다.
- wildcard·inbox·account import/export를 신뢰 경계로 포함한다.
- 사용자 입력 tenant를 인증 정보와 허용 목록으로 검증한다.
- 장기 연결·자격 회수·교차 tenant 테스트를 제시한다.

## 감점 포인트

- subject에 tenant 이름을 넣으면 자동 격리된다고 말한다.
- 모든 서비스에 `>` publish/subscribe 권한을 준다.
- 사용자 입력을 그대로 subject나 reply inbox로 조립한다.
- 자격 회수 즉시 기존 연결 정책이 바뀐다고 검증 없이 단정한다.

## 더 파고들 거리

- account 간 import/export가 만드는 방향성 신뢰를 어떤 최소 subject로 제한할까요?
- 응답 inbox를 일시 허용할 때 주체·수명·발행 범위를 어떻게 검사할까요?
- 정책 변경 뒤 이미 연결된 subscriber가 새 권한을 적용받는 시점을 어떻게 측정할까요?
