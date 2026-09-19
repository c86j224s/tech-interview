---
id: kubernetes-scheduler-placement
title: Kubernetes scheduler의 taint·toleration·affinity 배치
topic: 인프라
summary: >-
  taint와 toleration의 배제 경계, required filter와 preferred score,
  preemption·topology 제약을 Pending 진단과 함께 설명합니다.
questionIds: []
prerequisites:
  - resource-budget
  - reconciliation
related: []
reviewedAt: '2026-09-19'
---
# Kubernetes scheduler의 taint·toleration·affinity 배치

Kubernetes 배치는 한 노드를 고르는 단일 선호 점수가 아니라, 먼저 실행 가능한 후보를 만들고 그 후보의 순서를 정하는 과정이다. taint와 toleration은 수용 여부, resource request는 용량, required affinity와 topology는 hard 조건, preferred affinity는 soft 점수라는 서로 다른 계약을 갖는다. 이 구분을 잃으면 toleration을 추가했는데도 Pending인 이유를 찾지 못하거나 GPU 전용 노드에 일반 Pod가 들어가는 사고가 생긴다.

## Taint와 toleration

`NoSchedule` taint와 맞는 toleration이 없으면 새 Pod는 노드 후보에서 배제된다. `PreferNoSchedule`은 맞지 않는 Pod를 가능한 한 피하는 soft 효과이고, `NoExecute`는 이미 실행 중인 Pod 유지·퇴거에도 영향을 준다. 여러 taint를 가진 노드는 Pod가 매칭하는 taint를 제거한 뒤 남은 효과를 함께 평가한다.

toleration은 “이 taint가 있어도 나를 배제하지 말라”는 조건이지 해당 노드를 선택하라는 attraction이 아니다. `dedicated=gpu:NoSchedule`을 가진 node-a와 일반 node-b가 있을 때 GPU toleration만 있는 Pod는 둘 다 후보가 된다. GPU 전용 의도라면 `gpu=true` nodeSelector 또는 required node affinity도 필요하다. 반대로 일반 Pod는 toleration이 없어 node-a에 못 들어가지만, toleration을 가진 CPU Pod는 GPU 자원을 경쟁할 수 있다.

## Filter 단계

scheduler는 request를 수용할 allocatable이 있는지, taint가 허용되는지, required node/pod affinity와 volume topology를 만족하는지 먼저 필터한다. 이 교집합이 빈 집합이면 score가 아무리 높아도 bind되지 않는다. `requiredDuringSchedulingIgnoredDuringExecution`은 배치 시 hard 조건이며, 실행 후 label이 변할 때 즉시 퇴거한다는 뜻으로 읽으면 안 된다.

설명용으로 node-a가 `zone=az1`, GPU taint, CPU 여유 2, node-b가 `zone=az2`, CPU 여유 4라고 하자. Pod가 GPU label required, GPU toleration, CPU request 1을 가지면 node-a만 남는다. 여기에 az2 preferred를 넣어도 node-b는 required에서 탈락한다. scheduler plugin 메시지와 정확한 점수는 profile·버전을 확인해야 하며, 여기의 수치는 실행 결과가 아닌 상태 추적이다.

## Score 단계

filter를 통과한 후보에 preferred affinity, topology spread, image locality 같은 plugin 점수가 더해진다. `preferredDuringSchedulingIgnoredDuringExecution`의 weight가 100이어도 required mismatch를 구제하지 않는다. 여러 preferred 규칙의 합산과 다른 plugin의 가중치는 scheduler profile을 봐야 하므로 임의의 총점을 사실처럼 쓰지 않는다.

Pod affinity와 anti-affinity는 다른 Pod의 label, namespace selector, topologyKey를 함께 읽는다. “같은 zone에 app=cache가 있다”는 말만으로는 selector와 topology가 완성되지 않는다. required anti-affinity가 후보를 모두 제거할 수 있고, 작은 클러스터에서는 장애 domain을 분산하려던 규칙이 실행 가능성을 없앨 수 있다.

## Pending 진단

첫 자료는 `FailedScheduling` event지만 한 문장으로 원인을 확정하지 않는다. node의 taint·label·allocatable, Pod의 requests·tolerations·affinity, PVC의 topology를 같은 시점에 가져온다. toleration을 추가한 뒤에도 Pending이면 resource 부족, required mismatch, topology spread, PVC zone, Pod anti-affinity의 교집합을 다시 계산한다.

예를 들어 node-a는 GPU taint이지만 `zone=az2`이고 Pod required는 `zone=az1`, node-b는 zone=az1이지만 CPU 여유가 0이라고 하자. GPU toleration을 추가해도 a는 affinity에서, b는 resource에서 탈락한다. 이때 “taint를 고쳤는데 scheduler가 고장났다”가 아니라 두 hard 조건의 교집합이 공집합인 것이다. 실제 cluster에서는 `kubectl describe pod`, scheduler event, node labels/taints와 allocatable을 함께 확인한다.

## Required와 preferred

required는 후보 집합, preferred는 후보 순서를 만든다. node-a=az1, node-b=az2이고 Pod가 az1 required·az2 preferred라면 b의 preferred가 맞아도 b는 제거되고 a만 남는다. required와 preferred가 서로 반대인 규칙이 모두 hard로 설정되면 후보가 없어 Pending이며, 점수 비교가 시작되지 않는다.

`nodeSelector`와 node affinity를 같이 사용하면 조건이 conjunction으로 좁아질 수 있다. nodeSelectorTerms 내부의 OR/AND 구조, topologyKey, matchExpressions를 펼쳐야 한다. 이미 배치된 Pod의 label 변화에 대한 동작과 새 Pod 스케줄 조건을 분리하여 설명하는 것이 중요하다.

## Preemption 범위

높은 priority Pod가 자원 부족으로 Pending이면 scheduler는 낮은 priority victim을 제거해 용량을 확보할 수 있는지 찾는다. 그러나 victim 제거 뒤에도 taint 불일치, required affinity, PVC volume topology 같은 hard 조건이 남으면 preemption은 해결하지 못한다. 다른 노드의 Pod를 제거해야 zone-wide anti-affinity가 풀리는 cross-node 상황도 표준 preemption의 후보가 아닐 수 있다.

PDB는 hard filter와 다르다. 공식 preemption 문서 기준 scheduler는 PDB 위반을 피하는 victim을 우선 찾지만, 그런 victim이 없으면 PDB가 위반되더라도 preemption이 발생할 수 있는 best-effort 보호다. 따라서 PDB를 “절대 축출 불가”로 기록하면 잘못이다. victim graceful termination 시간과 preemptor가 실제로 bind되기 전의 대기 시간도 비용에 포함한다.

## 전용 노드 패턴

전용 GPU 노드는 일반적으로 taint로 진입을 막고, 대상 Pod에 toleration과 `accelerator=gpu` required affinity를 함께 둔다. resource request에는 device plugin이 실제로 노출한 이름을 써야 한다. label과 toleration만 있고 GPU resource request가 없으면 GPU 사용 Pod라는 의도가 예약량으로 표현되지 않는다. 반대로 request만 있고 affinity가 없으면 다른 GPU 노드로 갈 수 있다.

이 양방향 설계는 “GPU Pod가 GPU 노드를 선호”와 “일반 Pod가 GPU 노드를 점유하지 않음”을 각각 해결한다. toleration만 추가한 실험, toleration+required label, 여기에 GPU request까지 넣은 실험을 분리하여 node 선택과 allocatable 변화를 비교한다.

## Topology와 PVC

zone, hostname, rack을 topologyKey로 쓰는 제약은 서로 다른 후보를 만들 수 있다. required spread를 작은 클러스터에 적용하면 가용 domain이 하나뿐일 때 실행 불가가 된다. PVC가 특정 zone에 묶이면 node label과 volume attach 조건의 교집합을 계산해야 한다. `WaitForFirstConsumer` StorageClass에서는 Pod 배치와 volume provisioning 순서가 상호작용하므로 무작정 nodeSelector를 추가하는 처방은 후보를 없앨 수 있다.

## 검증과 한계

작은 fixture에서 taint만 실패, affinity만 실패, resource만 실패, 자원 부족이 preemption으로 해결되는 경우를 각각 만든다. 각 단계의 event와 후보 노드 수를 기록하고, 하나의 설정만 바꿔 원인을 분리한다. 운영 지표는 Pending age, FailedScheduling reason, nominatedNodeName, victim 수, PDB 위반, topology별 여유를 함께 본다.

이 문서의 노드 상태와 숫자는 설명용이며 실제 scheduler plugin 점수·preemption victim·cluster 실행 결과가 아니다. 대상 Kubernetes 릴리스와 scheduler profile, device plugin, storage driver를 고정하지 않았으므로 통합 시 해당 문서와 설정을 다시 대조해야 한다.

## 참고자료

- https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/ — 2026-09-19 본문에서 NoSchedule/PreferNoSchedule/NoExecute와 toleration matching, attraction이 아님을 확인했다.
- https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/ — required/preferred affinity, filter·score, selector와 topology 조건을 확인했다.
- https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/ — preemption의 자원 범위와 PDB best-effort, cross-node affinity 한계를 확인했다.

```diagram
{"title":"Scheduler 후보 계산","caption":"taint·required·자원으로 후보를 줄인 뒤 preferred가 남은 후보를 정한다.","rows":[[{"id":"pod","label":"Pod 요구","detail":["request·selector"]}],[{"id":"filter","label":"Hard filter","detail":["taint·affinity·topology"]}],[{"id":"score","label":"Soft score","detail":["preferred plugin"]}],[{"id":"bind","label":"Bind","detail":["후보 중 선택"]}]],"edges":[{"from":"pod","to":"filter","label":"제약 교집합"},{"from":"filter","to":"score","label":"가능 후보"},{"from":"score","to":"bind","label":"순위 결정"}]}
```
