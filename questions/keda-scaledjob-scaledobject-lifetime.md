---
id: "keda-scaledjob-scaledobject-lifetime"
title: "KEDA ScaledJob과 ScaledObject를 선택합니다. 단위 작업과 장수 consumer의 수명·재시도 차이는 무엇인가요?"
difficulty: "중하"
category: "인프라"
tags: ["KEDA","HPA","자동 확장","심화 질문"]
related: ["keda-hpa-role","k8s-hpa-scaling","kafka-lag-interpretation"]
promotedFrom: {"id":"keda-hpa-role","prompt":"ScaledObject와 ScaledJob을 장수 consumer와 단위 작업의 수명·재처리 기준으로 비교해 보세요."}
---

# KEDA ScaledJob과 ScaledObject를 선택합니다. 단위 작업과 장수 consumer의 수명·재시도 차이는 무엇인가요?

## 구두 답변

ScaledJob은 작업 단위 Job 수명과 재시도를, ScaledObject는 장수 Deployment 등 workload의 replica 조절을 중심으로 봅니다. 메시지 소비 방식·초기화·연결 유지·종료 요구에 맞춰 선택합니다.

Job 하나가 메시지 한 개를 정확히 한 번 처리한다는 보장은 아닙니다. visible·in-flight·max replica·DB 한도와 멱등 효과를 관리합니다. 초기 시작 비용·작업 길이·재전달·scale-to-zero를 비교합니다.

## 득점 포인트

- ScaledJob은 작업 단위 Job 수명과 재시도를, ScaledObject는 장수 Deployment 등 workload의 replica 조절을 중심으로 봅니다. 메시지 소비 방식·초기화·연결 유지·종료 요구에 맞춰 선택합니다.
- 초기 시작 비용·작업 길이·재전달·scale-to-zero를 비교합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: ScaledJob은 작업 단위 Job 수명과 재시도를, ScaledObject는 장수 Deployment 등 workload의 replica 조절을 중심으로 봅니다.

## 더 파고들 거리

- [기본 상황과 비교: CPU는 낮아도 Kafka lag가 쌓이는 소비자 서비스를 확장하려 합니다. KEDA와 HPA는 어떤 지표와 제어를 각각 맡으며 Pod 수를 어떻게 바꾸나요?](/tech-interview/questions/keda-hpa-role/)
