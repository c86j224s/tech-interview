---
id: "karpenter-session-disruption-policy"
title: "장기 게임 세션 Pod의 자발적 재배치를 줄이려 합니다. disruption 보호와 강제 장애 복구를 어떻게 나누나요?"
difficulty: "중하"
category: "인프라"
tags: ["Karpenter","consolidation","비용","심화 질문"]
related: ["karpenter-consolidation","k8s-pdb-eviction"]
promotedFrom: {"id":"karpenter-consolidation","prompt":"장기 세션 Pod를 자발적 disruption에서 보호하면서 강제 장애와 구분하는 정책을 설계해 보세요."}
---

# 장기 게임 세션 Pod의 자발적 재배치를 줄이려 합니다. disruption 보호와 강제 장애 복구를 어떻게 나누나요?

## 구두 답변

자발적인 consolidation·drift 중단을 예산·보호 annotation·Pod 상태로 조절할 수 있지만 노드 강제 손실을 막는 것은 아닙니다. 지원 버전의 보호 범위와 예외를 확인합니다.

장기 세션의 handoff·재접속·보상 멱등성을 원래부터 설계합니다. 보호를 무기한 유지하면 비용·보안 업데이트가 막힐 수 있어 만료·운영 책임을 둡니다. 실제 disruption과 강제 장애를 따로 시험합니다.

## 득점 포인트

- 자발적인 consolidation·drift 중단을 예산·보호 annotation·Pod 상태로 조절할 수 있지만 노드 강제 손실을 막는 것은 아닙니다. 지원 버전의 보호 범위와 예외를 확인합니다.
- 실제 disruption과 강제 장애를 따로 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 자발적인 consolidation·drift 중단을 예산·보호 annotation·Pod 상태로 조절할 수 있지만 노드 강제 손실을 막는 것은 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: Karpenter로 사용률이 낮은 노드를 줄이려는데 그 위에 Pod가 실행 중입니다. consolidation은 어떤 이동을 일으키며 중단과 재배치를 어떻게 대비하나요?](/tech-interview/questions/karpenter-consolidation/)
