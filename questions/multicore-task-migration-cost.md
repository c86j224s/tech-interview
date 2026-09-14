---
id: "multicore-task-migration-cost"
title: "여유 코어로 작업을 옮기면 항상 빨라지나요? 부하 균형과 캐시·NUMA 이동 비용을 어떻게 비교하나요?"
difficulty: "중하"
category: "운영체제"
tags: ["CPU 스케줄링","FCFS","SJF","Round Robin","심화 질문"]
related: ["cpu-scheduling-policies","context-switch-overhead"]
promotedFrom: {"id":"cpu-scheduling-policies","prompt":"멀티코어에서 작업을 다른 코어로 옮기는 비용까지 포함하면 비교가 어떻게 달라질까요?"}
---

# 여유 코어로 작업을 옮기면 항상 빨라지나요? 부하 균형과 캐시·NUMA 이동 비용을 어떻게 비교하나요?

## 구두 답변

여유 코어로 옮기면 run queue 대기를 줄일 수 있지만 warm cache와 NUMA 지역성을 잃을 수 있습니다. 작업의 남은 계산량·데이터 크기·재사용 기간과 이동 비용을 비교합니다.

고정 affinity는 locality를 높이는 대신 불균형과 유휴를 만들 수 있습니다. CPU 배치·메모리 first touch·worker 수를 하나씩 바꿔 대조합니다. 코어가 놀고 있다는 사실만으로 모든 작업 이동이 이득이라고 하지 않습니다.

## 득점 포인트

- 여유 코어로 옮기면 run queue 대기를 줄일 수 있지만 warm cache와 NUMA 지역성을 잃을 수 있습니다. 작업의 남은 계산량·데이터 크기·재사용 기간과 이동 비용을 비교합니다.
- 코어가 놀고 있다는 사실만으로 모든 작업 이동이 이득이라고 하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 여유 코어로 옮기면 run queue 대기를 줄일 수 있지만 warm cache와 NUMA 지역성을 잃을 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 긴 계산 작업과 짧은 대화형 요청이 CPU를 함께 씁니다. FCFS, SJF, Round Robin은 대기 시간을 어떻게 바꾸나요?](/tech-interview/questions/cpu-scheduling-policies/)
