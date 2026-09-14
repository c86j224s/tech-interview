---
id: "database-streaming-client-backpressure"
title: "큰 DB 결과를 느린 클라이언트에 스트리밍합니다. 연결 보유와 버퍼·취소를 어떻게 제한하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["연결 풀","트랜잭션","타임아웃","심화 질문"]
related: ["db-pool-long-transactions","bounded-queue-backpressure"]
promotedFrom: {"id":"db-pool-long-transactions","prompt":"스트리밍 결과가 연결을 장시간 점유하는 경로를 측정해 보세요."}
---

# 큰 DB 결과를 느린 클라이언트에 스트리밍합니다. 연결 보유와 버퍼·취소를 어떻게 제한하나요?

## 구두 답변

DB cursor·연결을 빌린 채 느린 client에 전송하면 쿼리가 끝나도 연결 보유가 길 수 있습니다. 제한된 읽기 batch·버퍼와 client backpressure, 최대 전송 수명을 연결합니다.

전체 결과를 메모리에 모으면 연결은 빨리 반환해도 메모리 피크가 커집니다. 별도 비동기 export나 객체 저장소 다운로드도 대안입니다. client 취소 뒤 cursor·transaction·드라이버 응답 정리가 끝났는지 확인하고 불확실한 연결은 재사용하지 않습니다.

## 득점 포인트

- DB cursor·연결을 빌린 채 느린 client에 전송하면 쿼리가 끝나도 연결 보유가 길 수 있습니다. 제한된 읽기 batch·버퍼와 client backpressure, 최대 전송 수명을 연결합니다.
- client 취소 뒤 cursor·transaction·드라이버 응답 정리가 끝났는지 확인하고 불확실한 연결은 재사용하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: DB cursor·연결을 빌린 채 느린 client에 전송하면 쿼리가 끝나도 연결 보유가 길 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: DB 연결 풀 대기는 늘고 쿼리는 짧을 때, 풀을 키우기 전에 어떤 연결 보유 경로와 트랜잭션을 확인하나요?](/tech-interview/questions/db-pool-long-transactions/)
