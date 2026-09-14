---
id: "daemonset-node-capacity-overhead"
title: "새 노드에 DaemonSet도 실행됩니다. requests와 시스템 여유를 인스턴스 선택에 어떻게 반영하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Karpenter","노드","스케줄링","심화 질문"]
related: ["karpenter-node-provisioning","k8s-hpa-scaling","keda-hpa-role"]
promotedFrom: {"id":"karpenter-node-provisioning","prompt":"DaemonSet requests가 노드의 실제 가용 용량과 인스턴스 선택에 어떻게 반영되는지 설명해 보세요."}
---

# 새 노드에 DaemonSet도 실행됩니다. requests와 시스템 여유를 인스턴스 선택에 어떻게 반영하나요?

## 구두 답변

새 노드의 총 자원에서 system·kube reserved와 배치될 DaemonSet requests를 제외한 여유를 봅니다. 앱 Pod 요청만 더하면 예상한 인스턴스에 실제로 안 들어갈 수 있습니다.

DaemonSet selector·taint·architecture가 어떤 노드에 적용되는지 확인합니다. GPU·Pod 수·네트워크·스토리지 한도도 고려합니다. 실제 node allocatable·scheduled Pod·NodeClaim 조건을 대조합니다.

## 득점 포인트

- 새 노드의 총 자원에서 system·kube reserved와 배치될 DaemonSet requests를 제외한 여유를 봅니다. 앱 Pod 요청만 더하면 예상한 인스턴스에 실제로 안 들어갈 수 있습니다.
- 실제 node allocatable·scheduled Pod·NodeClaim 조건을 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 새 노드의 총 자원에서 system·kube reserved와 배치될 DaemonSet requests를 제외한 여유를 봅니다.

## 더 파고들 거리

- [기본 상황과 비교: HPA가 Pod 수를 늘렸지만 배치할 노드 자원이 없어 Pending으로 남았습니다. Karpenter는 무엇을 보고 노드를 만들며 Pod 확장과는 어떻게 연결되나요?](/tech-interview/questions/karpenter-node-provisioning/)
