---
id: "gitops-pvc-prune-preflight"
title: "Git에서 PVC를 제거하기 전에 reclaimPolicy·백업·스냅샷·실제 참조를 어떤 순서로 확인해야 하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Argo CD","prune","롤백","심화 질문"]
related: ["argocd-prune-rollback","feature-flag-rollout","argocd-gitops-reconcile"]
promotedFrom: {"id":"argocd-prune-rollback","prompt":"PVC prune 전에 reclaimPolicy와 스토리지 스냅샷을 어떤 순서로 확인해야 할까요."}
---

# Git에서 PVC를 제거하기 전에 reclaimPolicy·백업·스냅샷·실제 참조를 어떤 순서로 확인해야 하나요?

## 구두 답변

먼저 PVC를 참조하는 Pod와 데이터 보존 요구를 확인하고 PV의 reclaimPolicy와 provisioner 삭제 동작을 읽습니다. 그 뒤 복구 가능한 백업·snapshot을 만들고 별도 복원으로 검증해야 합니다.

snapshot 객체 생성 성공만으로 DB 일관성이나 키·설정 복구를 확정하지 않습니다. Delete 정책이면 PVC 제거가 backend 볼륨 삭제로 이어질 수 있습니다. prune 대상과 의존 자원·Git 재적용을 검토하고, 삭제 후 Git revert가 데이터를 복원한다고 가정하지 않습니다.

## 득점 포인트

- 먼저 PVC를 참조하는 Pod와 데이터 보존 요구를 확인하고 PV의 reclaimPolicy와 provisioner 삭제 동작을 읽습니다. 그 뒤 복구 가능한 백업·snapshot을 만들고 별도 복원으로 검증해야 합니다.
- prune 대상과 의존 자원·Git 재적용을 검토하고, 삭제 후 Git revert가 데이터를 복원한다고 가정하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 먼저 PVC를 참조하는 Pod와 데이터 보존 요구를 확인하고 PV의 reclaimPolicy와 provisioner 삭제 동작을 읽습니다.

## 더 파고들 거리

- [기본 상황과 비교: Git에서 리소스 정의를 삭제한 뒤 Argo CD로 동기화하려 합니다. 클러스터에서 무엇이 삭제될 수 있고, 문제가 생겨 Git을 되돌리면 어디까지 복구되나요?](/tech-interview/questions/argocd-prune-rollback/)
