---
id: "checkpoint-frequency-rework-budget"
title: "중단 가능한 worker의 checkpoint 주기를 정합니다. 기록 비용과 최대 재작업·불확정 효과를 어떻게 비교하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Karpenter","Spot","중단 처리","심화 질문"]
related: ["karpenter-spot-interruption","graceful-shutdown","karpenter-node-provisioning"]
promotedFrom: {"id":"karpenter-spot-interruption","prompt":"checkpoint 주기와 허용 가능한 유실·재처리 작업량을 수치 대신 어떤 계약으로 연결할까요."}
---

# 중단 가능한 worker의 checkpoint 주기를 정합니다. 기록 비용과 최대 재작업·불확정 효과를 어떻게 비교하나요?

## 구두 답변

짧은 checkpoint는 재작업을 줄이는 대신 기록·I/O·일시 정지 비용을 늘립니다. 마지막 안전 위치와 현재 작업량의 차이를 최대 중단 시 복구 비용으로 계산합니다.

외부 효과가 checkpoint 전에 이미 발생했으면 재실행 중복이 남으므로 멱등 키를 유지합니다. checkpoint의 원자성·스키마·로그 보관을 확인하고 중단 위치별 복구를 실제 시험합니다.

## 득점 포인트

- 짧은 checkpoint는 재작업을 줄이는 대신 기록·I/O·일시 정지 비용을 늘립니다. 마지막 안전 위치와 현재 작업량의 차이를 최대 중단 시 복구 비용으로 계산합니다.
- checkpoint의 원자성·스키마·로그 보관을 확인하고 중단 위치별 복구를 실제 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 짧은 checkpoint는 재작업을 줄이는 대신 기록·I/O·일시 정지 비용을 늘립니다.

## 더 파고들 거리

- [기본 상황과 비교: Spot 노드에 중단 통지가 왔을 때 큐 작업·게임 세션·대체 용량을 어떻게 처리해야 하나요?](/tech-interview/questions/karpenter-spot-interruption/)
