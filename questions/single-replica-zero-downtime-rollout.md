---
id: "single-replica-zero-downtime-rollout"
title: "replica가 하나인 API를 무중단 교체하려 합니다. 추가 용량·readiness·연결·데이터 호환에는 어떤 전제가 필요한가요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","Deployment","롤링 업데이트","심화 질문"]
related: ["k8s-rolling-update-capacity","k8s-probe-contract","k8s-pdb-eviction"]
promotedFrom: {"id":"k8s-rolling-update-capacity","prompt":"replica가 하나인 서비스에서 무중단 교체를 하려면 자원·readiness·호환성에 어떤 전제가 필요한가요."}
---

# replica가 하나인 API를 무중단 교체하려 합니다. 추가 용량·readiness·연결·데이터 호환에는 어떤 전제가 필요한가요?

## 구두 답변

새 Pod가 준비될 추가 자원과 readiness, 옛·새 코드의 데이터 호환, 기존 연결 drain이 있어야 합니다. maxUnavailable=0만 적었다고 무중단이 자동 보장되지는 않습니다.

새 Pod가 Pending·초기화 실패면 rollout이 진행되지 않을 수 있습니다. session·외부 작업·스토리지 단일 attach 제약을 확인합니다. 실제 사용자 연속 요청과 종료 중 중복·누락을 시험합니다.

## 득점 포인트

- 새 Pod가 준비될 추가 자원과 readiness, 옛·새 코드의 데이터 호환, 기존 연결 drain이 있어야 합니다. maxUnavailable=0만 적었다고 무중단이 자동 보장되지는 않습니다.
- 실제 사용자 연속 요청과 종료 중 중복·누락을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 새 Pod가 준비될 추가 자원과 readiness, 옛·새 코드의 데이터 호환, 기존 연결 drain이 있어야 합니다.

## 더 파고들 거리

- [기본 상황과 비교: Pod 4개를 운영하는 Deployment에서 maxSurge=1, maxUnavailable=1로 업데이트하면 실행 중인 Pod 수와 가용성은 어떻게 달라지나요?](/tech-interview/questions/k8s-rolling-update-capacity/)
