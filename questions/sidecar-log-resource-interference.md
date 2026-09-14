---
id: "sidecar-log-resource-interference"
title: "sidecar 로그가 폭주합니다. Pod의 배치·CPU·메모리와 주 앱 지연에 어떤 간섭이 생기나요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","requests","limits","심화 질문"]
related: ["k8s-requests-limits","bounded-queue-backpressure"]
promotedFrom: {"id":"k8s-requests-limits","prompt":"사이드카의 로그 폭주가 애플리케이션 Pod의 배치와 OOM에 미치는 영향을 어떻게 측정할까요."}
---

# sidecar 로그가 폭주합니다. Pod의 배치·CPU·메모리와 주 앱 지연에 어떤 간섭이 생기나요?

## 구두 답변

sidecar도 Pod의 자원·배치·노드 I/O를 사용하며 로그 burst가 CPU·메모리·디스크·네트워크에 간섭할 수 있습니다. 앱 CPU만 보고 원인을 판단하지 않습니다.

컨테이너별 request·limit과 전체 Pod·node 지표를 대조합니다. 로그 큐·drop·필수 감사 보존을 나누고 sink 장애를 시험합니다. sidecar를 분리해도 공유 노드 자원이 무한해지는 것은 아닙니다.

## 득점 포인트

- sidecar도 Pod의 자원·배치·노드 I/O를 사용하며 로그 burst가 CPU·메모리·디스크·네트워크에 간섭할 수 있습니다. 앱 CPU만 보고 원인을 판단하지 않습니다.
- sidecar를 분리해도 공유 노드 자원이 무한해지는 것은 아닙니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: sidecar도 Pod의 자원·배치·노드 I/O를 사용하며 로그 burst가 CPU·메모리·디스크·네트워크에 간섭할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Kubernetes에서 컨테이너에 requests와 limits를 설정합니다. 노드 배치와 CPU·메모리 초과 처리에는 각각 어떻게 쓰이나요?](/tech-interview/questions/k8s-requests-limits/)
