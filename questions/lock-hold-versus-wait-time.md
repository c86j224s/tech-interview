---
id: "lock-hold-versus-wait-time"
title: "락 대기가 길어졌습니다. 락을 보유한 시간과 기다린 시간을 어떤 사건·스택으로 나누어 기록하나요?"
difficulty: "중하"
category: "성능"
tags: ["프로파일링","대기","CPU","심화 질문"]
related: ["profiling-cpu-offcpu","distributed-tracing-boundaries"]
promotedFrom: {"id":"profiling-cpu-offcpu","prompt":"락 보유 중 실행 시간과 락을 기다린 시간을 어떤 이벤트로 나눌까요?"}
---

# 락 대기가 길어졌습니다. 락을 보유한 시간과 기다린 시간을 어떤 사건·스택으로 나누어 기록하나요?

## 구두 답변

wait는 획득 시도부터 성공까지, hold는 획득부터 반환까지를 기록해 구분합니다. 호출 stack·락 ID·소유 작업을 연결하면 많은 짧은 대기와 하나의 긴 보유 원인을 나눌 수 있습니다.

sampling은 짧은 사건을 놓칠 수 있어 계측·trace와 대조합니다. 재진입·조건 대기의 unlock/relock·여러 lock을 정확히 처리합니다. 프로파일링 overhead와 실제 p99도 함께 측정합니다.

## 득점 포인트

- wait는 획득 시도부터 성공까지, hold는 획득부터 반환까지를 기록해 구분합니다. 호출 stack·락 ID·소유 작업을 연결하면 많은 짧은 대기와 하나의 긴 보유 원인을 나눌 수 있습니다.
- 프로파일링 overhead와 실제 p99도 함께 측정합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: wait는 획득 시도부터 성공까지, hold는 획득부터 반환까지를 기록해 구분합니다.

## 더 파고들 거리

- [기본 상황과 비교: 서버 CPU 사용률은 낮은데 일부 요청이 오래 걸립니다. 계산이 느린 것과 자원을 기다리는 것을 어떻게 구분하나요?](/tech-interview/questions/profiling-cpu-offcpu/)
