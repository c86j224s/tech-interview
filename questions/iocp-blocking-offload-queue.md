---
id: "iocp-blocking-offload-queue"
title: "블로킹 callback을 별도 풀로 보냈더니 그 큐가 늘어납니다. 완료 수집과 실행 풀의 상한을 어떻게 연결하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["IOCP","concurrency","스레드","심화 질문"]
related: ["iocp-concurrency-workers","context-switch-overhead"]
promotedFrom: {"id":"iocp-concurrency-workers","prompt":"블로킹 완료 처리를 별도 풀로 보낼 때 그 풀의 대기열 상한은 어떻게 정할까요?"}
---

# 블로킹 callback을 별도 풀로 보냈더니 그 큐가 늘어납니다. 완료 수집과 실행 풀의 상한을 어떻게 연결하나요?

## 구두 답변

완료 수집을 빠르게 해도 별도 executor가 감당하지 못하면 대기와 buffer 보유가 그쪽으로 이동합니다. 연결별·전체 queue와 실행 수·바이트 상한을 둡니다.

포화 시 신규 I/O·수락을 줄이거나 기능별 거절 정책을 적용합니다. 실제 callback 완료까지 참조를 유지하며 종료 때 두 executor의 의존 순서를 확인합니다. 원래 IOCP 지연과 옮긴 큐 지연을 합쳐 측정합니다.

## 득점 포인트

- 완료 수집을 빠르게 해도 별도 executor가 감당하지 못하면 대기와 buffer 보유가 그쪽으로 이동합니다. 연결별·전체 queue와 실행 수·바이트 상한을 둡니다.
- 원래 IOCP 지연과 옮긴 큐 지연을 합쳐 측정합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 완료 수집을 빠르게 해도 별도 executor가 감당하지 못하면 대기와 buffer 보유가 그쪽으로 이동합니다.

## 더 파고들 거리

- [기본 상황과 비교: IOCP에 concurrency 값을 지정하고 워커 스레드를 따로 만들었습니다. 이 값은 생성한 스레드 수와 무엇이 다른가요?](/tech-interview/questions/iocp-concurrency-workers/)
