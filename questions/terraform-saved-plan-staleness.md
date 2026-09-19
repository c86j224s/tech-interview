---
id: terraform-saved-plan-staleness
title: saved plan 생성 뒤 다른 운영자가 resource를 바꿨습니다. stale plan 적용을 어떻게 막나요?
difficulty: 중하
category: 인프라
tags:
  - Terraform
  - state
  - plan
  - lock
related:
  - argocd-gitops-reconcile
---
# saved plan 생성 뒤 다른 운영자가 resource를 바꿨습니다. stale plan 적용을 어떻게 막나요?

## 구두 답변

saved plan은 생성 시점의 configuration·state·provider 관찰을 담은 실행 계획입니다. plan 뒤 다른 운영자가 tag나 보안 그룹을 바꿨다면 파일이 있다는 이유로 바로 apply하지 않고 workspace, backend, state lineage, git revision, provider lock 조건과 현재 원격 상태를 다시 확인합니다. state lock은 같은 state의 동시 갱신을 조정할 뿐 console 변경이나 다른 workspace의 같은 object 변경을 막지 않습니다.

예를 들어 plan 시점 tag가 blue였는데 apply 전에 console에서 green이 됐다면 새 plan은 config blue를 유지하기 위해 green→blue diff를 제안합니다. 이것이 긴급 변경을 되돌릴 의도인지, config에 green을 반영할지 승인한 뒤 적용합니다. saved plan의 재검증을 위해 artifact 생성 시각과 state lineage를 보존하고, 수동 변경이나 provider 조건 변화가 발견되면 새 plan을 요구하는 CI gate를 둡니다. Terraform의 실제 cloud 실행은 하지 않았으므로 이 사례는 시점 전제를 보여 주는 설명용 trace입니다. saved plan을 재사용할 수 있는 조건을 state lineage와 configuration digest로 좁힙니다. 어느 하나라도 바뀌면 새 plan이 비용을 내더라도 승인 경계를 다시 만들며, plan artifact 자체를 최신 remote snapshot으로 오해하지 않습니다.

## 득점 포인트

- saved plan의 관찰 시점과 apply 전 재계획 조건을 설명합니다.
- state lock이 console·다른 workspace 변경을 막지 못함을 사례로 보입니다.

## 감점 포인트

- plan 파일이 최신 drift를 자동 반영한다고 합니다.
- lock 획득이 외부 변경 부재의 증거라고 합니다.

## 더 파고들 거리

- plan 승인과 apply 사이 state lineage를 어떤 CI gate로 재검증하나요?
- 긴급 console 변경을 config에 반영할지 되돌릴지 어떤 승인 기준을 쓰나요?
