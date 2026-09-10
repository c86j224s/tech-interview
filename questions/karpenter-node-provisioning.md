---
id: karpenter-node-provisioning
title: "HPA가 Pod 수를 늘렸지만 배치할 노드 자원이 없어 Pending으로 남았습니다. Karpenter는 무엇을 보고 노드를 만들며 Pod 확장과는 어떻게 연결되나요?"
difficulty: 하
category: 인프라
tags: ["Karpenter","노드","스케줄링"]
related: ["k8s-hpa-scaling","keda-hpa-role"]
---

# HPA가 Pod 수를 늘렸지만 배치할 노드 자원이 없어 Pending으로 남았습니다. Karpenter는 무엇을 보고 노드를 만들며 Pod 확장과는 어떻게 연결되나요?

## 구두 답변

HPA는 메트릭에 따라 Deployment 같은 workload의 replica 수를 조절하고, KEDA는 queue length·Kafka lag 같은 이벤트 소스를 HPA의 확장 입력이나 0에서의 활성화에 연결합니다. Karpenter는 이미 생성된 Pod의 `requests`, node selector/affinity, taint toleration, 영역·인스턴스 제약을 보고 스케줄되지 못한 Pod를 수용할 노드 용량을 공급합니다. 즉 Pod 수를 결정하는 단계와 그 Pod를 실행할 기계를 공급하는 단계가 다릅니다.

Pod가 늘었는데 기존 노드에 자리가 없으면 pending 상태가 되고, Karpenter가 노드 요청인 NodeClaim을 만들고 실제 노드를 준비할 수 있어야 실행으로 넘어갑니다. requests가 실제 사용량보다 작으면 노드가 생겨도 CPU 경쟁·메모리 압박이 발생하고, NodePool(허용할 노드 유형과 조건을 정하는 정책) 제약을 지나치게 좁히면 선택 가능한 인스턴스가 없어집니다. 예를 들어 실제로 메모리 3GiB가 필요한 Pod가 1GiB만 요청하면 Karpenter는 작은 노드를 골라도 된다고 판단해 실행 중 OOM이 생길 수 있습니다. 모든 노드에 함께 실행되는 DaemonSet의 자원, 가용 영역, PVC의 topology(볼륨이 붙을 수 있는 영역), 비용 상한과 보안 설정을 함께 확인하겠습니다. 노드는 생겼는데 볼륨 영역과 맞지 않아 Pod가 계속 pending인 사례도 있기 때문입니다.

노드 생성 완료는 서비스 준비가 아닙니다. 노드 초기 설정(부트스트랩), 네트워크·볼륨 플러그인(CNI·CSI), 모든 노드에 함께 실행되는 DaemonSet, 이미지 다운로드, Pod readiness가 뒤따릅니다. pending 이유→NodeClaim 상태→Node Ready→Pod Ready→실제 요청 처리까지의 시간을 관찰하고, 부하 증가와 클라우드 용량 부족을 각각 시험하겠습니다. 공급이 실패하면 NodeClaim의 상태와 클라우드 오류를 확인해 권한·용량·배치 제약 중 원인을 고쳐야 합니다. 자동 노드 공급은 잘못된 Pod 자원 선언이나 애플리케이션 병목을 보정하지 않습니다.

## 득점 포인트

- workload replica 확장과 노드 용량 공급을 단계별로 구분한다.
- requests·제약·DaemonSet·PVC가 노드 선택에 미치는 영향을 연결한다.
- NodeClaim부터 실제 서비스 준비까지 관찰 순서를 제시한다.

## 감점 포인트

- Karpenter가 애플리케이션 replica를 직접 최적화한다고 말한다.
- 노드 생성 완료를 Pod·서비스 준비 완료로 간주한다.
- 노드 제약과 비용·영역·보안 조건을 무시한다.

## 더 파고들 거리

- DaemonSet requests는 Karpenter의 노드 선택과 실제 가용 용량에 어떻게 반영되나요?
- PVC의 영역 제약과 NodePool 조건이 맞지 않을 때 pending을 어떻게 진단할까요?
- 클라우드 용량 부족에 여러 인스턴스 유형을 허용할 때 비용과 예측 가능성을 어떻게 관리할까요?
