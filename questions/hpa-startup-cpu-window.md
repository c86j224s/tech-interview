---
id: "hpa-startup-cpu-window"
title: "새 Pod 예열 CPU가 높아 HPA를 흔듭니다. 준비·초기화·측정 창을 어떻게 분리하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","HPA","자동 확장","심화 질문"]
related: ["k8s-hpa-scaling","k8s-requests-limits","bounded-queue-backpressure"]
promotedFrom: {"id":"k8s-hpa-scaling","prompt":"예열 중 Pod의 CPU가 높아 목표 계산을 흔들 때 initialization과 측정 창을 어떻게 분리할까요."}
---

# 새 Pod 예열 CPU가 높아 HPA를 흔듭니다. 준비·초기화·측정 창을 어떻게 분리하나요?

## 구두 답변

초기 Pod CPU는 class loading·cache warm-up·JIT 등으로 정상 steady 부하와 다를 수 있습니다. readiness와 HPA가 고려하는 초기화·측정 창의 실제 버전 계약을 확인합니다.

예열을 숨기기 위해 잘못된 지표를 보내지 않고 warm capacity·시작 지연·최소 replica를 검토합니다. 새 Pod가 준비되지 않았는데 평균 CPU만 낮아져 축소하지 않는지 시험합니다. desired와 ready·처리량을 분리합니다.

## 득점 포인트

- 초기 Pod CPU는 class loading·cache warm-up·JIT 등으로 정상 steady 부하와 다를 수 있습니다. readiness와 HPA가 고려하는 초기화·측정 창의 실제 버전 계약을 확인합니다.
- desired와 ready·처리량을 분리합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 초기 Pod CPU는 class loading·cache warm-up·JIT 등으로 정상 steady 부하와 다를 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Kubernetes HPA의 목표 replica 수는 늘었는데 응답 지연이 그대로입니다. 새 Pod의 준비 상태와 실제 병목을 어떻게 확인하나요?](/tech-interview/questions/k8s-hpa-scaling/)
