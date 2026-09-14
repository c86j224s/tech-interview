---
id: "argocd-hpa-field-ownership"
title: "HPA가 바꾸는 replicas를 Argo CD 비교에서 제외합니다. 필요한 소유권 분리와 수동 drift 감지는 어떻게 함께 유지하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Argo CD","GitOps","동기화","심화 질문"]
related: ["argocd-gitops-reconcile","k8s-reconciliation"]
promotedFrom: {"id":"argocd-gitops-reconcile","prompt":"HPA가 관리하는 replicas를 Argo CD diff에서 제외할 때 누락된 수동 변경을 어떻게 보완할지 설명해 보세요."}
---

# HPA가 바꾸는 replicas를 Argo CD 비교에서 제외합니다. 필요한 소유권 분리와 수동 drift 감지는 어떻게 함께 유지하나요?

## 구두 답변

replicas의 권위자를 HPA로 정했다면 Argo CD가 그 필드를 계속 원복하지 않게 설정합니다. diff 제외와 sync 시 해당 차이를 존중하는 동작은 별도 옵션·계약이므로 실제 설정을 확인해야 합니다.

제외 필드는 Argo diff가 수동 변경까지 알려 준다는 보장을 잃을 수 있습니다. HPA 설정·최소 최대 replica·감사 로그로 보완하고 누가 필드를 변경했는지 추적합니다. ignore 범위를 리소스 전체로 넓혀 다른 drift까지 숨기지 않습니다.

## 득점 포인트

- replicas의 권위자를 HPA로 정했다면 Argo CD가 그 필드를 계속 원복하지 않게 설정합니다. diff 제외와 sync 시 해당 차이를 존중하는 동작은 별도 옵션·계약이므로 실제 설정을 확인해야 합니다.
- ignore 범위를 리소스 전체로 넓혀 다른 drift까지 숨기지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: replicas의 권위자를 HPA로 정했다면 Argo CD가 그 필드를 계속 원복하지 않게 설정합니다.

## 더 파고들 거리

- [기본 상황과 비교: Argo CD로 관리하는 Deployment를 운영자가 kubectl로 직접 수정했습니다. Git과 실제 설정이 달라지면 어떻게 감지되며, 어느 쪽 상태가 유지되나요?](/tech-interview/questions/argocd-gitops-reconcile/)
