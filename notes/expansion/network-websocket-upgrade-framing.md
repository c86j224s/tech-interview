---
id: network-websocket-upgrade-framing
title: WebSocket upgrade와 마스킹·fragmentation
topic: 네트워크
summary: >-
  WebSocket opening handshake의 수락 검증, client frame masking, fragmented message와
  continuation, control frame의 삽입·크기 제한을 연결해 설명합니다.
questionIds: []
prerequisites:
  - tcp
  - http-cache
related:
  - event-stream-recovery
reviewedAt: '2026-09-19'
---
# WebSocket upgrade와 마스킹·fragmentation

WebSocket은 처음부터 임의의 바이트 프레임이 흐르는 별도 TCP 연결이 아니라, HTTP opening handshake를 성공적으로 마친 뒤 framing 규칙을 전환하는 프로토콜입니다. client는 서버의 HTTP 101 응답이 단순한 숫자만 맞는지 보지 않고 Upgrade·Connection 헤더와 자신이 보낸 `Sec-WebSocket-Key`에 대응하는 `Sec-WebSocket-Accept`를 검증해야 합니다. 연결이 WebSocket으로 전환된 뒤에는 client가 보내는 모든 frame을 mask하고, 큰 message는 첫 frame의 opcode와 continuation frame으로 분할할 수 있습니다. Ping·Pong·Close 같은 control frame은 fragmented data message 중간에 끼어들 수 있지만, 스스로 fragment될 수 없고 payload가 125 bytes 이하여야 합니다.

## HTTP opening handshake

client는 HTTP/1.1 요청에 `Upgrade: websocket`, `Connection: Upgrade`, `Sec-WebSocket-Key`, `Sec-WebSocket-Version` 등을 보냅니다. server가 protocol을 수락하면 101 Switching Protocols와 대응 헤더를 반환합니다. `Sec-WebSocket-Accept`는 client key에 RFC 6455의 고정 GUID를 이어 붙이고 SHA-1을 적용한 뒤 base64로 표현한 값입니다. 이 계산은 TLS 인증서나 사용자 인증이 아니라, server가 요청의 key를 보고 같은 handshake를 처리했는지 상관시키는 절차입니다.

client는 101이라는 status만으로 framing 단계로 넘어가면 안 됩니다. Upgrade가 websocket인지, Connection 토큰이 upgrade를 포함하는지, Accept가 자신이 계산한 값과 같은지, subprotocol·extension 응답이 요청한 것과 허용 가능한 범위인지 확인합니다. HTTP 200 로그인 페이지나 proxy가 만든 임의 101은 WebSocket peer의 수락 증거가 아닙니다. 검증 실패 때는 body를 frame으로 해석하지 않고 연결을 닫습니다.

`Sec-WebSocket-Accept`가 맞아도 server identity가 증명된 것은 아닙니다. TLS를 사용하면 인증서 검증이 별도로 필요하고, 브라우저 환경에서는 Origin 정책과 애플리케이션 세션·권한도 따로 확인해야 합니다. handshake 상관값을 인증 토큰이나 접근 제어로 설명하면 보안 경계를 과장하게 됩니다.

## Frame과 message의 경계

WebSocket frame은 wire 단위이고 message는 애플리케이션에 전달되는 논리 단위입니다. 작은 텍스트 message는 FIN=1, opcode=0x1인 한 frame으로 보낼 수 있습니다. 큰 message는 첫 frame에 text 또는 binary opcode를 넣고 FIN=0으로 시작한 뒤, 이어지는 frame에는 opcode=0인 continuation을 사용하며 마지막 continuation에서 FIN=1로 끝냅니다. message type은 첫 frame이 결정합니다.

예를 들어 텍스트 message `HELLO`를 `HE`, `LL`, `O`로 나눈다면 다음 상태입니다.

| 순서 | FIN | opcode | payload | 수신 의미 |
| --- | ---: | ---: | --- | --- |
| 1 | 0 | 0x1 | `HE` | text message 시작 |
| 2 | 0 | 0x0 | `LL` | continuation |
| 3 | 1 | 0x0 | `O` | message 완료 |

애플리케이션이 frame 한 개를 message 한 개로 가정하면 첫 frame만 받고 불완전한 UTF-8이나 부분 JSON을 처리하는 버그가 생깁니다. 반대로 receiver는 fragmented·unfragmented 양쪽을 모두 받아야 합니다. 중간 장비가 임의로 fragmentation을 합치거나 쪼갤 수 있다는 가정도 extension과 RFC 규칙을 확인하지 않고 하면 안 됩니다.

## Client masking의 목적과 계산

RFC 6455는 TLS 여부와 관계없이 client-to-server frame을 mask하도록 합니다. mask는 암호화나 인증이 아니라, client가 보낸 바이트가 중간 proxy의 HTTP-like parsing과 예측 가능한 패턴을 악용하지 못하게 하는 framing 안전 장치입니다. server-to-client frame은 mask하지 않아야 하며, client가 masked server frame을 받으면 protocol 오류로 처리합니다.

각 client frame에는 fresh하고 예측하기 어려운 32-bit masking key가 포함됩니다. payload byte 위치를 `i`, key의 네 byte 중 선택할 위치를 `j = i mod 4`라 하면 wire byte는 `original[i] XOR key[j]`입니다. receiver는 같은 XOR를 다시 적용해 원문을 얻습니다.

예를 들어 key bytes가 `[0x10, 0x20, 0x30, 0x40]`, payload가 `[0x41, 0x42, 0x43, 0x44, 0x45]`라면 설명용 계산은 다음과 같습니다.

```text
payload : 41 42 43 44 45
key     : 10 20 30 40 10
masked  : 51 62 73 04 55
```

실제로는 cryptographically strong entropy에서 key를 얻어야 하며 frame마다 재사용하지 않습니다. 같은 key를 반복하면 XOR 관계가 노출되고 RFC의 fresh key 조건을 위반합니다. masking key 자체가 confidentiality를 제공하지 않으므로 민감한 내용은 TLS에 의존해야 합니다.

## Fragmentation과 control interleaving

fragmentation의 중요한 이유는 송신자가 거대한 message 전체를 buffer하지 않고 일부를 보내면서 Ping 등의 latency도 줄이는 데 있습니다. data message가 진행 중이어도 control frame은 interleave할 수 있습니다. 따라서 receiver는 `text fragment → Ping → continuation → Pong → continuation` 같은 순서를 처리하면서 기존 message 조립 상태를 보존해야 합니다.

Ping은 control frame이므로 FIN=1이어야 하고 payload length가 125 bytes 이하여야 합니다. Pong과 Close도 같은 control frame 제한을 따릅니다. control frame이 message 조립 중간에 들어갈 수 있다는 규칙을 무시하면 큰 message를 보내는 동안 heartbeat가 지연되고, proxy timeout이나 연결 생존 판정이 늦어집니다.

```diagram
{"title":"하나의 message 안에 control frame이 끼어듭니다","caption":"첫 data frame이 message type을 정하고 continuation이 나머지를 잇습니다. Ping은 조립 상태를 끊지 않고 별도로 처리하며 control frame 자체는 분할하지 않습니다.","rows":[[{"id":"start","label":"첫 data frame","detail":["FIN=0 · opcode=text"]}],[{"id":"ping","label":"Ping control","detail":["FIN=1 · payload ≤125"]},{"id":"cont","label":"Continuation","detail":["opcode=0"]}],[{"id":"finish","label":"마지막 continuation","detail":["FIN=1 · message 완료"]}]],"edges":[{"from":"start","to":"ping","label":"message 진행 중"},{"from":"start","to":"cont","label":"다음 조각"},{"from":"ping","to":"finish","label":"Ping 처리 후 조립 유지"},{"from":"cont","to":"finish","label":"마지막 조각"}]}
```

control frame interleaving은 protocol frame과 애플리케이션 message를 같은 queue에서 단순 문자열로 이어 붙이는 설계와 충돌합니다. parser는 먼저 header의 FIN, RSV, opcode, MASK, payload length를 읽고 control/data 종류별로 길이·mask 규칙을 검사해야 합니다. extension이 RSV bit나 fragmentation 의미를 바꾸면 handshake에서 협상한 extension 계약을 적용합니다.

## Frame parser의 상태 추적

수신 parser는 `idle`, `message-open(text|binary)`, `closed`와 같은 상태를 둡니다. idle에서 text/binary data frame의 FIN=0이 오면 message-open으로 이동하고, message-open에서는 opcode=0 continuation만 허용합니다. FIN=1 continuation이면 message를 application에 전달하고 idle로 돌아갑니다. idle에서 continuation을 받거나 message-open 중 새 data opcode가 오면 protocol error 후보입니다.

control frame은 어느 data 상태에서도 별도 경로로 처리하되 FIN=1, length≤125를 확인합니다. client→server 방향이면 MASK=1이어야 하고 server→client면 MASK=0이어야 합니다. 이 상태 추적은 byte stream이 message boundary를 보장하지 않는 TCP의 성질과 연결됩니다. 한 `recv` 호출이 frame 하나를 온전히 주지 않으므로 header와 payload를 부분적으로 버퍼링해야 합니다.

## Handshake·framing 실패 진단

연결 직후 close가 발생하면 HTTP status, Upgrade/Connection, key·Accept 계산, TLS·Origin·subprotocol 결과를 먼저 분리합니다. handshake가 성공한 뒤 close라면 frame opcode, RSV extension, payload length, mask 방향, continuation 순서를 확인합니다. “WebSocket 연결이 끊겼다”만으로 하나의 원인으로 묶으면 proxy 101 응답 문제와 malformed frame을 구분하지 못합니다.

큰 text message를 세 frame으로 보내고 그 사이에 Ping을 넣는 테스트에서 receiver는 text payload를 정확히 원래 순서로 복원하고 Ping을 즉시 처리해야 합니다. server가 masked frame을 보내거나 client가 unmasked frame을 보내는 경우에는 정상 message로 전달하지 않아야 합니다. handshake의 `Sec-WebSocket-Accept` 계산은 실제 client key를 넣어 독립 구현과 비교할 수 있지만, 이 문서에서는 설명용 예시만 제시하며 실행 결과를 주장하지 않습니다.

## 구현 선택과 비용

메시지 전체를 memory에 모으면 애플리케이션 처리가 단순하지만 큰 message가 memory budget을 넘을 수 있습니다. streaming 조립은 memory 상한을 관리하기 좋지만 UTF-8 검증, 확장 데이터, 부분 JSON 처리, 취소 시 정리 상태가 복잡해집니다. control frame을 별도 우선 처리하면 heartbeat latency를 낮출 수 있으나, data fragment와의 순서·동시성 계약을 명확히 해야 합니다.

masking은 client CPU와 wire payload의 4-byte key를 추가하지만 protocol 필수 규칙입니다. TLS가 있어도 끌 수 있는 최적화로 취급하지 않습니다. compression extension을 사용하면 payload 해석과 fragmentation 관계가 바뀔 수 있으므로, negotiated extension이 적용되는 범위와 message 단위 상태를 확인합니다.

참고한 RFC 6455 본문에서 opening handshake와 Accept 검증(§4.2·§11.3.3), masking key와 XOR(§5.3), fragmentation과 continuation·control interleaving 및 125-byte 제한(§5.4·§5.5)을 확인했습니다. 후속 extension과 RFC 업데이트는 base framing 범위를 넘어갈 수 있으므로 제품 library가 협상한 기능을 별도로 검토해야 합니다.

### 참고 경로

- [https://www.rfc-editor.org/rfc/rfc6455](https://www.rfc-editor.org/rfc/rfc6455)

위 링크는 개념별 참고 경로이며, 본문에서 명시한 확인 범위와 미확인 구현 조건을 함께 적용합니다.
