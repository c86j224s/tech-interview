---
id: "process-pool-large-payload-transfer"
title: "Python 프로세스 풀에 큰 배열을 넘깁니다. 직렬화·복사·shared memory·작업 크기의 손익은 어떻게 측정하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Python","asyncio","이벤트 루프","심화 질문"]
related: ["python-asyncio-blocking","async-api-and-blocking"]
promotedFrom: {"id":"python-asyncio-blocking","prompt":"프로세스 풀로 큰 인자를 보낼 때 직렬화·복사 비용을 어떻게 줄일까요?"}
---

# Python 프로세스 풀에 큰 배열을 넘깁니다. 직렬화·복사·shared memory·작업 크기의 손익은 어떻게 측정하나요?

## 구두 답변

프로세스 간 인자를 직렬화·복사하는 비용과 계산량을 함께 측정합니다. 작은 작업을 큰 배열과 함께 보내면 CPU 병렬화 이득보다 전송·메모리 비용이 클 수 있습니다.

shared memory는 복사를 줄이는 대신 동기화·읽기 수명·close·unlink 책임을 추가합니다. 시작 방식·worker 재시작·취소를 확인합니다. 실제 데이터 크기와 cold·warm pool 조건을 고정해 비교합니다.

## 득점 포인트

- 프로세스 간 인자를 직렬화·복사하는 비용과 계산량을 함께 측정합니다. 작은 작업을 큰 배열과 함께 보내면 CPU 병렬화 이득보다 전송·메모리 비용이 클 수 있습니다.
- 실제 데이터 크기와 cold·warm pool 조건을 고정해 비교합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 프로세스 간 인자를 직렬화·복사하는 비용과 계산량을 함께 측정합니다.

## 더 파고들 거리

- [기본 상황과 비교: asyncio 요청 처리 중 동기 HTTP 호출이나 긴 계산을 넣었더니 다른 요청까지 멈춥니다. 이벤트 루프에서 무엇이 막히며 어떤 실행 방식으로 분리하나요?](/tech-interview/questions/python-asyncio-blocking/)
