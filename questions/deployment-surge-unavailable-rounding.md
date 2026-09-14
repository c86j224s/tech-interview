---
id: "deployment-surge-unavailable-rounding"
title: "replica가 적을 때 maxSurge·maxUnavailable의 백분율은 어떻게 올림·내림되어 실제 용량을 바꾸나요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","Deployment","롤링 업데이트","심화 질문"]
related: ["k8s-rolling-update-capacity","k8s-probe-contract","k8s-pdb-eviction"]
promotedFrom: {"id":"k8s-rolling-update-capacity","prompt":"작은 replica에서 maxSurge와 maxUnavailable 백분율의 올림·내림이 어떤 차이를 만드는지 계산해 보세요."}
---

# replica가 적을 때 maxSurge·maxUnavailable의 백분율은 어떻게 올림·내림되어 실제 용량을 바꾸나요?

## 구두 답변

Deployment의 maxSurge 비율은 일반적으로 올림, maxUnavailable은 내림으로 계산합니다. replica 3에 25%이면 surge 1·unavailable 0이 될 수 있어 작은 수에서 차이가 큽니다.

종료 중 Pod가 실제 자원을 계속 쓰는 순간도 있어 단순 합계가 노드 자원 절대 상한은 아닙니다. readiness·grace·quota·PDB의 역할을 구분하고 실제 rollout 이벤트를 확인합니다.

## 득점 포인트

- Deployment의 maxSurge 비율은 일반적으로 올림, maxUnavailable은 내림으로 계산합니다. replica 3에 25%이면 surge 1·unavailable 0이 될 수 있어 작은 수에서 차이가 큽니다.
- readiness·grace·quota·PDB의 역할을 구분하고 실제 rollout 이벤트를 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Deployment의 maxSurge 비율은 일반적으로 올림, maxUnavailable은 내림으로 계산합니다.

## 더 파고들 거리

- [기본 상황과 비교: Pod 4개를 운영하는 Deployment에서 maxSurge=1, maxUnavailable=1로 업데이트하면 실행 중인 Pod 수와 가용성은 어떻게 달라지나요?](/tech-interview/questions/k8s-rolling-update-capacity/)
