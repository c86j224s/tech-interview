---
id: "hpa-cpu-utilization-request-denominator"
title: "CPU request가 바뀌자 HPA 판단도 달라졌습니다. utilization의 분모와 실제 사용량을 어떻게 구분하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","requests","limits","심화 질문"]
related: ["k8s-requests-limits","bounded-queue-backpressure"]
promotedFrom: {"id":"k8s-requests-limits","prompt":"CPU request가 없거나 부정확할 때 utilization 기반 HPA의 입력이 어떻게 흔들릴까요."}
---

# CPU request가 바뀌자 HPA 판단도 달라졌습니다. utilization의 분모와 실제 사용량을 어떻게 구분하나요?

## 구두 답변

CPU utilization은 보통 실제 사용량을 request와 비교한 비율이므로 request가 바뀌면 같은 CPU도 다른 입력이 됩니다. request는 HPA 설정과 스케줄링 예약에 함께 영향을 줍니다.

누락 request·sidecar·초기 Pod·지표 window의 계약을 확인합니다. 비율만 낮춰 scale을 막는 대신 실제 용량·대기·SLO를 봅니다. desired·scheduled·ready와 처리량을 분리해 시험합니다.

## 득점 포인트

- CPU utilization은 보통 실제 사용량을 request와 비교한 비율이므로 request가 바뀌면 같은 CPU도 다른 입력이 됩니다. request는 HPA 설정과 스케줄링 예약에 함께 영향을 줍니다.
- desired·scheduled·ready와 처리량을 분리해 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: CPU utilization은 보통 실제 사용량을 request와 비교한 비율이므로 request가 바뀌면 같은 CPU도 다른 입력이 됩니다.

## 더 파고들 거리

- [기본 상황과 비교: Kubernetes에서 컨테이너에 requests와 limits를 설정합니다. 노드 배치와 CPU·메모리 초과 처리에는 각각 어떻게 쓰이나요?](/tech-interview/questions/k8s-requests-limits/)
