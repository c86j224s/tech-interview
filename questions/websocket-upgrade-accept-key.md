---
id: websocket-upgrade-accept-key
title: WebSocket client가 HTTP 101 응답을 받았는데도 곧바로 프레임을 보내면 안 되는 이유는 무엇인가요?
difficulty: 하
category: 네트워크
tags:
  - WebSocket
  - Upgrade
  - handshake
  - Sec-WebSocket-Accept
related:
  - http-sse-vs-websocket
---
# WebSocket client가 HTTP 101 응답을 받았는데도 곧바로 프레임을 보내면 안 되는 이유는 무엇인가요?

## 구두 답변

101이라는 status만으로 WebSocket framing으로 전환하면 안 됩니다. client는 `Upgrade: websocket`과 `Connection: Upgrade`가 맞는지, 자신이 보낸 `Sec-WebSocket-Key`에 대응하는 `Sec-WebSocket-Accept`를 계산해 일치하는지 확인한 뒤에야 frame parser를 켜야 합니다. HTTP 200 페이지나 proxy가 만든 임의의 101을 WebSocket peer의 수락으로 오해하면 HTTP body를 frame으로 해석하게 됩니다.

Accept는 client key와 RFC 6455의 고정 GUID를 이어 SHA-1·base64한 값으로 계산합니다. 예를 들어 client가 새로운 base64 key를 보냈는데 응답 Accept가 그 key와 맞지 않으면, server가 다른 요청에 답했거나 중간 장비가 handshake를 변형했을 가능성을 배제하지 못합니다. 이 경우 연결을 종료하고 frame을 보내지 않습니다.

이 검증은 server identity나 사용자 authorization을 대신하지 않습니다. TLS 인증서, Origin 정책, 세션 인증은 별도로 확인합니다. Accept가 맞는다는 사실은 해당 opening handshake와 응답이 상관된다는 뜻이지 “이 사용자가 방에 입장할 권한이 있다”는 뜻은 아닙니다.


RFC 예시의 key `dGhlIHNhbXBsZSBub25jZQ==`에 GUID를 붙여 SHA-1/base64하면 `s3pPLMBiTxaQ9kYGzzhZRbK+xOo=`가 됩니다. 이 값은 요청 key와 응답이 연결되었음을 확인하는 계산이지 server 인증서의 공개 키로 만든 서명이 아닙니다. 따라서 HTTPS 인증서 검증과 애플리케이션 세션 검사는 여전히 별도로 실패할 수 있습니다.
## 득점 포인트

- status 101, Upgrade/Connection, Accept 상관 검증을 순서로 답합니다.
- key→GUID→SHA-1→base64 계산의 목적을 설명합니다.
- handshake correlation과 TLS·Origin·애플리케이션 인증을 구분합니다.

## 감점 포인트

- 101이면 어떤 헤더와 body여도 WebSocket으로 전환합니다.
- Sec-WebSocket-Accept를 비밀번호나 server certificate라고 합니다.
- handshake 검증이 끝나기 전에 frame을 보내도 된다고 합니다.

## 더 파고들 거리

- subprotocol·extension 응답이 client가 요청한 범위와 다르면 어떤 단계에서 거절하나요?
- handshake 성공 뒤 malformed frame이 올 때 HTTP 실패와 어떻게 다른 로그를 남기나요?
