---
id: "argocd-source-error-vs-health"
title: "Argo CD가 Git을 읽지 못하는 경우와 Git 선언이 잘못된 경우를 Sync·Health·현재 Pod 상태로 어떻게 구분하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Argo CD","GitOps","동기화","심화 질문"]
related: ["argocd-gitops-reconcile","k8s-reconciliation"]
promotedFrom: {"id":"argocd-gitops-reconcile","prompt":"Git 저장소 접근 장애와 잘못된 Git 선언을 Health·Sync·실행 중 Pod 상태로 어떻게 구분할까요."}
---

# Argo CD가 Git을 읽지 못하는 경우와 Git 선언이 잘못된 경우를 Sync·Health·현재 Pod 상태로 어떻게 구분하나요?

## 구두 답변

Git 조회 오류는 원하는 선언을 새로 얻지 못한 상태이며 현재 Pod가 즉시 중단됐다는 뜻은 아닙니다. 잘못된 선언은 조회는 성공해도 적용·health·rollout에서 실패할 수 있어 상태 축을 나눕니다.

마지막으로 관찰·동기화한 revision, 비교 오류, sync operation, 리소스 condition과 실제 readiness를 대조합니다. Healthy와 Synced도 같은 상태가 아닙니다. 저장소 복구 후 오래된 선언을 무심코 재적용하지 않고 현재 의도와 변경 이력을 확인합니다.

## 득점 포인트

- Git 조회 오류는 원하는 선언을 새로 얻지 못한 상태이며 현재 Pod가 즉시 중단됐다는 뜻은 아닙니다. 잘못된 선언은 조회는 성공해도 적용·health·rollout에서 실패할 수 있어 상태 축을 나눕니다.
- 저장소 복구 후 오래된 선언을 무심코 재적용하지 않고 현재 의도와 변경 이력을 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Git 조회 오류는 원하는 선언을 새로 얻지 못한 상태이며 현재 Pod가 즉시 중단됐다는 뜻은 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: Argo CD로 관리하는 Deployment를 운영자가 kubectl로 직접 수정했습니다. Git과 실제 설정이 달라지면 어떻게 감지되며, 어느 쪽 상태가 유지되나요?](/tech-interview/questions/argocd-gitops-reconcile/)
