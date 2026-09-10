---
id: nats-subject-queue-group
title: "같은 이벤트를 분석 서비스와 알림 서비스가 각각 받아야 하고, 각 서비스 안에서는 인스턴스 하나만 처리해야 합니다. NATS subject와 queue group을 어떻게 구성하나요?"
difficulty: 하
category: 분산 시스템
tags: ["NATS","subject","queue group"]
related: ["nats-core-jetstream"]
---

# 같은 이벤트를 분석 서비스와 알림 서비스가 각각 받아야 하고, 각 서비스 안에서는 인스턴스 하나만 처리해야 합니다. NATS subject와 queue group을 어떻게 구성하나요?

## 구두 답변

Subject는 메시지를 분류하고 구독 패턴을 결정하는 라우팅 이름입니다. 같은 subject를 일반 구독한 여러 subscriber는 각각 메시지를 받으므로 분석 서비스와 알림 서비스에 fan-out할 수 있습니다. 같은 queue group에 속한 subscriber들은 그 group 안에서 한 subscriber가 메시지를 처리하도록 분산할 수 있어, 여러 알림 인스턴스가 하나의 작업을 나눠 맡는 모델에 적합합니다. 이 상황에서는 같은 subject를 구독하되 분석 인스턴스끼리는 analytics 그룹, 알림 인스턴스끼리는 notifications 그룹으로 묶겠습니다. 그러면 각 그룹에 메시지가 전달되고 그룹 안에서는 한 인스턴스가 선택됩니다.

queue group은 같은 작업을 나눠 받게 하는 묶음일 뿐 내구성이나 정확히 한 번 처리를 자동 제공하지 않습니다. Core NATS인지 JetStream인지, ACK(처리 완료 확인)·재전달·consumer state(소비 위치 기록)를 어떻게 구성했는지에 따라 실패 후 결과가 달라집니다. Core NATS의 구독자가 끊기면 놓친 메시지가 되지만, 저장 기능을 켠 JetStream은 설정에 따라 다시 받을 수 있습니다. subject wildcard(여러 subject를 한 번에 가리키는 패턴)는 편리하지만 `tenant.>`처럼 넓게 구독하면 의도하지 않은 환경·테넌트 데이터가 유입될 수 있습니다. 필요한 토큰만 구독하도록 subject 계층과 권한을 함께 설계하고, 실제 계정의 구독 목록으로 교차 테넌트 수신을 시험합니다.

실제 배포에서 group 이름·인스턴스 수·권한·구독 패턴을 확인하고, 인스턴스 추가·제거에서 예상한 fan-out과 분산이 나오는지 시험합니다. 같은 이벤트를 여러 group이 각각 소비한다면 중복 효과가 의도된 것인지, 각 consumer가 독립 처리 기록과 멱등 키를 갖는지 확인합니다. 라우팅 이름은 문자열이 아니라 소비자 소유권과 데이터 격리의 계약입니다.

## 득점 포인트

- fan-out과 queue group 내부 분산을 사례로 대비한다.
- queue group과 내구성·멱등성을 분리한다.
- wildcard·group 이름·다중 group별 처리 결과를 검증한다.

## 감점 포인트

- 같은 queue group의 모든 subscriber가 같은 메시지를 각각 받는다고 말한다.
- queue group이면 실패 메시지가 영구 보관된다고 말한다.
- 넓은 wildcard를 권한 없는 보안 경계로 사용한다.

## 더 파고들 거리

- NATS subject의 `*`와 `>`가 매칭하는 토큰 범위는 어떻게 다른가요?
- tenant별 subject 권한을 서비스 계정별로 어디까지 제한할까요?
- 같은 이벤트를 여러 group이 소비할 때 의도된 중복과 버그를 어떤 ID로 구분할까요?
