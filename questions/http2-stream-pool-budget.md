---
id: "http2-stream-pool-budget"
title: "HTTP/2 연결 수는 적지만 스트림이 많습니다. 연결 풀과 스트림 동시성을 하위 용량에 어떻게 맞추나요?"
difficulty: "중하"
category: "네트워크"
tags: ["HTTP","연결 풀","타임아웃","심화 질문"]
related: ["http-connection-pool","bounded-queue-backpressure"]
promotedFrom: {"id":"http-connection-pool","prompt":"HTTP/2 최대 스트림과 연결 풀 상한을 하위 서비스의 CPU·메모리와 어떻게 맞출까요?"}
---

# HTTP/2 연결 수는 적지만 스트림이 많습니다. 연결 풀과 스트림 동시성을 하위 용량에 어떻게 맞추나요?

## 구두 답변

연결 하나에 많은 stream이 있으면 소켓 수는 작아도 CPU·메모리·DB 호출이 많아집니다. per-connection stream 한도와 서비스 전체 in-flight·queue 예산을 함께 둡니다.

서버 SETTINGS·client pool·프록시 동작을 확인하고 큰·작은 요청을 섞어 측정합니다. 연결 증설로 HOL 영향을 줄일 수 있어도 handshake·FD·혼잡 경쟁이 늘 수 있습니다. stream 종료와 외부 작업 취소도 구분합니다.

## 득점 포인트

- 연결 하나에 많은 stream이 있으면 소켓 수는 작아도 CPU·메모리·DB 호출이 많아집니다. per-connection stream 한도와 서비스 전체 in-flight·queue 예산을 함께 둡니다.
- stream 종료와 외부 작업 취소도 구분합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 연결 하나에 많은 stream이 있으면 소켓 수는 작아도 CPU·메모리·DB 호출이 많아집니다.

## 더 파고들 거리

- [기본 상황과 비교: 외부 HTTP 호출에서 연결 풀 대기가 늘었습니다. 연결 수를 늘려도 되는 경우와 오히려 줄여야 하는 경우는 어떻게 구분하나요?](/tech-interview/questions/http-connection-pool/)
