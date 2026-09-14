---
id: "iocp-short-long-connection-fairness"
title: "긴 연결의 완료가 계속 들어옵니다. 짧은 연결의 응답과 연결별 실행 예산을 어떻게 보장하나요?"
difficulty: "중하"
category: "성능"
tags: ["IOCP","배치","공정성","심화 질문"]
related: ["iocp-batch-fairness","iocp-concurrency-workers","priority-queue-starvation"]
promotedFrom: {"id":"iocp-batch-fairness","prompt":"짧은 연결과 긴 연결의 공정성을 어떤 지표로 비교할까요?"}
---

# 긴 연결의 완료가 계속 들어옵니다. 짧은 연결의 응답과 연결별 실행 예산을 어떻게 보장하나요?

## 구두 답변

완료 큐가 FIFO 성격을 가져도 사용자 callback의 실행 비용과 worker 배정이 공정성을 자동 보장하지 않습니다. 연결별 처리량·최대 대기와 batch의 시간 예산을 둡니다.

긴 연결이 계속 생산하면 한 번에 일부만 처리하고 다른 연결에 실행권을 줍니다. 단일 callback 자체가 길면 offload·분할이 필요합니다. 짧은 연결 p99·전체 throughput·queue age를 함께 측정합니다.

## 득점 포인트

- 완료 큐가 FIFO 성격을 가져도 사용자 callback의 실행 비용과 worker 배정이 공정성을 자동 보장하지 않습니다. 연결별 처리량·최대 대기와 batch의 시간 예산을 둡니다.
- 짧은 연결 p99·전체 throughput·queue age를 함께 측정합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 완료 큐가 FIFO 성격을 가져도 사용자 callback의 실행 비용과 worker 배정이 공정성을 자동 보장하지 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: IOCP 완료를 한 번에 많이 꺼내니 처리량은 늘었지만 짧은 요청이 늦어집니다. 배치 크기와 실행 예산을 어떻게 정하나요?](/tech-interview/questions/iocp-batch-fairness/)
