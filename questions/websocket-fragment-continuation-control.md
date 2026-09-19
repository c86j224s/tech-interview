---
id: websocket-fragment-continuation-control
title: 큰 WebSocket message를 세 frame으로 나누는 동안 Ping이 끼어들 수 있나요?
difficulty: 중하
category: 네트워크
tags:
  - WebSocket
  - fragmentation
  - continuation
  - Ping
related:
  - websocket-heartbeat-reconnect
---
# 큰 WebSocket message를 세 frame으로 나누는 동안 Ping이 끼어들 수 있나요?

## 구두 답변

가능합니다. 첫 data frame이 text 또는 binary opcode와 `FIN=0`으로 message를 시작하고, continuation frame들이 그 message를 이어갑니다. RFC 6455는 fragmented message 중간에 control frame을 넣을 수 있게 하므로 Ping은 조립 중간에 처리할 수 있습니다. 다만 Ping은 text message의 세 번째 조각이 아닙니다. 예시는 `text(FIN=0, opcode=1) → continuation(FIN=0, opcode=0) → Ping(FIN=1, opcode=9) → continuation(FIN=1, opcode=0)` 순서이며, Ping은 별도의 control frame이고 마지막 continuation이 message를 완성합니다.

control frame은 fragmentation할 수 없고 payload가 125 bytes 이하여야 합니다. 수신자는 Ping을 처리하면서 text fragment 상태를 유지하고, 마지막 continuation의 payload를 앞선 data fragment 뒤에 이어 애플리케이션 message로 전달합니다. frame boundary와 message boundary를 같게 보면 첫 조각만으로 JSON·UTF-8을 처리하는 오류가 생깁니다. TCP read 경계도 frame 경계를 보장하지 않으므로 parser는 partial header·payload를 버퍼링해야 합니다.

extension이 협상되면 extension data가 각 fragment에 적용되는 방식과 interleaving 허용 범위를 확인해야 합니다. 그렇지 않은 base framing에서는 다른 message의 data fragment를 끼워 넣지 않고, control frame만 중간에 처리합니다.

## 득점 포인트

- 첫 data opcode, continuation opcode, FIN을 실제 frame 순서로 추적하고 Ping을 message 조각 수에 포함하지 않습니다.
- control frame interleaving과 `FIN=1`, 125-byte 이하, unfragmented 제한을 연결합니다.
- frame·message·TCP read의 경계가 다르므로 parser가 조립 상태를 유지해야 한다고 설명합니다.

## 감점 포인트

- Ping을 text payload에 이어 붙이거나 `FIN=1, opcode=9`를 text message의 세 번째 fragment라고 셉니다.
- message가 반드시 한 frame이라고 하거나 continuation 없이 두 번째 text opcode를 보냅니다.
- control frame을 큰 payload로 쪼개거나 TCP `recv` 한 번이 frame 하나라고 가정합니다.

## 더 파고들 거리

- fragmentation 중 Ping 처리가 지연되면 proxy idle timeout과 heartbeat 판단이 어떻게 달라지나요?
- continuation 순서가 깨지거나 message-open 상태에서 새 data opcode가 오면 parser는 어떤 protocol error와 close 처리를 적용하나요?
