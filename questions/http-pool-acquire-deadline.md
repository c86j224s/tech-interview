---
id: "http-pool-acquire-deadline"
title: "HTTP 연결을 기다리다가 사용자 deadline을 넘깁니다. 풀 획득·연결·응답 기한을 어떻게 합치나요?"
difficulty: "중하"
category: "네트워크"
tags: ["HTTP","연결 풀","타임아웃","심화 질문"]
related: ["http-connection-pool","bounded-queue-backpressure"]
promotedFrom: {"id":"http-connection-pool","prompt":"연결 획득 timeout을 전체 요청 deadline과 어떤 우선순위로 결합할까요?"}
---

# HTTP 연결을 기다리다가 사용자 deadline을 넘깁니다. 풀 획득·연결·응답 기한을 어떻게 합치나요?

## 구두 답변

연결 획득·DNS·연결·TLS·응답 단계마다 별도 시간을 초기화하면 전체 기한이 늘어납니다. 하나의 절대 deadline에서 각 단계에 남은 예산만 배분합니다.

취소된 대기자를 풀 큐에서 제거하고 실제 I/O 정리 여유를 남깁니다. timeout 변경은 미실행 증거가 아니므로 변경 요청은 논리 키로 결과를 조회합니다.

## 득점 포인트

- 연결 획득·DNS·연결·TLS·응답 단계마다 별도 시간을 초기화하면 전체 기한이 늘어납니다. 하나의 절대 deadline에서 각 단계에 남은 예산만 배분합니다.
- timeout 변경은 미실행 증거가 아니므로 변경 요청은 논리 키로 결과를 조회합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 연결 획득·DNS·연결·TLS·응답 단계마다 별도 시간을 초기화하면 전체 기한이 늘어납니다.

## 더 파고들 거리

- [기본 상황과 비교: 외부 HTTP 호출에서 연결 풀 대기가 늘었습니다. 연결 수를 늘려도 되는 경우와 오히려 줄여야 하는 경우는 어떻게 구분하나요?](/tech-interview/questions/http-connection-pool/)
