---
id: "readiness-flapping-hysteresis"
title: "readiness가 켜졌다 꺼지며 남은 서버의 부하가 출렁입니다. 복귀·실패 임계와 실제 용량을 어떻게 조정하나요?"
difficulty: "중하"
category: "설계"
tags: ["로드밸런서","헬스 체크","드레이닝","심화 질문"]
related: ["load-balancer-health-draining","http-connection-pool"]
promotedFrom: {"id":"load-balancer-health-draining","prompt":"flapping readiness가 트래픽을 출렁이게 할 때 어떤 hysteresis를 둘까요?"}
---

# readiness가 켜졌다 꺼지며 남은 서버의 부하가 출렁입니다. 복귀·실패 임계와 실제 용량을 어떻게 조정하나요?

## 구두 답변

실패·복귀 연속 횟수와 대기·히스테리시스를 두면 짧은 흔들림을 완화할 수 있습니다. 하지만 실제 용량 부족을 긴 임계로 숨기면 사용자 오류가 늘어납니다.

readiness 원인이 DB 공통 장애·pool 포화·초기화인지 먼저 확인합니다. 제외된 Pod 때문에 남은 Pod가 더 과부하되는 순환도 시험합니다. 새 트래픽의 점진 재개와 기존 연결 drain을 함께 설계합니다.

## 득점 포인트

- 실패·복귀 연속 횟수와 대기·히스테리시스를 두면 짧은 흔들림을 완화할 수 있습니다. 하지만 실제 용량 부족을 긴 임계로 숨기면 사용자 오류가 늘어납니다.
- 새 트래픽의 점진 재개와 기존 연결 drain을 함께 설계합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 실패·복귀 연속 횟수와 대기·히스테리시스를 두면 짧은 흔들림을 완화할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 로드밸런서 헬스 체크가 성공한 서버가 실제 요청을 실패할 수 있고, 배포 중 기존 연결도 실패할 수 있는 이유는 무엇인가요?](/tech-interview/questions/load-balancer-health-draining/)
