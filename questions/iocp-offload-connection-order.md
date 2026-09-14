---
id: "iocp-offload-connection-order"
title: "무거운 IOCP 완료 처리를 다른 풀로 옮깁니다. 연결별 적용 순서와 버퍼 수명을 어떻게 보존하나요?"
difficulty: "중하"
category: "성능"
tags: ["IOCP","배치","공정성","심화 질문"]
related: ["iocp-batch-fairness","iocp-concurrency-workers","priority-queue-starvation"]
promotedFrom: {"id":"iocp-batch-fairness","prompt":"무거운 완료를 다른 실행기로 옮길 때 연결별 순서는 어떻게 보장할까요?"}
---

# 무거운 IOCP 완료 처리를 다른 풀로 옮깁니다. 연결별 적용 순서와 버퍼 수명을 어떻게 보존하나요?

## 구두 답변

완료 수집자는 작업 결과를 식별하고 payload 소유권을 다음 실행기에 안전하게 넘깁니다. 같은 연결의 논리 적용 순서가 필요하면 연결별 serial executor·순번을 사용합니다.

완료 도착 순서가 곧 메시지 순서는 아닙니다. 별도 풀의 큐·동시성·취소를 제한하고 후속 작업이 끝나기 전 buffer를 반환하지 않습니다.

## 득점 포인트

- 완료 수집자는 작업 결과를 식별하고 payload 소유권을 다음 실행기에 안전하게 넘깁니다. 같은 연결의 논리 적용 순서가 필요하면 연결별 serial executor·순번을 사용합니다.
- 별도 풀의 큐·동시성·취소를 제한하고 후속 작업이 끝나기 전 buffer를 반환하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 완료 수집자는 작업 결과를 식별하고 payload 소유권을 다음 실행기에 안전하게 넘깁니다.

## 더 파고들 거리

- [기본 상황과 비교: IOCP 완료를 한 번에 많이 꺼내니 처리량은 늘었지만 짧은 요청이 늦어집니다. 배치 크기와 실행 예산을 어떻게 정하나요?](/tech-interview/questions/iocp-batch-fairness/)
