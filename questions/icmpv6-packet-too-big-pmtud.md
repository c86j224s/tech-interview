---
id: icmpv6-packet-too-big-pmtud
title: IPv6 경로에서 큰 응답만 멈추고 작은 요청은 성공합니다. ICMPv6 Packet Too Big은 무엇을 알려 주나요?
difficulty: 중하
category: 네트워크
tags:
  - ICMPv6
  - PMTUD
  - MTU
  - Packet Too Big
related:
  - network-mtu-pmtud
---
# IPv6 경로에서 큰 응답만 멈추고 작은 요청은 성공합니다. ICMPv6 Packet Too Big은 무엇을 알려 주나요?

## 구두 답변

ICMPv6 Packet Too Big(type 2)은 라우터가 outgoing link의 MTU보다 큰 packet을 forwarding할 수 없어 폐기했다는 신호입니다. 메시지에는 next-hop link의 MTU가 들어가고, 송신자는 이를 path MTU discovery에 사용해 이후 packetization이나 TCP segment 크기를 줄여야 합니다. IPv6 router가 중간에서 일반 packet을 fragmentation하지 않기 때문에 이 피드백이 차단되면 작은 요청은 성공하고 큰 TLS 응답만 멈추는 black hole이 생길 수 있습니다.

예를 들어 송신 packet이 1500바이트이고 터널 뒤 next-hop MTU가 1280이라면 router는 type 2와 MTU 1280을 source에게 보낼 수 있습니다. 송신자는 1280 이하의 IPv6 packet으로 나누거나 상위 전송 계층이 그 경로에 맞춰 보내게 해야 합니다. 여기서 MTU 전체와 TCP MSS payload를 같은 값으로 보면 안 됩니다. VPN·GRE·overlay header도 유효 payload를 줄입니다.

진단할 때는 ICMPv6 source, MTU field, 인용된 원래 packet, 캡슐화 경로와 PMTU cache를 함께 확인합니다. 오류가 없다고 MTU 문제가 없다는 뜻은 아닙니다. RFC 4443은 ICMPv6 error rate limiting을 요구하고, 방화벽이 Packet Too Big을 차단하면 송신자는 단순 timeout만 볼 수 있습니다. 애플리케이션 timeout을 늘리는 것은 폐기된 packet을 다시 전달하지 못하므로 근본 해결이 아닙니다.

예상 상태는 송신자의 PMTU cache가 1500에서 1280으로 낮아지는 것이지만, 이 수치는 해당 경로와 시점에 종속된 후보입니다. 다른 목적지나 다른 연결이 같은 값을 공유한다고 가정하지 않습니다. 캡처에서 인용된 packet의 tuple과 type 2의 MTU를 연결하고, 새 크기의 packet이 실제로 통과하는지 작은 단계로 재검증해야 합니다.

## 득점 포인트

- type 2 MTU field와 PMTU cache 갱신을 연결합니다.
- 메커니즘의 중간 상태와 실패 경계를 실제 패킷 또는 상태 값으로 설명합니다.

## 감점 포인트

- timeout만으로 Packet Too Big을 확정하지 않습니다.
- 표준이 정하지 않은 구현 정책을 모든 운영체제의 고정 규칙으로 일반화하지 않습니다.

## 더 파고들 거리

- MTU와 MSS가 다른 수치인 이유를 설명해 보세요.
- 정상 관찰과 오류 부재를 구분하는 추가 로그나 캡처 항목을 제시해 보세요.
