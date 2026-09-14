---
id: "keda-activation-target-boundaries"
title: "KEDA activation threshold와 HPA target을 따로 둡니다. 작은 backlog가 처리되지 않는 조건은 무엇인가요?"
difficulty: "중하"
category: "인프라"
tags: ["KEDA","HPA","자동 확장","심화 질문"]
related: ["keda-hpa-role","k8s-hpa-scaling","kafka-lag-interpretation"]
promotedFrom: {"id":"keda-hpa-role","prompt":"activation threshold와 HPA target을 짧은 burst와 지속 부하에 맞춰 어떻게 분리할까요."}
---

# KEDA activation threshold와 HPA target을 따로 둡니다. 작은 backlog가 처리되지 않는 조건은 무엇인가요?

## 구두 답변

activation은 0에서 깨우는 기준과 관련되고 target은 활성 replica의 처리량 목표에 사용될 수 있습니다. activation보다 작은 backlog가 계속 남으면 worker가 깨어나지 않는 구성이 될 수 있습니다.

scaler별 비교·기본값·polling·cooldown을 확인합니다. 작은 메시지도 반드시 처리해야 하면 기준과 최소 용량을 조정합니다. 첫 작업 지연·warm-up·노드 공급·처리 중 메시지를 함께 시험합니다.

## 득점 포인트

- activation은 0에서 깨우는 기준과 관련되고 target은 활성 replica의 처리량 목표에 사용될 수 있습니다. activation보다 작은 backlog가 계속 남으면 worker가 깨어나지 않는 구성이 될 수 있습니다.
- 첫 작업 지연·warm-up·노드 공급·처리 중 메시지를 함께 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: activation은 0에서 깨우는 기준과 관련되고 target은 활성 replica의 처리량 목표에 사용될 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: CPU는 낮아도 Kafka lag가 쌓이는 소비자 서비스를 확장하려 합니다. KEDA와 HPA는 어떤 지표와 제어를 각각 맡으며 Pod 수를 어떻게 바꾸나요?](/tech-interview/questions/keda-hpa-role/)
