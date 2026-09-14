---
id: "iocp-worker-wakeup-locality"
title: "IOCP의 대기 worker 깨움 방식은 cache locality와 공정성에 어떤 영향을 주며 어떤 수치를 관찰하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["IOCP","concurrency","스레드","심화 질문"]
related: ["iocp-concurrency-workers","context-switch-overhead"]
promotedFrom: {"id":"iocp-concurrency-workers","prompt":"IOCP의 대기 워커 깨움 방식이 캐시 지역성과 처리 공정성에 어떤 영향을 줄까요?"}
---

# IOCP의 대기 worker 깨움 방식은 cache locality와 공정성에 어떤 영향을 주며 어떤 수치를 관찰하나요?

## 구두 답변

IOCP의 완료 큐와 대기 worker 깨움 정책은 서로 다른 순서를 가질 수 있습니다. 최근 실행 worker를 재사용하는 동작은 locality에 도움될 수 있지만 연결별 공정성 보장은 별도입니다.

concurrency와 생성 thread 수를 구분하고 batch·긴 callback·worker 대기를 관찰합니다. 특정 worker의 작업 수보다 사용자 요청 p99와 연결별 기아를 측정합니다.

## 득점 포인트

- IOCP의 완료 큐와 대기 worker 깨움 정책은 서로 다른 순서를 가질 수 있습니다. 최근 실행 worker를 재사용하는 동작은 locality에 도움될 수 있지만 연결별 공정성 보장은 별도입니다.
- 특정 worker의 작업 수보다 사용자 요청 p99와 연결별 기아를 측정합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: IOCP의 완료 큐와 대기 worker 깨움 정책은 서로 다른 순서를 가질 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: IOCP에 concurrency 값을 지정하고 워커 스레드를 따로 만들었습니다. 이 값은 생성한 스레드 수와 무엇이 다른가요?](/tech-interview/questions/iocp-concurrency-workers/)
