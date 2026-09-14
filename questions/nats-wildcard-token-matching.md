---
id: "nats-wildcard-token-matching"
title: "NATS subject의 *와 >는 어떤 token 범위를 매칭하며 이름 설계의 경계 오류는 어떻게 시험하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["NATS","subject","queue group","심화 질문"]
related: ["nats-subject-queue-group","nats-core-jetstream"]
promotedFrom: {"id":"nats-subject-queue-group","prompt":"wildcard 범위"}
---

# NATS subject의 *와 >는 어떤 token 범위를 매칭하며 이름 설계의 경계 오류는 어떻게 시험하나요?

## 구두 답변

*는 한 token, 끝 위치의 >는 뒤의 하나 이상 token을 매칭하는 규칙을 확인합니다. orders.>가 orders 자체까지 포함한다고 가정하면 누락이나 과도한 권한이 생길 수 있습니다.

빈 token·다국어·구분자 입력·사용자별 prefix를 검증합니다. routing 이름과 보안 권한을 분리하고 실제 publish·subscribe 허용 집합을 작은 표로 시험합니다.

## 득점 포인트

- *는 한 token, 끝 위치의 >는 뒤의 하나 이상 token을 매칭하는 규칙을 확인합니다. orders.>가 orders 자체까지 포함한다고 가정하면 누락이나 과도한 권한이 생길 수 있습니다.
- routing 이름과 보안 권한을 분리하고 실제 publish·subscribe 허용 집합을 작은 표로 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: *는 한 token, 끝 위치의 >는 뒤의 하나 이상 token을 매칭하는 규칙을 확인합니다.

## 더 파고들 거리

- [기본 상황과 비교: 같은 이벤트를 분석 서비스와 알림 서비스가 각각 받아야 하고, 각 서비스 안에서는 인스턴스 하나만 처리해야 합니다. NATS subject와 queue group을 어떻게 구성하나요?](/tech-interview/questions/nats-subject-queue-group/)
