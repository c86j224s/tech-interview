---
id: nats-authorization
title: NATS Subject 권한과 Account 간 신뢰
topic: 보안
summary: subject 명명과 broker 인가를 분리하고 wildcard·publish/subscribe·inbox·import/export·기존 연결 회수를 설명합니다.
questionIds: [nats-subject-isolation, nats-account-import-export-trust]
---

# NATS Subject 권한과 Account 간 신뢰

## 이름에 테넌트가 있어도 다른 연결이 구독할 수 있습니다

이벤트를 `tenant-a.prod.orders.created`에 보낸다고 합시다. 이름은 잘 분류되어 있지만 다른 테넌트 연결이 넓은 `>` 구독 권한을 가지면 메시지를 받을 수 있습니다. 명명 규칙은 경계를 표현하고, broker의 account·사용자 자격·publish/subscribe 권한이 경계를 강제합니다.

애플리케이션이 사용자의 tenant 문자열을 그대로 subject에 붙이면 이름 생성 단계부터 경계가 흔들릴 수 있습니다. 인증된 주체의 내부 tenant ID와 허용된 환경·이벤트 목록으로 조립하고, 점·wildcard 토큰·예약 응답 이름을 임의로 넣지 못하게 합니다.

## Wildcard와 행동 권한을 별도로 제한합니다

| 요소 | 의미 | 정책 영향 |
| --- | --- | --- |
| `*` | 한 subject 토큰과 매칭 | 한 계층 범위 |
| `>` | 끝 위치에서 하나 이상의 후속 토큰과 매칭 | 새 하위 subject도 포함할 수 있음 |
| publish 허용 | 메시지를 보낼 수 있음 | 이벤트 위조·명령 실행 경계 |
| subscribe 허용 | 메시지를 받을 수 있음 | 데이터 공개 경계 |
| queue group | 구독자 사이 전달 분산 | 테넌트 인가 대체가 아님 |

주문 생성 이벤트를 읽기만 하는 서비스에 모든 주문 명령 publish까지 허용할 이유는 없습니다. `tenant-a.>`를 허용하면 이후 추가되는 민감 이벤트도 자동으로 들어갈 수 있습니다. 정책 템플릿과 새 subject 추가 검토를 연결해 권한이 조용히 넓어지지 않게 합니다.

## Account의 기본 분리와 명시적 연결을 구분합니다

`NATS account`는 서로 다른 subject namespace를 제공하는 기본 격리 경계입니다. 예를 들어 분석 account가 주문 account의 일부 이벤트만 읽어야 하면, 주문 account가 `export`로 공개 범위를 정하고 분석 account가 `import`로 그 범위를 자기 쪽 subject에 들여옵니다. `stream` export와 `service` export는 전달·응답 경로가 다를 수 있으므로 종류와 매핑을 따로 확인해야 하며, 어느 쪽 설정도 양방향 전체 신뢰를 자동으로 만들지는 않습니다.

```diagram
{"title":"교차 account 연결은 필요한 한 방향만 엽니다","caption":"화살표는 예시 이벤트 노출 방향입니다. 실제 설정에서는 stream·service 종류와 원본·로컬 subject 매핑, 허용 account를 확인해야 합니다.","rows":[[{"id":"provider","label":"주문 제공 account","detail":["최소 subject export"]}],[{"id":"mapping","label":"명시적 import 매핑","detail":["제공자·방향·종류 확인"]}],[{"id":"consumer","label":"분석 소비 account","detail":["필요 subject만 subscribe"]}]],"edges":[{"from":"provider","to":"mapping","label":"지정 범위 공개"},{"from":"mapping","to":"consumer","label":"제한된 수신 경로"}]}
```

stream export와 request-reply service export는 전달·응답 경로가 다릅니다. 설정의 원본 subject·로컬 alias·account 제한을 명시하고, 넓은 wildcard를 일괄 허용하지 않습니다. import가 있다고 모든 로컬 사용자에게 필요한 범위만 자동 부여되는 것도 아니므로 연결 자격의 권한을 함께 검사합니다.

## Reply inbox도 권한 범위입니다

request-reply는 요청 subject 외에 응답을 돌려받을 inbox를 사용합니다. 편의를 위해 모든 subject publish를 열면 최소 권한이 무너집니다. 필요한 응답 권한·메시지 수·수명을 제한하는 제품 기능을 확인하고 사용자 입력의 reply subject를 임의 공개 대상으로 신뢰하지 않습니다.

동적 response permission을 쓸 때는, 요청에 필요한 reply subject 하나만 허용하는지 아니면 더 넓은 범위를 여는지 서버 버전과 인증 구성의 계약으로 확인합니다. 정상 응답 한 건에 필요한 권한과 다른 테넌트의 inbox에 무기한 publish하는 권한은 다르므로, 제품 계약을 확인해 지원되는 메시지 수·수명 제한만 적용하고 지원되지 않는 제한을 있다고 가정하지 않습니다. account 경계를 넘는 응답 매핑도 정상 응답과 잘못된 inbox 거절을 함께 시험합니다.

## 자격 회수 뒤 기존 연결을 관찰합니다

자격 파일을 바꿨다고 장기 TCP 연결이 즉시 모든 구독을 멈춘다는 보장은 없습니다. 인증 방식·서버 설정 재적용·JWT claim 전파·연결 종료 정책의 실제 동작을 확인합니다. 새 연결 거절과 기존 subscriber의 마지막 수신 시각을 따로 측정합니다.

감사 로그에는 주체·account·subject·publish 또는 subscribe·허용 결과를 남길 수 있지만 원문 자격과 민감 payload는 최소화합니다. 네트워크 TLS를 사용해도 subject 인가가 없으면 인증된 다른 서비스가 데이터를 읽을 수 있습니다.

## 정상 전달과 교차 경계 거절을 함께 시험합니다

격리된 테스트 broker에 account A·B와 서로 다른 사용자 자격을 두고 같은 subject 문자열을 사용해 기본 분리가 유지되는지 확인합니다. 제한된 export/import를 추가한 뒤 필요한 이벤트만 통과하는지, 역방향·다른 subject·넓은 wildcard·잘못된 inbox는 거절되는지 검사합니다.

라벨이 아니라 broker의 실제 결과를 근거로 삼고 기존 연결에서 정책 회수도 시험합니다. 이 노트는 NATS 권한 모델의 학습 설명이며 실제 broker를 구성해 실행한 검증 결과는 아닙니다.
