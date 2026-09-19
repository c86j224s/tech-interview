---
id: terraform-state-transaction-boundary
title: Terraform state·plan·apply와 drift·locking
topic: 플랫폼
summary: >-
  Terraform state가 실제 리소스와 구성의 연결을 보존하는 방식, plan의 stale 전제, apply·state
  lock·drift의 운영 경계를 설명합니다.
questionIds: []
prerequisites:
  - gitops-state
  - reconciliation
related: []
reviewedAt: '2026-09-19'
---
# Terraform state·plan·apply와 drift·locking

Terraform은 구성(configuration), state, provider가 읽은 원격 객체를 비교해 plan을 만들고, apply에서 여러 외부 API를 호출합니다. 이 과정은 하나의 데이터베이스 transaction이 아닙니다. state는 구성 주소와 원격 object identity를 연결하고, provider refresh는 현재 관찰을 가져오며, backend lock은 같은 state에 대한 실행 경쟁을 줄입니다. 어느 것도 cloud API 전체의 원자성이나 console 변경의 금지를 보장하지 않습니다.

## State와 object identity

`aws_instance.web` 같은 resource address는 configuration 안의 이름이고, state의 provider ID는 실제 object를 찾기 위한 식별자입니다. state는 remote object의 모든 진실을 담은 권위 DB가 아닙니다. provider가 읽고 표현하는 속성과 권한 범위 안에서만 drift 증거가 생깁니다. state ID가 `i-abc`이고 원격 tag가 `green`, config가 `blue`라면 provider read가 i-abc의 green을 관찰해야 변경을 말할 수 있습니다.

반대로 state 파일을 직접 `i-def`로 바꾸면 원래 object와 새 object의 관리 관계를 훼손할 수 있습니다. import는 실제 object와 resource address를 연결하는 작업이지 desired configuration 일치 증명이 아닙니다. import 후에도 새 plan으로 강제 교체, 누락 속성, provider schema를 검토해야 합니다.

## Refresh와 drift 증거

refresh-only plan은 configuration을 원격에 적용하는 대신 provider가 관찰한 상태를 state와 대조하는 경계를 확인하는 데 유용합니다. 위 예에서 console이 tag를 blue에서 green으로 바꾸고 provider가 이를 읽으면 refresh-only에서는 state 관찰의 변화가, 일반 plan에서는 config blue를 복원하려는 diff가 나타날 수 있습니다. provider read 권한이 없거나 해당 field를 읽지 않으면 “diff 없음”은 drift 없음의 증거가 아닙니다.

증거에는 workspace, backend, resource address, provider ID, API 응답, 권한 오류, plan 시각을 함께 남깁니다. `state show` 출력만 보고 cloud의 현재 값을 단정하지 말고 provider의 실제 read와 원격 API의 object identity를 대조합니다. 다른 controller가 소유한 field인지도 확인한 뒤 config에 반영할지 관리 범위에서 분리할지 결정합니다.

```diagram
{"title":"구성·state·provider 관찰의 경계","caption":"plan은 원하는 값과 이전 연결, provider의 현재 관찰을 비교해 제안하며 외부 API 변경을 하나의 transaction으로 만들지 않습니다.","rows":[[{"id":"config","label":"Configuration","detail":["desired value"]},{"id":"state","label":"State","detail":["address·object ID"]}],[{"id":"refresh","label":"Provider read","detail":["remote observation"]}],[{"id":"plan","label":"Plan","detail":["change proposal"]}],[{"id":"apply","label":"Apply","detail":["external API calls"]}]],"edges":[{"from":"config","to":"plan","label":"원하는 값"},{"from":"state","to":"plan","label":"연결·기준"},{"from":"refresh","to":"plan","label":"현재 관찰"},{"from":"plan","to":"apply","label":"실행 제안"}]}
```

## Saved plan의 시점

saved plan은 생성 순간의 configuration, state, planning options, variables와 provider 관찰을 담은 실행 계획입니다. 파일이 존재한다고 apply 시점의 원격 object가 같다는 보장은 없습니다. plan 뒤 console에서 보안 그룹을 바꾸거나 다른 workspace가 같은 object를 수정하면, 저장된 승인이 현재 상황을 자동으로 합의하지 않습니다.

따라서 plan artifact에 workspace, backend, state lineage, git revision, provider lock file, 생성 시각을 붙입니다. apply 전 수동 변경, state 변경, 권한·provider 조건 변화가 발견되면 기존 plan을 억지로 실행하지 않고 새 refresh와 승인으로 돌아갑니다. plan을 저장한 뒤 apply 사이의 “짧은 수명”은 운영 정책이지 Terraform이 모든 stale 상태를 제거한다는 API 보장이 아닙니다.

## Backend lock과 동시성

같은 backend state에 두 CI가 apply하면 backend locking은 state를 동시에 읽고 갱신하는 실행을 조정합니다. 한 실행이 lock을 가진 동안 다른 실행은 기다리거나 실패할 수 있습니다. 그러나 lock은 다른 workspace의 별도 state, 사람이 console에서 호출한 API, provider 밖의 script를 막지 않습니다. lock을 강제 해제하기 전에는 실행자·CI job·backend 상태를 확인해야 하며, lock 해제 자체가 cloud 변경 복구는 아닙니다.

state lock을 cloud API transaction으로 오해하면 실패 뒤 위험한 재실행을 합니다. lock이 풀렸다는 사실보다 원격 object와 state가 어디까지 일치하는지가 복구의 첫 증거입니다. lock ID, 획득·해제 시각, provider 호출 결과, state write 결과를 함께 보존합니다.

## Apply와 부분 반영

A resource 생성이 성공한 뒤 B에서 권한 오류가 나면 A의 외부 변경은 남을 수 있습니다. process crash나 응답 유실이면 cloud에는 생성됐지만 state에 기록됐는지 모호한 상태가 됩니다. Terraform apply 실패는 이미 반영된 인프라를 자동으로 undo하는 transaction rollback이 아닙니다. 실패한 동일 plan을 즉시 재실행하지 말고 refresh 또는 refresh-only plan으로 object identity를 다시 확인합니다.

예를 들어 subnet 생성 API가 timeout됐다면 이름 검색과 provider 목록 조회로 이미 생성된 ID를 확인합니다. provider의 idempotency와 중복 이름 처리 계약에 따라 state에 import할지, 안전하게 제거할지, 새 plan을 만들지 결정합니다. 적용 후에는 원격 object, state, config 세 층의 diff를 다시 계산합니다.

## Drift와 ownership

긴급 보안 변경을 발견했다고 무조건 config로 덮어쓰면 사고 대응을 지울 수 있고, 반대로 drift를 무시하면 다음 apply가 변경을 되돌릴 수 있습니다. field별 owner와 허용 수동 변경, import 승인, lifecycle 정책을 명시합니다. Argo CD의 ignore와 Terraform provider schema는 비슷해 보이지만 같은 효과가 아닙니다. 화면에서 diff를 숨기는 것과 관리 자체를 바꾸는 것을 구분해야 합니다.

## 복구 절차와 비용

runbook은 backend·workspace·lock 소유자·git revision·provider version 확인, provider read 오류 분리, state ID와 원격 목록 대조, partial apply 표시, 새 plan 검토, import·정리·재실행 선택 순서로 고정합니다. refresh는 원격 API 호출 비용과 plan 시간을 늘리지만 stale state를 놓치는 비용보다 낮을 수 있습니다. workspace 소유권과 shared resource 금지를 조직 정책으로 두지 않으면 backend lock만으로 경쟁을 해결할 수 없습니다.

## 참고자료와 범위

- [Terraform State](https://developer.hashicorp.com/terraform/language/state) — state와 remote object 연결, backend·locking의 범위. 확인일 2026-09-19.
- [terraform plan](https://developer.hashicorp.com/terraform/cli/commands/plan) — refresh-only와 saved plan의 시점 전제. 확인일 2026-09-19.
- [terraform apply](https://developer.hashicorp.com/terraform/cli/commands/apply) — saved plan 실행과 실패 후 partial change 경계. 확인일 2026-09-19.
- [GitOps reconcile 인접 설명](/tech-interview/notes/gitops-state/) — 다른 reconcile 모델과의 구분입니다.

특정 cloud provider와 backend를 실제 실행하지 않았습니다. lock과 refresh의 세부 동작은 대상 Terraform, provider, backend 버전을 통합 전에 고정해야 합니다.
