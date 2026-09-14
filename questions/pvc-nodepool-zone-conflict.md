---
id: "pvc-nodepool-zone-conflict"
title: "PVC 영역과 NodePool 조건이 맞지 않아 Pod가 Pending입니다. scheduler와 NodeClaim의 어느 상태를 확인하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Karpenter","노드","스케줄링","심화 질문"]
related: ["karpenter-node-provisioning","k8s-hpa-scaling","keda-hpa-role"]
promotedFrom: {"id":"karpenter-node-provisioning","prompt":"PVC의 영역 제약과 NodePool 조건이 충돌할 때 scheduler 이벤트와 NodeClaim 상태를 어떻게 읽을까요."}
---

# PVC 영역과 NodePool 조건이 맞지 않아 Pod가 Pending입니다. scheduler와 NodeClaim의 어느 상태를 확인하나요?

## 구두 답변

PVC가 묶인 zone과 Pod·NodePool의 허용 zone·architecture·taint·instance 조건의 교집합을 확인합니다. 노드를 만들 수 있어도 storage attach 조건이 안 맞으면 해결되지 않습니다.

scheduler events·PVC/PV·StorageClass·NodeClaim condition을 함께 읽습니다. 제약을 무조건 풀면 데이터·보안 정책을 어길 수 있습니다. WaitingForFirstConsumer와 이미 bound volume의 차이를 구분합니다.

## 득점 포인트

- PVC가 묶인 zone과 Pod·NodePool의 허용 zone·architecture·taint·instance 조건의 교집합을 확인합니다. 노드를 만들 수 있어도 storage attach 조건이 안 맞으면 해결되지 않습니다.
- WaitingForFirstConsumer와 이미 bound volume의 차이를 구분합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: PVC가 묶인 zone과 Pod·NodePool의 허용 zone·architecture·taint·instance 조건의 교집합을 확인합니다.

## 더 파고들 거리

- [기본 상황과 비교: HPA가 Pod 수를 늘렸지만 배치할 노드 자원이 없어 Pending으로 남았습니다. Karpenter는 무엇을 보고 노드를 만들며 Pod 확장과는 어떻게 연결되나요?](/tech-interview/questions/karpenter-node-provisioning/)
