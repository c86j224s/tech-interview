---
id: "io-complete-ready-queue-delay"
title: "I/O는 끝났는데 요청이 늦게 재개됩니다. Ready 큐 대기와 이전 I/O 대기를 어떻게 분리하나요?"
difficulty: "중하"
category: "운영체제"
tags: ["프로세스 상태","스케줄러","대기","심화 질문"]
related: ["process-state-suspended","profiling-cpu-offcpu"]
promotedFrom: {"id":"process-state-suspended","prompt":"I/O 완료 후 Ready 큐에서 오래 기다리는 이유는 무엇인가요?"}
---

# I/O는 끝났는데 요청이 늦게 재개됩니다. Ready 큐 대기와 이전 I/O 대기를 어떻게 분리하나요?

## 구두 답변

I/O 완료 후 runnable이 되어도 CPU·우선순위·다른 긴 작업 때문에 실행까지 대기할 수 있습니다. I/O 제출·완료·wakeup·실제 실행 시각을 분리해 측정합니다.

per-core run queue·스케줄링 지연·락을 대조합니다. CPU를 늘려도 affinity·단일 loop·공유 자원 때문에 효과가 없을 수 있습니다. 낮은 평균 CPU만으로 실행 대기가 없다고 판단하지 않습니다.

## 득점 포인트

- I/O 완료 후 runnable이 되어도 CPU·우선순위·다른 긴 작업 때문에 실행까지 대기할 수 있습니다. I/O 제출·완료·wakeup·실제 실행 시각을 분리해 측정합니다.
- 낮은 평균 CPU만으로 실행 대기가 없다고 판단하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: I/O 완료 후 runnable이 되어도 CPU·우선순위·다른 긴 작업 때문에 실행까지 대기할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 프로세스가 실행되지 않는데 하나는 Ready, 다른 하나는 Blocked 상태입니다. 각각 무엇을 기다리며 CPU를 더 배정하면 둘 다 바로 실행할 수 있나요?](/tech-interview/questions/process-state-suspended/)
