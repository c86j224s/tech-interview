---
id: "karpenter-consolidate-after-churn"
title: "consolidateAfter를 늘리면 노드 비용과 반복 재배치·예열 손실은 어떻게 달라지나요?"
difficulty: "중하"
category: "인프라"
tags: ["Karpenter","consolidation","비용","심화 질문"]
related: ["karpenter-consolidation","k8s-pdb-eviction"]
promotedFrom: {"id":"karpenter-consolidation","prompt":"consolidateAfter를 길게 할 때 비용 절감과 반복 재배치 안정성이 어떻게 달라질까요."}
---

# consolidateAfter를 늘리면 노드 비용과 반복 재배치·예열 손실은 어떻게 달라지나요?

## 구두 답변

대기 기간을 늘리면 짧은 부하 변동마다 노드를 합쳤다 다시 만드는 churn을 줄일 수 있지만 유휴 비용을 더 오래 지불합니다. workload의 반복 주기·예열·중단 비용으로 판단합니다.

Karpenter 버전의 정책 적용 범위와 다른 drift·강제 중단을 구분합니다. 비용만 아니라 재스케줄·ready 시간·실패·기존 session을 측정합니다. 값 하나로 모든 자발 중단을 통제한다고 가정하지 않습니다.

## 득점 포인트

- 대기 기간을 늘리면 짧은 부하 변동마다 노드를 합쳤다 다시 만드는 churn을 줄일 수 있지만 유휴 비용을 더 오래 지불합니다. workload의 반복 주기·예열·중단 비용으로 판단합니다.
- 값 하나로 모든 자발 중단을 통제한다고 가정하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 대기 기간을 늘리면 짧은 부하 변동마다 노드를 합쳤다 다시 만드는 churn을 줄일 수 있지만 유휴 비용을 더 오래 지불합니다.

## 더 파고들 거리

- [기본 상황과 비교: Karpenter로 사용률이 낮은 노드를 줄이려는데 그 위에 Pod가 실행 중입니다. consolidation은 어떤 이동을 일으키며 중단과 재배치를 어떻게 대비하나요?](/tech-interview/questions/karpenter-consolidation/)
