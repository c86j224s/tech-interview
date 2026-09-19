---
id: scheduler-preemption-nonresource-constraints
title: 우선순위 높은 Pod가 낮은 Pod를 축출하지 못할 때 preemption이 해결하지 못하는 제약은 무엇인가요?
difficulty: 중하
category: 인프라
tags:
  - scheduler
  - taint
  - affinity
related:
  - pvc-nodepool-zone-conflict
---
# 우선순위 높은 Pod가 낮은 Pod를 축출하지 못할 때 preemption이 해결하지 못하는 제약은 무엇인가요?

## 구두 답변
preemption은 낮은 priority Pod를 제거해 CPU·메모리 같은 자원 부족을 완화하는 수단이지 모든 배치 제약을 무시하는 권한이 아닙니다. victim을 제거한 뒤에도 taint toleration 불일치, required affinity, PVC volume topology가 남으면 해당 노드는 여전히 후보가 아닙니다. 다른 노드에 있는 Pod를 없애야 zone-wide anti-affinity가 풀리는 cross-node 상황도 표준 preemption이 해결하지 못할 수 있습니다.

예를 들어 높은 Pod P가 `zone=az1` required인데 az1 노드에는 `dedicated=gpu:NoSchedule`이 있고 P toleration이 없다고 하겠습니다. az1의 낮은 Pod를 모두 축출해 CPU를 비워도 taint mismatch는 바뀌지 않아 P는 Pending입니다. 반대로 taint와 affinity가 맞고 CPU request 2, free CPU 1이라 낮은 Pod 하나를 제거하면 free CPU 3이 되는 경우에는 preemption 후보가 될 수 있습니다. PVC가 az2에 고정되어 있는데 az1만 비우는 것도 volume 조건을 해결하지 않습니다.

PDB는 hard veto와 구분해야 합니다. 읽은 공식 preemption 문서 기준 scheduler는 PDB를 위반하지 않는 victim을 찾으려 하지만 이는 best effort이며, 다른 victim이 없으면 PDB가 위반되어도 낮은 Pod를 제거할 수 있습니다. 진단에서는 FailedScheduling의 자원 압박과 non-resource mismatch, priority, victim, PDB, PVC topology를 따로 기록하고, 축출의 graceful termination 지연까지 비용에 넣습니다.

또한 preemption 후보가 있어도 victim의 graceful termination 동안 preemptor가 즉시 실행된다고 보장하지 않습니다. 낮은 Pod가 종료되는 시간, 더 높은 priority Pod의 끼어들기, PDB violation event를 기록해야 실제 SLO 비용을 계산할 수 있습니다. `preemptionPolicy: Never`인 높은 priority Pod는 우선순위는 높아도 다른 Pod를 제거하지 않으므로 priority와 preemption 권한도 분리해 확인합니다.

참고: https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/ (2026-09-19에 읽은 공식 문서 본문; 대상 릴리스와 실제 cluster 실행은 별도 확인)

## 득점 포인트
- 자원 부족을 완화하는 preemption과 taint·affinity·volume hard 조건을 분리합니다.
- taint가 남는 사례와 자원만 해소되는 사례를 각각 숫자로 추적합니다.
- PDB를 best-effort 보호로 설명하고 hard blocker와 구분합니다.

## 감점 포인트
- 높은 priority면 모든 노드 제약을 무시한다고 합니다.
- 낮은 Pod를 충분히 지우면 항상 배치된다고 말합니다.
- PDB를 절대 축출 불가한 hard filter로 설명합니다.

## 더 파고들 거리
- 자원 부족과 topology 공집합을 실험에서 섞지 않으려면 어떤 fixture가 필요할까요?
- victim 재시작 비용과 서비스 SLO를 어떤 예산으로 평가할까요?
