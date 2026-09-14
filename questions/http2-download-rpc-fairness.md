---
id: "http2-download-rpc-fairness"
title: "큰 다운로드와 짧은 RPC가 한 HTTP/2 연결을 공유합니다. 우선순위·대역폭·버퍼의 공정성을 어떻게 측정하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["HTTP/2","TCP","선두 지연","심화 질문"]
related: ["http2-head-of-line-blocking","tcp-flow-vs-congestion-control"]
promotedFrom: {"id":"http2-head-of-line-blocking","prompt":"큰 다운로드와 짧은 RPC를 같은 연결에 둘 때 공정성을 어떤 분포로 측정할까요?"}
---

# 큰 다운로드와 짧은 RPC가 한 HTTP/2 연결을 공유합니다. 우선순위·대역폭·버퍼의 공정성을 어떻게 측정하나요?

## 구두 답변

큰 stream이 연결·앱 버퍼를 점유하면 짧은 RPC가 늦어질 수 있습니다. protocol priority 지원과 실제 서버 scheduler의 동작을 확인하고 byte·CPU·연결 예산을 측정합니다.

응답 크기·동시 stream·손실·느린 reader를 바꿔 p99를 비교합니다. 별도 연결·pool·endpoint 격리는 비용을 늘리므로 효과를 검증합니다. 가장 먼저 완료한 요청 수만으로 공정성을 판단하지 않습니다.

## 득점 포인트

- 큰 stream이 연결·앱 버퍼를 점유하면 짧은 RPC가 늦어질 수 있습니다. protocol priority 지원과 실제 서버 scheduler의 동작을 확인하고 byte·CPU·연결 예산을 측정합니다.
- 가장 먼저 완료한 요청 수만으로 공정성을 판단하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 큰 stream이 연결·앱 버퍼를 점유하면 짧은 RPC가 늦어질 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: HTTP/2로 여러 요청을 한 TCP 연결에서 동시에 보냅니다. 패킷 하나가 유실됐을 때 왜 다른 요청까지 지연될 수 있나요?](/tech-interview/questions/http2-head-of-line-blocking/)
