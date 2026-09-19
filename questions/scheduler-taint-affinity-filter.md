---
id: scheduler-taint-affinity-filter
title: NoSchedule taint와 맞지 않는 toleration 때문에 Pending인지 affinity 때문인지 어떤 증거로 구분하나요?
difficulty: 중하
category: 인프라
tags:
  - scheduler
  - taint
  - affinity
related:
  - pvc-nodepool-zone-conflict
---
# NoSchedule taint와 맞지 않는 toleration 때문에 Pending인지 affinity 때문인지 어떤 증거로 구분하나요?

## 구두 답변
Pending 원인은 `FailedScheduling` event 한 줄보다 Pod 요구와 각 노드의 현재 상태를 같은 시점에 교집합으로 계산해 구분합니다. `NoSchedule` taint에 맞는 toleration이 없으면 그 노드는 filter에서 탈락합니다. 그러나 toleration을 추가해도 required affinity, resource request, PVC topology가 남아 있으면 후보 집합은 여전히 비어 있을 수 있습니다. toleration은 노드를 선호하게 만드는 옵션이 아니라 taint에 의한 배제를 완화하는 조건입니다.

설명용 상태로 node-a는 `dedicated=gpu:NoSchedule`, `zone=az2`, CPU 여유 2이고 node-b는 taint 없음, `zone=az1`, CPU 여유 0이라고 하겠습니다. Pod가 CPU request 1, `zone=az1` required, GPU toleration 없음이면 a는 taint와 affinity에서, b는 resource에서 탈락합니다. GPU toleration을 추가해도 a는 zone mismatch이고 b는 CPU 부족이어서 Pending입니다. 따라서 “taint만 고쳤는데도 고장”이 아니라 hard 조건의 교집합이 공집합입니다.

진단 순서는 event의 후보별 이유를 저장하고, node taints/labels/allocatable, Pod requests·affinity·tolerations, PVC topology를 비교하는 것입니다. 한 번에 여러 설정을 풀지 말고 toleration, resource, affinity를 하나씩 바꿔 후보 수 변화를 기록합니다. 실제 scheduler profile 메시지와 버전별 plugin 세부는 cluster에서 확인해야 하며 위 숫자는 실행 결과가 아닌 trace입니다.

필터 원인은 노드 수의 합계가 아니라 각 plugin이 제거한 후보의 교집합으로 기록하는 것이 좋습니다. 예시에서는 toleration을 넣어도 a의 affinity와 b의 CPU 조건이 남아 후보 0개입니다. 실제 진단에서 event가 여러 이유를 한 문장에 합치면 taint 완화 전후의 후보 수와 labels/requests diff를 저장해 어떤 제약이 마지막으로 남았는지 확인합니다.

참고: https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/ (2026-09-19에 읽은 공식 문서 본문; 대상 릴리스와 실제 cluster 실행은 별도 확인)

## 득점 포인트
- taint mismatch와 affinity/resource mismatch를 같은 후보 계산에서 분리합니다.
- node-a/node-b의 zone·taint·CPU 수치를 따라가며 toleration 추가 후에도 공집합인 이유를 보입니다.
- event와 노드/Pod/PVC 상태를 함께 수집하는 진단 절차를 제시합니다.

## 감점 포인트
- toleration만 있으면 해당 노드로 간다고 합니다.
- Pending event 한 줄을 전체 원인으로 확정합니다.
- 노드 수가 많으면 required affinity mismatch가 자동 해소된다고 말합니다.

## 더 파고들 거리
- required 조건은 맞지만 preferred 점수만 낮을 때 event를 어떻게 읽을까요?
- resource 부족과 non-resource filter를 fixture에서 어떻게 분리할까요?
