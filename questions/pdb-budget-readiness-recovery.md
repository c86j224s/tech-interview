---
id: "pdb-budget-readiness-recovery"
title: "새 Pod가 준비되지 않아 PDB 예산이 회복되지 않습니다. 배치 실패와 readiness 실패를 어떻게 나누나요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","PDB","eviction","심화 질문"]
related: ["k8s-pdb-eviction","graceful-shutdown"]
promotedFrom: {"id":"k8s-pdb-eviction","prompt":"새 Pod가 준비되지 않아 disruptionsAllowed가 회복되지 않을 때 스케줄링과 readiness를 어떻게 분리 진단할까요."}
---

# 새 Pod가 준비되지 않아 PDB 예산이 회복되지 않습니다. 배치 실패와 readiness 실패를 어떻게 나누나요?

## 구두 답변

Pod가 아직 노드에 배치되지 못한 것과 실행됐지만 readiness가 실패한 것을 events·scheduler·container·probe로 나눕니다. PDB budget은 실제 healthy 조건이 회복되어야 늘 수 있습니다.

이미지·quota·zone·DB 초기화·probe 비용을 확인합니다. budget 숫자를 맞추려고 무조건 강제 eviction하지 않고 남은 용량·데이터·사용자 영향을 검토합니다. 자발·강제 중단을 별도로 시험합니다.

## 득점 포인트

- Pod가 아직 노드에 배치되지 못한 것과 실행됐지만 readiness가 실패한 것을 events·scheduler·container·probe로 나눕니다. PDB budget은 실제 healthy 조건이 회복되어야 늘 수 있습니다.
- 자발·강제 중단을 별도로 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Pod가 아직 노드에 배치되지 못한 것과 실행됐지만 readiness가 실패한 것을 events·scheduler·container·probe로 나눕니다.

## 더 파고들 거리

- [기본 상황과 비교: Kubernetes PDB를 설정했는데 노드 장애로 여러 Pod가 중단됐습니다. PDB가 막는 중단과 막지 못하는 중단은 무엇인가요?](/tech-interview/questions/k8s-pdb-eviction/)
