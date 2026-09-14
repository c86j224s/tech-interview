---
id: "hpa-external-metric-failure"
title: "HPA의 외부 지표 수집이 끊겼습니다. 실제 replica 동작과 유지·확장·축소 fallback을 어떻게 검증하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","HPA","자동 확장","심화 질문"]
related: ["k8s-hpa-scaling","k8s-requests-limits","bounded-queue-backpressure"]
promotedFrom: {"id":"k8s-hpa-scaling","prompt":"외부 메트릭 수집이 끊겼을 때 HPA의 실제 replica 변화와 안전한 fallback을 어떻게 확인할까요."}
---

# HPA의 외부 지표 수집이 끊겼습니다. 실제 replica 동작과 유지·확장·축소 fallback을 어떻게 검증하나요?

## 구두 답변

지표 조회 실패 시 HPA가 무조건 0으로 줄어든다고도, 항상 늘린다고도 가정하지 않습니다. 사용 버전·복수 지표·오류 조건에 따른 실제 desired·ready replica를 확인합니다.

기능별 최소 용량·수동 전환·마지막 정상값 정책을 정하고 지표 누락을 0 부하로 바꾸지 않습니다. 수집 복구 뒤 갑작스러운 scale 변화와 새 Pod readiness·원본 용량도 함께 시험합니다.

## 득점 포인트

- 지표 조회 실패 시 HPA가 무조건 0으로 줄어든다고도, 항상 늘린다고도 가정하지 않습니다. 사용 버전·복수 지표·오류 조건에 따른 실제 desired·ready replica를 확인합니다.
- 수집 복구 뒤 갑작스러운 scale 변화와 새 Pod readiness·원본 용량도 함께 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 지표 조회 실패 시 HPA가 무조건 0으로 줄어든다고도, 항상 늘린다고도 가정하지 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: Kubernetes HPA의 목표 replica 수는 늘었는데 응답 지연이 그대로입니다. 새 Pod의 준비 상태와 실제 병목을 어떻게 확인하나요?](/tech-interview/questions/k8s-hpa-scaling/)
