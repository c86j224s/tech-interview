---
id: scheduler-toleration-not-attraction
title: GPU 전용 taint에 toleration만 추가하면 일반 Pod가 밀려나고 GPU Pod가 그 노드를 선호하나요?
difficulty: 중하
category: 인프라
tags:
  - scheduler
  - taint
  - affinity
related:
  - pvc-nodepool-zone-conflict
---
# GPU 전용 taint에 toleration만 추가하면 일반 Pod가 밀려나고 GPU Pod가 그 노드를 선호하나요?

## 구두 답변
아니요. GPU taint의 toleration은 그 tainted node에서 거절되지 않을 자격만 주고, 그 노드를 선택하거나 다른 노드를 배제하지 않습니다. GPU node에 `dedicated=gpu:NoSchedule`이 있고 Pod에 그 toleration만 있으면 GPU node와 일반 CPU node가 모두 후보입니다. 따라서 GPU Pod가 CPU node에 갈 수 있고, 같은 toleration을 가진 CPU sidecar나 다른 Pod가 GPU node의 자원을 경쟁할 수 있습니다.

전용 정책은 양방향으로 구성합니다. 노드에는 일반 Pod를 막는 taint를 두고, 대상 Pod에는 matching toleration과 `accelerator=gpu` required node affinity 또는 nodeSelector를 둡니다. 여기에 device plugin이 실제 노출한 resource, 예를 들어 `nvidia.com/gpu: 1` 같은 request를 넣어 용량 예약 의도도 표현합니다. label만 있다고 GPU device가 자동 요청되지는 않습니다. 반대로 resource request만 있으면 여러 GPU node 중 원하는 pool을 고르지 못할 수 있습니다.

세 fixture를 비교하면 차이가 선명합니다. toleration만 있는 Pod는 node-a와 node-b 모두 가능하고, toleration+required label Pod는 GPU label 노드만 가능하며, 여기에 GPU request를 넣은 Pod는 allocatable device가 있는 노드만 남습니다. 실제 device plugin 이름과 scheduler 결과는 cluster에서 확인해야 하고, 이 상태는 설명용입니다.

전용 노드의 반대 방향도 점검해야 합니다. 대상 Pod에 required label을 추가해도 노드 taint가 제거되면 일반 Pod가 다시 들어올 수 있으므로 taint와 affinity를 함께 rollout하고, 정책 admission이나 ExtendedResourceToleration이 누락된 Pod를 차단하는지 확인합니다. GPU request의 단위와 device plugin allocatable을 같은 시점에 비교해야 label만 맞는 가짜 성공을 피할 수 있습니다.

참고: https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/ (2026-09-19에 읽은 공식 문서 본문; 대상 릴리스와 실제 cluster 실행은 별도 확인)

## 득점 포인트
- toleration의 역할을 attraction과 분리합니다.
- taint·toleration·required label·GPU resource request의 양방향 목적을 나눕니다.
- 세 fixture의 후보 집합이 어떻게 좁아지는지 구체적으로 비교합니다.

## 감점 포인트
- toleration이 노드를 우선 선택한다고 합니다.
- taint 하나만으로 전용 노드가 완성된다고 말합니다.
- GPU label이 device request를 자동 생성한다고 주장합니다.

## 더 파고들 거리
- PreferNoSchedule과 NoSchedule의 차이를 어떤 후보·event로 확인할까요?
- CPU sidecar가 GPU node 용량을 차지하지 않게 request 정책을 어떻게 둘까요?
