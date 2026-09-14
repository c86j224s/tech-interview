---
id: "http2-stream-connection-flow-windows"
title: "HTTP/2의 스트림 창은 남았는데 전송이 멈춥니다. 스트림별·연결별 흐름 제어 창은 어떻게 함께 적용되나요?"
difficulty: "중하"
category: "네트워크"
tags: ["HTTP/2","TCP","선두 지연","심화 질문"]
related: ["http2-head-of-line-blocking","tcp-flow-vs-congestion-control"]
promotedFrom: {"id":"http2-head-of-line-blocking","prompt":"HTTP/2의 스트림별 흐름 제어와 연결별 흐름 제어가 함께 막히는 순서를 설명해 보세요."}
---

# HTTP/2의 스트림 창은 남았는데 전송이 멈춥니다. 스트림별·연결별 흐름 제어 창은 어떻게 함께 적용되나요?

## 구두 답변

HTTP/2 DATA 전송은 스트림 창과 연결 창 모두의 여유에 제한됩니다. 한 스트림에 여유가 있어도 연결 창이 소진되면 그 연결의 데이터 전송이 멈출 수 있습니다.

수신자의 읽기와 WINDOW_UPDATE, 큰 스트림의 버퍼 점유를 확인합니다. HTTP 흐름 제어와 TCP 혼잡·수신 창은 별도이며 앱 큐 상한도 필요합니다.

## 득점 포인트

- HTTP/2 DATA 전송은 스트림 창과 연결 창 모두의 여유에 제한됩니다. 한 스트림에 여유가 있어도 연결 창이 소진되면 그 연결의 데이터 전송이 멈출 수 있습니다.
- HTTP 흐름 제어와 TCP 혼잡·수신 창은 별도이며 앱 큐 상한도 필요합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: HTTP/2 DATA 전송은 스트림 창과 연결 창 모두의 여유에 제한됩니다.

## 더 파고들 거리

- [기본 상황과 비교: HTTP/2로 여러 요청을 한 TCP 연결에서 동시에 보냅니다. 패킷 하나가 유실됐을 때 왜 다른 요청까지 지연될 수 있나요?](/tech-interview/questions/http2-head-of-line-blocking/)
