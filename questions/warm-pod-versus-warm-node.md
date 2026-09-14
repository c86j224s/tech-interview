---
id: "warm-pod-versus-warm-node"
title: "첫 작업 지연을 줄이려 warm Pod나 warm node를 유지합니다. 이미지·시작·준비·비용을 어떻게 비교하나요?"
difficulty: "중하"
category: "인프라"
tags: ["KEDA","scale to zero","콜드 스타트","심화 질문"]
related: ["keda-scale-zero","keda-hpa-role","k8s-hpa-scaling"]
promotedFrom: {"id":"keda-scale-zero","prompt":"노드 공급이 느릴 때 warm Pod와 warm node 중 무엇을 유지할지 비용·지연으로 비교해 보세요."}
---

# 첫 작업 지연을 줄이려 warm Pod나 warm node를 유지합니다. 이미지·시작·준비·비용을 어떻게 비교하나요?

## 구두 답변

warm node는 배치할 compute를 준비하지만 이미지 pull·앱 초기화·연결·readiness는 남습니다. warm Pod는 그 비용도 줄일 수 있지만 더 많은 자원을 계속 사용합니다.

첫 요청 지연을 polling·scheduler·node·image·startup·ready로 분해합니다. 최소 용량과 burst 크기를 비용·SLO에 맞추고 준비되지 않은 Pod를 warm이라고 세지 않습니다. 장애 영역·재시작도 시험합니다.

## 득점 포인트

- warm node는 배치할 compute를 준비하지만 이미지 pull·앱 초기화·연결·readiness는 남습니다. warm Pod는 그 비용도 줄일 수 있지만 더 많은 자원을 계속 사용합니다.
- 장애 영역·재시작도 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: warm node는 배치할 compute를 준비하지만 이미지 pull·앱 초기화·연결·readiness는 남습니다.

## 더 파고들 거리

- [기본 상황과 비교: KEDA로 consumer Deployment를 0 replica까지 줄였다가 첫 메시지를 처리할 때 지연은 어디에서 생기나요?](/tech-interview/questions/keda-scale-zero/)
