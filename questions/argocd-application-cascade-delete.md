---
id: "argocd-application-cascade-delete"
title: "Argo CD Application 삭제와 개별 리소스 prune은 삭제 대상과 finalizer에서 어떻게 다른가요?"
difficulty: "중하"
category: "인프라"
tags: ["Argo CD","prune","롤백","심화 질문"]
related: ["argocd-prune-rollback","feature-flag-rollout","argocd-gitops-reconcile"]
promotedFrom: {"id":"argocd-prune-rollback","prompt":"Application 삭제와 개별 리소스 prune에서 cascade가 만드는 영향 범위를 어떻게 검증할까요."}
---

# Argo CD Application 삭제와 개별 리소스 prune은 삭제 대상과 finalizer에서 어떻게 다른가요?

## 구두 답변

Application 삭제의 cascade는 finalizer·리소스 추적·삭제 옵션에 따라 관리 리소스 정리를 유발할 수 있습니다. 개별 prune은 Git에서 빠진 추적 리소스를 동기화 과정에서 제거하는 것으로 대상과 계기가 다릅니다.

PVC·외부 controller·owner reference가 추가 삭제를 일으킬 수 있어 단일 객체만 보지 않습니다. finalizer를 강제로 지우면 외부 자원이 남을 수 있습니다. 삭제 전 실제 추적 집합과 보관 정책을 확인하고 Git revert가 데이터를 되살리지 못한다는 점을 명시합니다.

## 득점 포인트

- Application 삭제의 cascade는 finalizer·리소스 추적·삭제 옵션에 따라 관리 리소스 정리를 유발할 수 있습니다. 개별 prune은 Git에서 빠진 추적 리소스를 동기화 과정에서 제거하는 것으로 대상과 계기가 다릅니다.
- 삭제 전 실제 추적 집합과 보관 정책을 확인하고 Git revert가 데이터를 되살리지 못한다는 점을 명시합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Application 삭제의 cascade는 finalizer·리소스 추적·삭제 옵션에 따라 관리 리소스 정리를 유발할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Git에서 리소스 정의를 삭제한 뒤 Argo CD로 동기화하려 합니다. 클러스터에서 무엇이 삭제될 수 있고, 문제가 생겨 Git을 되돌리면 어디까지 복구되나요?](/tech-interview/questions/argocd-prune-rollback/)
