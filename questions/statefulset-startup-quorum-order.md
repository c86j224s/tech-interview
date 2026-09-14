---
id: "statefulset-startup-quorum-order"
title: "상태 저장 클러스터의 Pod를 순차 또는 병렬 시작합니다. readiness가 quorum을 기다리면 어떤 교착이 생길 수 있나요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","Pod","Deployment","StatefulSet","심화 질문"]
related: ["k8s-pod-deployment-statefulset","k8s-reconciliation"]
promotedFrom: {"id":"k8s-pod-deployment-statefulset","prompt":"순차 시작과 병렬 시작이 데이터 서비스의 quorum·복구 시간에 미치는 영향을 비교해 보세요."}
---

# 상태 저장 클러스터의 Pod를 순차 또는 병렬 시작합니다. readiness가 quorum을 기다리면 어떤 교착이 생길 수 있나요?

## 구두 답변

순차 시작에서 첫 Pod readiness가 과반을 기다리는데 후속 Pod는 첫 Pod readiness 뒤에만 시작하면 부트스트랩이 막힐 수 있습니다. 서비스 발견·시작·준비 조건을 분리해야 합니다.

Parallel 정책이나 별도 bootstrap 상태를 검토하되 데이터 일관성과 복구 순서를 지킵니다. 안정 DNS가 투표 권한을 뜻하지 않습니다. 초기 생성·전체 재시작·일부 장애를 실제 quorum 조건으로 시험합니다.

## 득점 포인트

- 순차 시작에서 첫 Pod readiness가 과반을 기다리는데 후속 Pod는 첫 Pod readiness 뒤에만 시작하면 부트스트랩이 막힐 수 있습니다. 서비스 발견·시작·준비 조건을 분리해야 합니다.
- 초기 생성·전체 재시작·일부 장애를 실제 quorum 조건으로 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 순차 시작에서 첫 Pod readiness가 과반을 기다리는데 후속 Pod는 첫 Pod readiness 뒤에만 시작하면 부트스트랩이 막힐 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Kubernetes에서 API 서버와 고정 식별자·디스크가 필요한 저장 서버를 배포합니다. Pod, Deployment, StatefulSet은 어떤 역할이 다른가요?](/tech-interview/questions/k8s-pod-deployment-statefulset/)
