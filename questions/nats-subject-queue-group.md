---
id: nats-subject-queue-group
title: "같은 이벤트를 분석 서비스와 알림 서비스가 각각 받아야 하고, 각 서비스 안에서는 인스턴스 하나만 처리해야 합니다. NATS subject와 queue group을 어떻게 구성하나요?"
answerMinutes: 5
followups: [{"id":"nats-core-jetstream","prompt":"오프라인 유실을 허용할 상태와 JetStream이 필요한 이벤트를 어떻게 나누나요?"},{"id":"nats-request-reply","prompt":"같은 subject의 여러 responder에서 queue group은 응답 수를 어떻게 바꾸나요?"},{"id":"nats-subject-isolation","prompt":"tenant 토큰이 있어도 교차 수신되는 권한 실수는 무엇인가요?"}]
difficulty: 하
category: 분산 시스템
tags: ["NATS","subject","queue group"]
related: ["nats-core-jetstream"]
---

# 같은 이벤트를 분석 서비스와 알림 서비스가 각각 받아야 하고, 각 서비스 안에서는 인스턴스 하나만 처리해야 합니다. NATS subject와 queue group을 어떻게 구성하나요?

## 구두 답변

Subject는 메시지를 분류하고 구독 패턴을 정하는 라우팅 이름입니다. 같은 subject의 일반 subscriber는 각각 메시지를 받아 fan-out하고, 같은 queue group의 subscriber는 group 안 한 인스턴스만 받아 작업을 나눕니다. 분석은 `analytics`, 알림은 `notifications`라는 서로 다른 group으로 묶겠습니다.

### fan-out과 내구성

분석 A1·A2가 이벤트를 나누고 알림 N1·N2도 독립적으로 한 번씩 받습니다. group을 공유하면 두 서비스가 이벤트를 빼앗습니다. queue group은 내구성·ACK·exactly once를 제공하지 않습니다. Core NATS는 오프라인 유실, JetStream은 stream·consumer·ACK·retention에 따른 재전달이며 외부 효과는 이벤트 ID로 멱등 처리합니다.

### subject 보안

`tenant.prod.order`는 라우팅 의미만 줄 뿐 보안 경계가 아닙니다. `tenant.>` wildcard를 가진 계정은 다른 tenant를 볼 수 있으므로 publish·subscribe 권한을 함께 제한합니다. `*`는 한 token, `>`는 뒤의 token 범위를 매칭합니다. 인스턴스 변경·권한 오설정·재전달을 시험해 group별 분배와 격리를 확인합니다.

### 분배 단위를 예로 확인합니다

orders.created에 분석 A1·A2가 analytics 그룹, 알림 N1·N2가 notifications 그룹으로 구독했다고 하겠습니다. 한 메시지는 analytics 중 하나와 notifications 중 하나로 전달되어 두 서비스가 각각 처리할 수 있습니다. 네 인스턴스가 같은 그룹이면 전체 중 하나만 받아 분석 또는 알림 중 한 작업이 빠집니다. 일반 구독자도 함께 있다면 그 구독자는 별도로 수신하므로 의도된 fan-out과 버그에 의한 중복을 구분해야 합니다.

queue group은 작업을 현재 연결된 인스턴스에 분배하는 기능이지 계정별 같은 인스턴스 배치나 완료 순서를 보장하는 구조가 아닙니다. 같은 계정 이벤트 A와 B가 다른 워커에서 실행되면 B가 먼저 끝날 수 있습니다. 순서가 필요한 상태 변경은 키별 직렬화나 버전 조건을 별도로 적용합니다. 연결이 끊기기 직전 받은 작업의 외부 효과도 멱등 ID로 추적해야 합니다.

### 와일드카드와 권한

subject의 점으로 나뉜 조각을 token이라고 합니다. `orders.*.created`의 별표는 정확히 한 token을, 마지막에 쓰는 `orders.>`는 그 뒤 하나 이상의 token을 매칭합니다. `orders.>`가 `orders` 자체까지 매칭한다고 가정하지 않습니다. 구독 패턴과 publish 권한·subscribe 권한은 따로 검사하고, 테넌트 ID를 subject에 넣는 것만으로 다른 테넌트 접근이 막히지는 않습니다.

연결 사용자에게 `tenant.>` 같은 광범위 권한을 주면 이름은 분리됐어도 교차 구독이 가능할 수 있습니다. 계정 격리와 export/import 정책, 응답 inbox 권한까지 실제 설정으로 검증합니다. 큰 그룹의 인스턴스 추가·제거 시 수신 분포와 처리 지연을 측정하고, 균등 분배가 정확히 보장된다고 가정하지 않겠습니다.

내구 재처리가 필요하면 JetStream의 stream·consumer·ACK 모델을 추가해야 합니다. Core queue group의 분배와 JetStream consumer의 미확인 상태는 서로 다른 계층입니다. 브로커 선택 후에도 처리 ID·DB 고유 제약과 중복 효과 검사는 애플리케이션에 남습니다.

## 득점 포인트

- fan-out과 group 내부 분산을 대비한다.
- queue group과 내구성·멱등성을 분리한다.
- wildcard 권한을 검증한다.
- group별 수신과 중복을 관측한다.

## 감점 포인트

- 같은 group 모두가 받는다.
- queue가 영구 보관한다.
- subject만으로 보안 경계를 만든다.

## 더 파고들 거리

- wildcard 범위
- tenant 권한
- 의도된 중복
