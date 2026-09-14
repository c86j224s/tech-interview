---
id: "grpc-stream-application-backpressure"
title: "gRPC 스트림의 흐름 제어가 있어도 앱 작업 큐가 늘어납니다. 수신·큐·실행의 예산을 어떻게 연결하나요?"
difficulty: "중하"
category: "설계"
tags: ["gRPC","REST","API 계약","심화 질문"]
related: ["grpc-rest-contracts","api-backward-compatibility","deadline-cancellation-propagation"]
promotedFrom: {"id":"grpc-rest-contracts","prompt":"클라이언트 스트리밍에서 백프레셔는 작업 큐까지 어떻게 이어져야 할까요?"}
---

# gRPC 스트림의 흐름 제어가 있어도 앱 작업 큐가 늘어납니다. 수신·큐·실행의 예산을 어떻게 연결하나요?

## 구두 답변

전송 흐름 제어는 바이트 수신을 조절하지만 앱이 이미 받은 메시지를 무한 큐에 쌓는 문제를 자동 해결하지 않습니다. 읽기 요청·큐 용량·worker·DB 연결을 연속된 demand 경계로 연결합니다.

포화 시 읽기를 늦추거나 요청을 거절하고 deadline·취소를 하위에 전파합니다. 각 메시지 비용이 다르면 바이트·개수·실행량을 따로 제한합니다. 스트림 취소와 이미 commit한 변경을 구분하며 느린 소비자·큰 메시지·동시 스트림을 시험합니다.

## 득점 포인트

- 전송 흐름 제어는 바이트 수신을 조절하지만 앱이 이미 받은 메시지를 무한 큐에 쌓는 문제를 자동 해결하지 않습니다. 읽기 요청·큐 용량·worker·DB 연결을 연속된 demand 경계로 연결합니다.
- 스트림 취소와 이미 commit한 변경을 구분하며 느린 소비자·큰 메시지·동시 스트림을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 전송 흐름 제어는 바이트 수신을 조절하지만 앱이 이미 받은 메시지를 무한 큐에 쌓는 문제를 자동 해결하지 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: 여러 언어의 내부 서비스가 REST API로 통신합니다. gRPC로 바꾸면 계약 관리와 실행 비용에서 무엇이 달라지나요?](/tech-interview/questions/grpc-rest-contracts/)
