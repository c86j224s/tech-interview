---
id: "probe-dependency-load-amplification"
title: "모든 Pod의 health probe가 DB 쿼리를 실행합니다. 장애 중 연쇄 부하를 어떻게 줄이고 대체 신호를 고르나요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","probe","헬스 체크","심화 질문"]
related: ["k8s-probe-contract","load-balancer-health-draining"]
promotedFrom: {"id":"k8s-probe-contract","prompt":"비싼 DB 쿼리를 probe에 넣었을 때 발생할 연쇄 부하와 대체 상태 신호를 설명해 보세요."}
---

# 모든 Pod의 health probe가 DB 쿼리를 실행합니다. 장애 중 연쇄 부하를 어떻게 줄이고 대체 신호를 고르나요?

## 구두 답변

probe가 매번 비싼 DB query를 하면 Pod 수와 주기가 하위 부하에 곱해져 장애를 증폭할 수 있습니다. 로컬 진행 상태·가벼운 제한 검사·기능별 readiness를 검토합니다.

DB 장애를 liveness 실패로 연결해 모든 앱을 재시작하면 회복이 더 늦어질 수 있습니다. 검사 비용·timeout·주기·공통 의존 실패를 측정하고 프로세스 생존·트래픽 수용·사용자 성공을 나눕니다.

## 득점 포인트

- probe가 매번 비싼 DB query를 하면 Pod 수와 주기가 하위 부하에 곱해져 장애를 증폭할 수 있습니다. 로컬 진행 상태·가벼운 제한 검사·기능별 readiness를 검토합니다.
- 검사 비용·timeout·주기·공통 의존 실패를 측정하고 프로세스 생존·트래픽 수용·사용자 성공을 나눕니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: probe가 매번 비싼 DB query를 하면 Pod 수와 주기가 하위 부하에 곱해져 장애를 증폭할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 초기화가 오래 걸리는 앱을 Kubernetes가 계속 재시작합니다. startup·readiness·liveness probe를 어떤 역할로 나눠야 하나요?](/tech-interview/questions/k8s-probe-contract/)
