---
id: scheduler-required-preferred-affinity
title: >-
  required affinity와 preferred affinity가 충돌할 때 preferred 점수로 required를 어길 수 없는
  이유는 무엇인가요?
difficulty: 중하
category: 인프라
tags:
  - scheduler
  - taint
  - affinity
related:
  - pvc-nodepool-zone-conflict
---
# required affinity와 preferred affinity가 충돌할 때 preferred 점수로 required를 어길 수 없는 이유는 무엇인가요?

## 구두 답변
required affinity와 preferred affinity는 같은 종류의 점수가 아니라 단계가 다릅니다. `requiredDuringSchedulingIgnoredDuringExecution`은 배치 시 만족해야 하는 hard filter라서 후보 집합을 줄입니다. `preferredDuringSchedulingIgnoredDuringExecution`은 그 filter를 통과한 노드에 weight를 더해 순서를 정하는 soft rule입니다. 따라서 preferred weight가 아무리 커도 required mismatch 노드를 다시 후보로 만들 수 없습니다.

node-a가 `zone=az1`, node-b가 `zone=az2`이고 Pod가 az1 required와 az2 preferred를 가졌다고 하겠습니다. filter 결과는 [node-a]이고, node-b는 preferred 조건을 만족해도 이미 제거되었습니다. 같은 nodeSelectorTerm 안에서 zone=az1과 zone=az2를 동시에 요구하면 AND 조건이라 후보가 없어 Pending입니다. 서로 다른 nodeSelectorTerms에 하나씩 넣으면 OR 조건이므로 두 zone 모두 후보가 될 수 있습니다. 실제 계산에서는 nodeSelectorTerms의 OR 구조, 각 term 내부 matchExpressions의 AND, namespace·topology selector를 펼쳐야 합니다.

공식 affinity 문서의 예처럼 preferred weight는 다른 scheduler priority 함수와 합쳐질 수 있으므로 총점 숫자는 profile을 보지 않고 단정하지 않습니다. 진단은 먼저 required filter 통과 여부를 확인하고 그 다음 남은 노드의 preferred score를 봅니다. `IgnoredDuringExecution`은 실행 후 label 변화가 즉시 eviction된다는 뜻으로 확대하지 말고, 새 배치 조건과 실행 중 동작을 분리합니다.

required 조건을 preferred로 바꾸는 것은 단순히 Pending을 없애는 완화가 아닙니다. az1 hard를 az1 preferred로 바꾸면 az2가 실행 가능해지지만 장애 domain이나 data locality를 포기할 수 있습니다. 변경 전후 후보 집합, preferred 점수, zone별 replica 수를 함께 기록하고, “배치 성공”과 “원래 의도 보존”을 별도 acceptance 기준으로 둡니다.

참고: https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/ (2026-09-19에 읽은 공식 문서 본문; 대상 릴리스와 실제 cluster 실행은 별도 확인)

## 득점 포인트
- filter와 score의 순서를 required·preferred 용어와 함께 설명합니다.
- az1 required·az2 preferred에서 후보 [node-a]가 되는 중간 결과를 제시합니다.
- selector 구조와 scheduler profile 점수의 확인 범위를 구분합니다.

## 감점 포인트
- preferred weight가 높으면 required를 넘어설 수 있다고 합니다.
- 모든 affinity를 soft 선호도로 뭉뚱그립니다.
- score만 보고 required에서 탈락한 노드의 원인을 찾습니다.

## 더 파고들 거리
- required를 preferred로 완화할 때 장애 domain과 가용성을 어떻게 비교할까요?
- preferred 여러 개의 실제 합산과 tie-break를 어떤 로그로 확인할까요?
