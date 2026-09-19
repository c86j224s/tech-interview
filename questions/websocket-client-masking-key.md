---
id: websocket-client-masking-key
title: WebSocket client가 TLS를 사용해도 outbound frame을 mask해야 하는 이유와 masking 방식은 무엇인가요?
difficulty: 하
category: 네트워크
tags:
  - WebSocket
  - masking
  - TLS
  - frame
related: []
---
# WebSocket client가 TLS를 사용해도 outbound frame을 mask해야 하는 이유와 masking 방식은 무엇인가요?

## 구두 답변

RFC 6455는 TLS 사용 여부와 관계없이 client가 server로 보내는 모든 frame을 mask하도록 합니다. masking은 암호화나 인증이 아니라, 악성 client가 wire에 나타날 바이트를 선택해 중간 proxy의 HTTP-like parsing을 오해시키는 상황을 줄이는 framing 규칙입니다. frame마다 fresh하고 예측하기 어려운 32-bit key를 고르고 payload 각 byte를 key의 위치별 byte와 XOR합니다. server가 보내는 frame은 mask하지 않아야 합니다.

key가 `[10,20,30,40]`이고 payload가 `[41,42,43,44,45]`(16진수)라면 반복 key `[10,20,30,40,10]`과 XOR해 `[51,62,73,04,55]`가 됩니다. receiver는 같은 key를 다시 XOR해 원래 값을 얻습니다. 이 계산은 설명용이며, masking 자체가 TLS의 confidentiality·server authentication을 대신하지 않습니다. TLS를 쓰더라도 protocol masking 의무는 남습니다.

client가 unmasked frame을 보내면 server endpoint는 정상 application message로 넘기지 않고 WebSocket connection을 fail/terminate해야 합니다. server가 masked frame을 보내면 client도 동일하게 연결을 종료해야 하며, RFC 6455는 protocol error에 close code 1002를 사용할 수 있게 합니다. 단순 로그만 남기고 계속 읽으면 방향 계약 위반을 다음 parser 상태로 전파하게 됩니다.


masking key는 frame payload 길이에 포함되지 않고 key 자체는 frame 안에 별도 실립니다. 수신자는 header에서 MASK 비트를 확인한 뒤 key를 읽고, payload의 각 위치에 같은 modulo 4 XOR를 적용합니다. client의 unmasked frame이나 server의 masked frame을 계속 전달하면 방향별 protocol contract를 깨뜨리므로 endpoint가 fail/terminate해야 하며, 구현은 필요하면 1002 close를 보낼 수 있습니다.
## 득점 포인트

- TLS와 무관한 client→server masking 의무와 server→client unmasked 방향을 설명합니다.
- 32-bit fresh key, 강한 entropy, 위치 `i mod 4`, XOR 복원 계산을 제시합니다.
- 방향별 mask 위반 시 endpoint가 연결을 fail/terminate하고 1002를 사용할 수 있음을 언급합니다.

## 감점 포인트

- masking이 payload를 암호화해 도청을 막거나 server 인증을 제공한다고 합니다.
- 하나의 key를 connection 전체에 재사용하거나 예측 가능한 key를 만듭니다.
- server→client frame도 반드시 mask해야 한다고 하거나 위반을 로그만 남기는 문제로 축소합니다.

## 더 파고들 거리

- masking key 예측 가능성이 proxy 오해 방지 목적을 어떻게 약화시키며 강한 entropy가 필요한 이유는 무엇인가요?
- frame payload가 fragmentation된 message의 일부일 때 masking 해제와 message 조립, control-frame 처리를 어떤 순서로 분리하나요?
