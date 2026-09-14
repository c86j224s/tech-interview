---
id: "pdb-selector-target-verification"
title: "PDB가 의도한 Pod를 보호하지 않습니다. selector·namespace·disruptionsAllowed를 어떤 상태와 대조하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","PDB","eviction","심화 질문"]
related: ["k8s-pdb-eviction","graceful-shutdown"]
promotedFrom: {"id":"k8s-pdb-eviction","prompt":"PDB의 selector가 잘못돼 보호 대상이 달라지는 경우를 어떤 명령과 상태로 확인할까요."}
---

# PDB가 의도한 Pod를 보호하지 않습니다. selector·namespace·disruptionsAllowed를 어떤 상태와 대조하나요?

## 구두 답변

PDB의 namespace·selector가 실제 의도한 Pod 집합을 선택하는지 label과 대조합니다. healthy·desiredHealthy·disruptionsAllowed와 deployment readiness를 함께 읽어야 합니다.

정책 객체 존재만으로 보호를 확정하지 않습니다. 잘못된 selector·빈 선택·Pod 교체·unhealthy 상태를 시험합니다. PDB는 Eviction API의 자발적 중단을 다루며 노드 강제 장애를 모두 막지 않습니다.

## 득점 포인트

- PDB의 namespace·selector가 실제 의도한 Pod 집합을 선택하는지 label과 대조합니다. healthy·desiredHealthy·disruptionsAllowed와 deployment readiness를 함께 읽어야 합니다.
- PDB는 Eviction API의 자발적 중단을 다루며 노드 강제 장애를 모두 막지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: PDB의 namespace·selector가 실제 의도한 Pod 집합을 선택하는지 label과 대조합니다.

## 더 파고들 거리

- [기본 상황과 비교: Kubernetes PDB를 설정했는데 노드 장애로 여러 Pod가 중단됐습니다. PDB가 막는 중단과 막지 못하는 중단은 무엇인가요?](/tech-interview/questions/k8s-pdb-eviction/)
