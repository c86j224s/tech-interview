---
id: "cloud-capacity-instance-diversity"
title: "클라우드 용량 부족으로 인스턴스 유형을 넓힙니다. 비용·아키텍처·성능·보안 조건을 어떻게 보존하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Karpenter","노드","스케줄링","심화 질문"]
related: ["karpenter-node-provisioning","k8s-hpa-scaling","keda-hpa-role"]
promotedFrom: {"id":"karpenter-node-provisioning","prompt":"클라우드 용량 부족에 인스턴스 유형을 넓힐 때 비용·보안·예측 가능성을 어떻게 관리할까요."}
---

# 클라우드 용량 부족으로 인스턴스 유형을 넓힙니다. 비용·아키텍처·성능·보안 조건을 어떻게 보존하나요?

## 구두 답변

후보 유형을 넓히면 용량 확보 가능성을 높일 수 있지만 architecture·CPU 성능·메모리·네트워크·보안·가격이 달라집니다. 앱의 이미지·native 의존성·성능 기준을 유지해야 합니다.

허용 범위를 NodePool 등 정책에 명시하고 비용 상한·기본 최소 용량을 둡니다. 실제 부족·회복·혼합 하드웨어에서 workload p99와 준비 시간을 비교합니다. 단순 노드 생성 성공을 동등 서비스 용량으로 세지 않습니다.

## 득점 포인트

- 후보 유형을 넓히면 용량 확보 가능성을 높일 수 있지만 architecture·CPU 성능·메모리·네트워크·보안·가격이 달라집니다. 앱의 이미지·native 의존성·성능 기준을 유지해야 합니다.
- 단순 노드 생성 성공을 동등 서비스 용량으로 세지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 후보 유형을 넓히면 용량 확보 가능성을 높일 수 있지만 architecture·CPU 성능·메모리·네트워크·보안·가격이 달라집니다.

## 더 파고들 거리

- [기본 상황과 비교: HPA가 Pod 수를 늘렸지만 배치할 노드 자원이 없어 Pending으로 남았습니다. Karpenter는 무엇을 보고 노드를 만들며 Pod 확장과는 어떻게 연결되나요?](/tech-interview/questions/karpenter-node-provisioning/)
