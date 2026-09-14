---
id: "spot-notification-loss-recovery"
title: "Spot 중단 알림 전달 경로가 실패했습니다. 알림 없이도 worker와 사용자 세션을 어떻게 복구하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Karpenter","Spot","중단 처리","심화 질문"]
related: ["karpenter-spot-interruption","graceful-shutdown","karpenter-node-provisioning"]
promotedFrom: {"id":"karpenter-spot-interruption","prompt":"중단 이벤트 전달 경로 자체가 실패했을 때 heartbeat·노드 상태·재전달로 어떻게 보완할까요."}
---

# Spot 중단 알림 전달 경로가 실패했습니다. 알림 없이도 worker와 사용자 세션을 어떻게 복구하나요?

## 구두 답변

중단 알림은 회복 기회를 주는 신호이지 항상 전달되는 보장은 아닙니다. worker는 내구 작업·lease·멱등 기록으로 알림 없는 갑작스러운 노드 손실도 복구할 수 있어야 합니다.

heartbeat·node status·broker 재전달은 서로 다른 탐지 경로입니다. 옛 worker가 잠시 살아 있어도 세대·펜싱으로 중복 쓰기를 막습니다. 게임은 reconnect·snapshot·owner 전환과 데이터 유실 한도를 시험합니다.

## 득점 포인트

- 중단 알림은 회복 기회를 주는 신호이지 항상 전달되는 보장은 아닙니다. worker는 내구 작업·lease·멱등 기록으로 알림 없는 갑작스러운 노드 손실도 복구할 수 있어야 합니다.
- 게임은 reconnect·snapshot·owner 전환과 데이터 유실 한도를 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 중단 알림은 회복 기회를 주는 신호이지 항상 전달되는 보장은 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: Spot 노드에 중단 통지가 왔을 때 큐 작업·게임 세션·대체 용량을 어떻게 처리해야 하나요?](/tech-interview/questions/karpenter-spot-interruption/)
