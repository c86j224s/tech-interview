---
id: "spot-ondemand-minimum-capacity"
title: "Spot과 on-demand를 섞습니다. 동시에 Spot을 잃어도 유지할 핵심 용량과 비용 상한은 어떻게 검증하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Karpenter","Spot","중단 처리","심화 질문"]
related: ["karpenter-spot-interruption","graceful-shutdown","karpenter-node-provisioning"]
promotedFrom: {"id":"karpenter-spot-interruption","prompt":"on-demand와 Spot을 섞을 때 핵심 최소 용량과 비용 상한을 장애 시나리오로 검증해 보세요."}
---

# Spot과 on-demand를 섞습니다. 동시에 Spot을 잃어도 유지할 핵심 용량과 비용 상한은 어떻게 검증하나요?

## 구두 답변

Spot을 모두 잃어도 유지할 최소 핵심 처리량을 on-demand·다른 영역 용량으로 계산합니다. 평상시 총 replica가 충분한 것과 상관된 중단 뒤 여유가 있는 것은 다릅니다.

비핵심 작업은 지연·재처리할 수 있지만 핵심 SLO와 원장을 보호합니다. 대체 노드 공급 지연·클라우드 capacity 부족·checkpoint·재시도를 함께 시험합니다. 비용 절감에 복구·재작업 비용을 포함합니다.

## 득점 포인트

- Spot을 모두 잃어도 유지할 최소 핵심 처리량을 on-demand·다른 영역 용량으로 계산합니다. 평상시 총 replica가 충분한 것과 상관된 중단 뒤 여유가 있는 것은 다릅니다.
- 비용 절감에 복구·재작업 비용을 포함합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Spot을 모두 잃어도 유지할 최소 핵심 처리량을 on-demand·다른 영역 용량으로 계산합니다.

## 더 파고들 거리

- [기본 상황과 비교: Spot 노드에 중단 통지가 왔을 때 큐 작업·게임 세션·대체 용량을 어떻게 처리해야 하나요?](/tech-interview/questions/karpenter-spot-interruption/)
