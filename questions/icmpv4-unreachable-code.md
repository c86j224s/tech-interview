---
id: icmpv4-unreachable-code
title: IPv4 패킷이 도착하지 않았다는 ICMP Destination Unreachable을 받았습니다. code를 왜 구분해야 하나요?
difficulty: 하
category: 네트워크
tags:
  - ICMP
  - IPv4
  - Destination Unreachable
  - 진단
related: []
---
# IPv4 패킷이 도착하지 않았다는 ICMP Destination Unreachable을 받았습니다. code를 왜 구분해야 하나요?

## 구두 답변

IPv4 ICMP type 3은 하나의 실패가 아니라 code에 따라 원인이 달라지므로, code를 봐야 재시도·경로 수정·애플리케이션 확인 중 무엇을 할지 판단할 수 있습니다. code 0은 network unreachable, 1은 host unreachable, 2는 protocol unreachable, 3은 port unreachable, 4는 DF가 설정된 packet을 fragmentation할 수 없는 경우입니다. 같은 “Destination Unreachable”이라도 목적지 port가 닫힌 것과 경로 MTU가 작은 것은 전혀 다른 문제입니다.

예를 들어 UDP traceroute가 목적지의 닫힌 port로 도착하면 최종 호스트가 type 3/code 3을 보낼 수 있습니다. 이 경우 probe가 목적지까지 도달했고 해당 UDP port에 process가 없다는 종료 신호로 해석할 수 있습니다. 반대로 code 1이면 host까지의 route, ARP, 장비 상태 또는 필터를 확인해야 합니다. code 4라면 DF와 MTU·PMTUD를 조사하고 payload를 무작정 재전송하는 방식으로 해결하지 않습니다.

RFC 792는 gateway와 host가 보고할 수 있는 code의 맥락도 설명하지만, 실제 middlebox가 오류를 생성하거나 전달한다는 보장은 없습니다. 따라서 ICMP 오류가 없다고 경로가 정상이라고 단정하지 않고, 인용된 원래 IP header와 앞부분의 port를 원래 probe 로그와 맞춥니다.

재시도 정책도 code별로 달라집니다. port unreachable은 같은 목적지의 다른 서비스나 설정을 확인할 단서이지 동일 UDP 요청을 무한 재전송할 이유가 아닙니다. network 또는 host unreachable은 route와 이웃 계층을 확인하고, code 4는 전송 크기를 조정합니다. 오류가 인용한 tuple이 현재 probe와 다르면 해당 오류를 폐기해야 합니다.

## 득점 포인트

- type 3 code와 대응 조치를 분리합니다.
- 메커니즘의 중간 상태와 실패 경계를 실제 패킷 또는 상태 값으로 설명합니다.

## 감점 포인트

- 모든 type 3을 애플리케이션 장애로 해석하지 않습니다.
- 표준이 정하지 않은 구현 정책을 모든 운영체제의 고정 규칙으로 일반화하지 않습니다.

## 더 파고들 거리

- code 4와 IPv6 type 2의 차이를 비교해 보세요.
- 정상 관찰과 오류 부재를 구분하는 추가 로그나 캡처 항목을 제시해 보세요.
