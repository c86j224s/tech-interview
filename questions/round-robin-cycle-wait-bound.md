---
id: "round-robin-cycle-wait-bound"
title: "Round Robin의 runnable 작업 수가 늘었습니다. 한 바퀴 대기와 quantum이 응답 지연에 어떤 영향을 주나요?"
difficulty: "중하"
category: "운영체제"
tags: ["Round Robin","time quantum","컨텍스트 스위칭","심화 질문"]
related: ["round-robin-time-quantum","cpu-scheduling-policies"]
promotedFrom: {"id":"round-robin-time-quantum","prompt":"작업 수가 늘 때 한 바퀴 대기가 p99에 미치는 영향을 어떻게 계산할까요?"}
---

# Round Robin의 runnable 작업 수가 늘었습니다. 한 바퀴 대기와 quantum이 응답 지연에 어떤 영향을 주나요?

## 구두 답변

같은 quantum을 쓰는 runnable 작업 N개에서는 한 작업이 다시 실행될 때까지 대략 다른 작업들의 slice와 전환 비용을 기다릴 수 있습니다. 실제 I/O·선점·우선순위·작업 길이에 따라 달라지는 모델입니다.

작은 quantum은 반응 기회를 늘리지만 전환·cache 비용을 키울 수 있습니다. 평균 모델을 p99의 절대 보장으로 쓰지 않고 작업 수·혼합·코어를 바꿔 측정합니다.

## 득점 포인트

- 같은 quantum을 쓰는 runnable 작업 N개에서는 한 작업이 다시 실행될 때까지 대략 다른 작업들의 slice와 전환 비용을 기다릴 수 있습니다. 실제 I/O·선점·우선순위·작업 길이에 따라 달라지는 모델입니다.
- 평균 모델을 p99의 절대 보장으로 쓰지 않고 작업 수·혼합·코어를 바꿔 측정합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 같은 quantum을 쓰는 runnable 작업 N개에서는 한 작업이 다시 실행될 때까지 대략 다른 작업들의 slice와 전환 비용을 기다릴 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 긴 계산과 짧은 대화형 작업을 함께 실행합니다. Round Robin의 time quantum을 줄이면 응답성과 문맥 교환 비용이 어떻게 달라지나요?](/tech-interview/questions/round-robin-time-quantum/)
