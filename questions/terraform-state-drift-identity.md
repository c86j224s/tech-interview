---
id: terraform-state-drift-identity
title: >-
  state의 resource ID와 실제 cloud object가 다를 때 drift를 어떤 refresh·provider evidence로
  확인하나요?
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
# state의 resource ID와 실제 cloud object가 다를 때 drift를 어떤 refresh·provider evidence로 확인하나요?

## 구두 답변

먼저 configuration resource address, state의 provider ID, 실제 cloud API가 반환한 object identity를 같은 대상으로 맞춥니다. state의 `i-abc`와 console에서 본 `i-abc`가 같은 object이고 provider read가 tag `green`을 반환해야 drift의 근거가 생깁니다. 그 다음 refresh-only plan으로 state 관찰을 갱신하는 차이와 일반 plan이 config의 `blue`를 복원하려는 diff를 분리합니다. state 파일만 보거나 provider read 권한 오류를 no-drift로 읽으면 안 됩니다.

구체적으로 처음에는 state·remote·config가 모두 `tag=blue`입니다. console에서 remote를 green으로 바꾸고 provider가 이를 읽으면 refresh-only에서 green 관찰이 나타나고 일반 plan은 blue로 되돌릴 변경을 제안할 수 있습니다. 반면 state ID가 `i-def`로 잘못됐거나 provider가 tag field를 읽지 못했다면 같은 결론을 낼 수 없습니다. provider 응답, API 권한·오류, plan 시각과 object ID를 evidence로 보존합니다. import는 identity 연결일 뿐 desired 값 일치나 안전한 update의 증명이 아니므로 import 뒤 새 plan과 강제 교체 여부를 확인합니다. provider read가 성공한 field만 확정적 evidence로 삼고, cloud audit log는 provider schema가 표현하지 않는 변경을 보완하는 자료로 남깁니다. 두 workspace가 같은 ID를 읽으면 어느 state가 owner인지 결정하기 전 자동 apply를 중지합니다.

## 득점 포인트

- address·provider ID·remote identity와 provider read evidence를 연결합니다.
- refresh-only·일반 plan·import의 서로 다른 목적을 설명합니다.

## 감점 포인트

- state만 보고 remote 현재 상태를 단정합니다.
- import 완료가 configuration 일치의 증명이라고 합니다.

## 더 파고들 거리

- provider가 특정 field를 읽지 못할 때 remote evidence를 어떻게 보완하나요?
- 같은 cloud object를 두 workspace가 관리하지 않도록 어떤 ownership 검사를 두나요?
