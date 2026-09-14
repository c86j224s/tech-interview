---
id: "gomemlimit-container-headroom"
title: "Go 컨테이너에서 GOMEMLIMIT를 limit과 같게 설정했습니다. 런타임 밖 메모리와 피크 여유는 어떻게 계산하나요?"
difficulty: "중하"
category: "성능"
tags: ["Kubernetes","OOM","CPU throttling","심화 질문"]
related: ["k8s-oom-throttling","k8s-requests-limits","go-gc-latency-tradeoff"]
promotedFrom: {"id":"k8s-oom-throttling","prompt":"GOMEMLIMIT와 컨테이너 limit 사이의 여유를 어떤 부하로 정할까요?"}
---

# Go 컨테이너에서 GOMEMLIMIT를 limit과 같게 설정했습니다. 런타임 밖 메모리와 피크 여유는 어떻게 계산하나요?

## 구두 답변

GOMEMLIMIT는 Go 런타임이 관리하는 메모리의 목표이며 컨테이너 전체 RSS의 단단한 상한이 아닙니다. native·cgo·매핑·스택·OS와 순간 피크의 여유를 남깁니다.

heap·runtime 지표와 cgroup 사용량을 대조하고 최대 부하에서 OOM·GC CPU·p99를 봅니다. 값을 너무 낮추면 GC가 과도하게 일할 수 있어 cache 축소·할당 개선과 함께 검증합니다.

## 득점 포인트

- GOMEMLIMIT는 Go 런타임이 관리하는 메모리의 목표이며 컨테이너 전체 RSS의 단단한 상한이 아닙니다. native·cgo·매핑·스택·OS와 순간 피크의 여유를 남깁니다.
- 값을 너무 낮추면 GC가 과도하게 일할 수 있어 cache 축소·할당 개선과 함께 검증합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: GOMEMLIMIT는 Go 런타임이 관리하는 메모리의 목표이며 컨테이너 전체 RSS의 단단한 상한이 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: Kubernetes의 일부 컨테이너는 OOMKilled로 재시작하고 다른 컨테이너는 살아 있지만 느립니다. 메모리 종료와 CPU 제한을 어떻게 구분하나요?](/tech-interview/questions/k8s-oom-throttling/)
