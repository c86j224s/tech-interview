---
id: "k8s-topology-spread"
title: "Pod 수는 충분한데 한 영역 장애로 대부분 중단됐습니다. topology spread와 anti-affinity는 어떻게 사용하나요?"
answerMinutes: 5
followups: [{"id": "k8s-rolling-update-capacity", "prompt": "업데이트 중 가용 replica와 실제 순간 자원 사용은 어떻게 계산하나요?"}, {"id": "karpenter-node-provisioning", "prompt": "Pod가 늘었지만 배치 용량이 없을 때 어떤 제약으로 새 노드를 선택하나요?"}, {"id": "consensus-quorum-failure", "prompt": "노드가 살아 있어도 과반과 통신하지 못하면 어떤 확정을 멈춰야 하나요?"}]
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes", "인프라"]
related: ["k8s-rolling-update-capacity", "karpenter-node-provisioning", "consensus-quorum-failure"]
---

# Pod 수는 충분한데 한 영역 장애로 대부분 중단됐습니다. topology spread와 anti-affinity는 어떻게 사용하나요?

## 구두 답변

복제본 수와 독립 장애 영역에 분산됐는지는 다른 조건입니다. 영역·노드 라벨과 분산 제약을 사용해 공통 장애를 줄이되 실제 배치 가능한 용량과 제약 강도를 함께 확인합니다.

### 동작 원리와 전제

topology spread의 skew·selector·topology key가 어떤 Pod 집합을 세는지 확인합니다. anti-affinity는 특정 Pod와 같은 영역에 배치하지 않는 규칙으로 사용할 수 있습니다. 필수 제약을 너무 강하게 주면 새 Pod가 Pending이 될 수 있습니다.

### 선택과 실패 처리

장애 영역 하나가 사라졌을 때 나머지 영역이 용량을 감당하는지도 계산합니다. 평상시 균등 배치가 장애 후 충분한 처리량을 보장하지 않습니다. 스토리지 zone 제약과 spot·on-demand 구성도 함께 봅니다.

### 구체적인 사례와 검증

세 영역에 replica를 하나씩 두어도 각 인스턴스가 평소 80% 부하라면 한 영역을 잃을 때 나머지가 감당하지 못할 수 있습니다. 배치의 독립성과 장애 후 처리 여유를 같이 계산합니다. 새 Pod가 PVC의 zone 제약 때문에 다른 영역으로 못 가는 경우도 있어 compute만 봐서는 안 됩니다. selector가 잘못되면 분산 정책이 다른 Pod 집합을 세거나 아무 대상도 못 셀 수 있으므로 실제 배치와 라벨을 검사합니다. 필수 분산과 가능한 경우 선호의 차이를 정하고 용량 부족 때 Pending으로 남는 것이 맞는지 서비스 정책으로 결정합니다.

영역 손실·노드 부족·rolling update·autoscaling을 시험합니다. 라벨 오설정이나 selector 불일치로 제약이 기대와 다르게 적용되는지 확인합니다. 분산 규칙은 스케줄링 의도이며 서비스 가용성은 준비 상태·용량·복구까지 포함합니다.

## 득점 포인트

- 핵심 구분: 복제본 수와 독립 장애 영역에 분산됐는지는 다른 조건입니다.
- 선택 조건: 장애 영역 하나가 사라졌을 때 나머지 영역이 용량을 감당하는지도 계산합니다.
- 검증 기준: 영역 손실·노드 부족·rolling update·autoscaling을 시험합니다.

## 감점 포인트

- replica 수만 충분하면 장애 영역 배치는 중요하지 않다고 한다.

## 더 파고들 거리

- 업데이트 중 가용 replica와 실제 순간 자원 사용은 어떻게 계산하나요?
- Pod가 늘었지만 배치 용량이 없을 때 어떤 제약으로 새 노드를 선택하나요?
- 노드가 살아 있어도 과반과 통신하지 못하면 어떤 확정을 멈춰야 하나요?
