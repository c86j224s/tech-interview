---
id: "ring-buffer-parser-view-lifetime"
title: "수신 ring buffer의 일부를 복사 없이 파싱 결과로 넘깁니다. wrap·확장·재사용에서 참조 수명을 어떻게 보호하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["TCP","소켓","바이트 스트림","메시지 프레이밍","버퍼","백프레셔","심화 질문"]
related: ["tcp-stream-message-framing","io-readiness-vs-completion","request-timeout-idempotency"]
promotedFrom: {"id":"tcp-stream-message-framing","prompt":"링 버퍼나 scatter/gather를 쓰면서 파싱 결과와 수신 버퍼 수명을 어떻게 관리할까요?"}
---

# 수신 ring buffer의 일부를 복사 없이 파싱 결과로 넘깁니다. wrap·확장·재사용에서 참조 수명을 어떻게 보호하나요?

## 구두 답변

파싱 결과가 수신 buffer의 view라면 소비자가 끝나기 전에 wrap·확장·pool 반환으로 bytes를 덮으면 안 됩니다. 참조 보유·소유권 이동·복사 중 요구에 맞는 방식을 정합니다.

길이 헤더·부분 frame·여러 frame과 실제 메모리 범위를 검사합니다. ring의 두 조각을 하나의 연속 메모리처럼 오인하지 않습니다. 느린 소비자의 보유 바이트와 backpressure를 제한합니다.

## 득점 포인트

- 파싱 결과가 수신 buffer의 view라면 소비자가 끝나기 전에 wrap·확장·pool 반환으로 bytes를 덮으면 안 됩니다. 참조 보유·소유권 이동·복사 중 요구에 맞는 방식을 정합니다.
- 느린 소비자의 보유 바이트와 backpressure를 제한합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 파싱 결과가 수신 buffer의 view라면 소비자가 끝나기 전에 wrap·확장·pool 반환으로 bytes를 덮으면 안 됩니다.

## 더 파고들 거리

- [기본 상황과 비교: TCP로 메시지를 두 번 보내면 받는 쪽에서도 두 번에 나눠 읽게 되나요?](/tech-interview/questions/tcp-stream-message-framing/)
