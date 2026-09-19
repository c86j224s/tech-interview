---
id: http-content-vs-transfer-coding
title: HTTP 응답을 gzip으로 줄이는 Content-Encoding과 chunked Transfer-Encoding은 무엇을 각각 표현하나요?
difficulty: 하
category: 네트워크
tags:
  - HTTP
  - Content-Encoding
  - Transfer-Encoding
  - gzip
related:
  - http-content-negotiation
---
# HTTP 응답을 gzip으로 줄이는 Content-Encoding과 chunked Transfer-Encoding은 무엇을 각각 표현하나요?

## 구두 답변

Content-Encoding은 선택된 representation 자체에 적용한 변환을 설명하고, Transfer-Encoding은 HTTP/1.1 메시지를 현재 연결로 운반하는 framing을 설명합니다. HTML을 gzip한 뒤 chunked로 보낼 수 있지만 gzip 해제와 chunk 경계 제거는 다른 단계입니다. 수신자는 chunk framing을 제거한 뒤 content coding을 되돌려 원래 representation을 얻는다고 구분하겠습니다.

예를 들어 응답이 `Content-Type: text/html`, `Content-Encoding: gzip`, `Transfer-Encoding: chunked`라면 body의 의미는 gzip으로 변환된 HTML이고, chunk는 그 gzip bytes를 전송하는 조각입니다. chunk 경계가 HTML tag나 애플리케이션 message 경계를 보장하지는 않습니다. HTTP/2·HTTP/3는 HTTP/1.1 chunked framing을 그대로 사용하지 않으므로 이 헤더 조합을 모든 버전에 복사하지 않습니다.

프록시가 이미 gzip한 body를 다시 압축하거나 Content-Encoding을 갱신하지 않으면 복원이 깨집니다. 실제 진단에서는 HTTP version, Content-Encoding, Transfer-Encoding 또는 해당 버전의 framing, Content-Length·Vary를 함께 기록합니다.


따라서 장애 로그에는 “chunk parser가 종료 표식을 찾았는가”와 “content decoder가 gzip checksum을 통과했는가”를 따로 남겨야 합니다. chunk framing 오류는 HTTP/1.1 message 경계 문제이고, gzip 오류는 선택된 representation 변환 문제입니다. HTTP/2·3에서는 stream DATA 길이와 protocol framing을 관찰하되 `Transfer-Encoding: chunked`를 그대로 기대하지 않습니다.
## 득점 포인트

- representation 변환과 연결 전송 framing을 서로 다른 계층으로 설명합니다.
- chunk가 애플리케이션 message 경계를 만들지 않는다는 사례를 듭니다.
- HTTP/1.1 예를 HTTP/2·3 wire 규칙으로 일반화하지 않습니다.

## 감점 포인트

- chunked가 HTML을 압축하는 알고리즘이라고 합니다.
- gzip을 풀면 chunk framing도 자동으로 의미가 같다고 설명합니다.
- 모든 HTTP 버전에 Transfer-Encoding: chunked를 보낼 수 있다고 합니다.

## 더 파고들 거리

- body를 압축하는 프록시와 원본 서버가 동시에 동작할 때 어떤 헤더 불일치가 생기나요?
- 압축 뒤 Content-Length를 계산하지 못하는 streaming 응답은 어떤 framing을 선택하나요?
