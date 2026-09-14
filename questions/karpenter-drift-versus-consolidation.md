---
id: "karpenter-drift-versus-consolidation"
title: "Karpenter의 drift 교체와 consolidation은 어떤 목적·대상·중단 조건이 다른가요?"
difficulty: "중하"
category: "인프라"
tags: ["Karpenter","consolidation","비용","심화 질문"]
related: ["karpenter-consolidation","k8s-pdb-eviction"]
promotedFrom: {"id":"karpenter-consolidation","prompt":"Node drift 교체와 consolidation을 목적·대상·중단 조건·관측 지표로 비교해 보세요."}
---

# Karpenter의 drift 교체와 consolidation은 어떤 목적·대상·중단 조건이 다른가요?

## 구두 답변

drift는 원하는 노드 구성과 실제 노드의 차이를 해소하는 교체이고 consolidation은 용량·비용 효율을 위해 재배치하는 목적입니다. 대상·예산·보호 조건은 버전별 확인이 필요합니다.

둘 다 Pod 이동·초기화·session 영향을 만들 수 있어 readiness·PDB·termination을 함께 봅니다. 정책 예외를 무기한 남기면 보안 업데이트가 막힐 수 있습니다. 실제 NodeClaim 이유와 사용자 오류·비용을 대조합니다.

## 득점 포인트

- drift는 원하는 노드 구성과 실제 노드의 차이를 해소하는 교체이고 consolidation은 용량·비용 효율을 위해 재배치하는 목적입니다. 대상·예산·보호 조건은 버전별 확인이 필요합니다.
- 실제 NodeClaim 이유와 사용자 오류·비용을 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: drift는 원하는 노드 구성과 실제 노드의 차이를 해소하는 교체이고 consolidation은 용량·비용 효율을 위해 재배치하는 목적입니다.

## 더 파고들 거리

- [기본 상황과 비교: Karpenter로 사용률이 낮은 노드를 줄이려는데 그 위에 Pod가 실행 중입니다. consolidation은 어떤 이동을 일으키며 중단과 재배치를 어떻게 대비하나요?](/tech-interview/questions/karpenter-consolidation/)
