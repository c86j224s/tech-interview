---
id: terraform-state-lock-partial-apply
title: 두 CI가 같은 state에 apply할 때 state locking이 막는 것과 막지 못하는 것은 무엇인가요?
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
# 두 CI가 같은 state에 apply할 때 state locking이 막는 것과 막지 못하는 것은 무엇인가요?

## 구두 답변

backend state locking은 같은 state를 두 CI가 동시에 읽고 갱신하는 경쟁을 줄이지만 cloud API 전체를 all-or-nothing transaction으로 만들지는 않습니다. CI-1이 lock을 보유한 동안 CI-2가 기다리거나 실패할 수 있어 state 기록의 덮어쓰기는 줄어듭니다. 그러나 다른 workspace, console, provider 밖 script가 같은 resource를 바꾸는 일은 각자의 lock 범위 밖입니다.

CI-1이 VPC 생성은 성공시켰지만 state write 전 process가 죽었다고 하겠습니다. lock이 풀린 뒤 CI-2가 같은 plan을 재실행하면 이미 있는 VPC를 또 만들 수 있으므로, 먼저 cloud 목록과 provider ID를 조회하고 refresh-only 또는 새 plan을 만듭니다. A는 성공하고 B에서 권한 오류가 난 partial apply도 A의 변경이 자동 rollback되지 않으므로 import·정리·재계획을 선택합니다. lock ID와 provider 응답, 원격 object, state 기록을 대조하며, lock 해제만 확인한 뒤 재실행하지 않습니다. 부분 적용 뒤에는 resource별 상태를 success/unknown/failed로 나누어 unknown을 재시도 대상으로 바로 넣지 않습니다. API 조회로 identity를 확정한 뒤 import 또는 cleanup을 고르고, state lock 복구와 remote reconciliation을 별도 단계로 기록합니다.

## 득점 포인트

- backend lock과 cloud side effect의 원자성 차이를 설명합니다.
- process crash 뒤 remote/state 대사 후 새 plan을 만드는 순서를 제시합니다.

## 감점 포인트

- lock이 모든 resource의 rollback을 보장한다고 합니다.
- lock 해제만 확인하고 같은 plan을 재실행합니다.

## 더 파고들 거리

- stale lock을 force-unlock하기 전에 어떤 실행자와 backend evidence를 확인하나요?
- 생성 여부가 모호한 object를 import할지 정리할지 어떻게 결정하나요?
