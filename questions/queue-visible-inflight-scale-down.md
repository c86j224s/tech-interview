---
id: "queue-visible-inflight-scale-down"
title: "대기 메시지는 없지만 worker가 아직 처리 중입니다. visible·in-flight 지표를 scale-down과 종료에 어떻게 사용하나요?"
difficulty: "중하"
category: "인프라"
tags: ["KEDA","scale to zero","콜드 스타트","심화 질문"]
related: ["keda-scale-zero","keda-hpa-role","k8s-hpa-scaling"]
promotedFrom: {"id":"keda-scale-zero","prompt":"대기 메시지와 처리 중 메시지를 분리한 지표가 scale-down과 종료 유예를 어떻게 바꾸는지 설명해 보세요."}
---

# 대기 메시지는 없지만 worker가 아직 처리 중입니다. visible·in-flight 지표를 scale-down과 종료에 어떻게 사용하나요?

## 구두 답변

visible backlog가 0이어도 in-flight 작업은 외부 변경을 수행할 수 있습니다. 종료 판단은 대기와 실행 중 작업·ACK·내구 기록을 함께 봐야 합니다.

scale-down은 새 fetch를 막고 실행을 drain하거나 안전하게 재전달합니다. 지표 지연과 broker의 정확한 in-flight 의미를 확인합니다. worker 종료 후 중복 효과·잔존 lease·사용자 미완료를 시험합니다.

## 득점 포인트

- visible backlog가 0이어도 in-flight 작업은 외부 변경을 수행할 수 있습니다. 종료 판단은 대기와 실행 중 작업·ACK·내구 기록을 함께 봐야 합니다.
- worker 종료 후 중복 효과·잔존 lease·사용자 미완료를 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: visible backlog가 0이어도 in-flight 작업은 외부 변경을 수행할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: KEDA로 consumer Deployment를 0 replica까지 줄였다가 첫 메시지를 처리할 때 지연은 어디에서 생기나요?](/tech-interview/questions/keda-scale-zero/)
