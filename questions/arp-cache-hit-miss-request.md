---
id: arp-cache-hit-miss-request
title: 라우터가 다음 홉 IPv4 주소는 알지만 Ethernet MAC을 모릅니다. 데이터그램을 어떤 순서로 보낼까요?
difficulty: 하
category: 네트워크
tags:
  - ARP
  - next hop
  - cache
  - Ethernet
related: []
---
# 라우터가 다음 홉 IPv4 주소는 알지만 Ethernet MAC을 모릅니다. 데이터그램을 어떤 순서로 보낼까요?

## 구두 답변

주체를 “라우터나 호스트가 라우팅으로 선택한 immediate next hop”으로 잡으면 순서는 라우팅 결정, ARP cache 조회, miss일 때 request, reply에 따른 매핑 반영, Ethernet 전송입니다. 최종 목적지가 `198.51.100.40`이고 route가 `198.51.100.1`을 next hop으로 가리키는데 cache가 비어 있다면 `.40`이 아니라 `.1`의 MAC을 찾는 request를 현재 Ethernet에 broadcast합니다. `.1`이 `02:00:00:00:00:01`로 응답하면 그 매핑을 사용합니다. IP header의 destination은 계속 `.40`이고 첫 링크의 Ethernet destination만 gateway MAC입니다.

중간 상태를 표로 쓰면 `route: .40→.1`, `cache[.1]: miss`, `ARP request: tpa=.1, L2=broadcast`, `reply: sha=02:00:00:00:00:01`, `data: IP dst=.40/Ethernet dst=02:00:00:00:00:01`입니다. RFC 826은 routing이 next hop과 outgoing hardware를 먼저 정하고 translation table에 없으면 ARP를 생성하는 흐름을 설명하지만, OS가 miss datagram을 큐에 둘지 버릴지, 재시도 간격을 얼마로 할지는 공통으로 정하지 않습니다. 따라서 캡처에서는 route table과 cache를 먼저 읽고, request의 target protocol address가 next hop인지 확인한 뒤 reply 이후 원래 packet이 어떻게 방출되는지 구현 문서와 함께 봅니다. 라우터가 다음 링크로 전달할 때에는 그 링크에서 다시 해석합니다.

## 득점 포인트

- 최종 IP 목적지와 첫 링크의 Ethernet 목적지를 분리합니다.
- cache hit/miss 분기와 request의 target protocol address를 순서대로 제시합니다.
- RFC 826의 공통 규칙과 OS의 큐잉·재시도 정책을 구분합니다.

## 감점 포인트

- 원격 목적지 `.40`의 MAC을 첫 링크에서 직접 ARP한다고 답합니다.
- ARP가 라우팅 경로를 결정한다고 설명합니다.
- reply를 받으면 IP destination도 gateway IP로 바꾼다고 말합니다.

## 더 파고들 거리

- next hop MAC은 cache에 있지만 스위치 FDB가 다른 포트를 가리킬 때 어느 계층을 먼저 대조할까요?
- miss request가 반복될 때 VLAN 경계, prefix 오류, reply 유실을 어떤 packet 순서로 분리할까요?
