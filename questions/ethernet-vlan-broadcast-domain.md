---
id: ethernet-vlan-broadcast-domain
title: 같은 IPv4 대역을 쓰는 두 호스트를 서로 다른 VLAN에 넣으면 왜 ARP broadcast가 도달하지 않나요?
difficulty: 하
category: 네트워크
tags:
  - VLAN
  - broadcast domain
  - ARP
  - 서브넷
related: []
---
# 같은 IPv4 대역을 쓰는 두 호스트를 서로 다른 VLAN에 넣으면 왜 ARP broadcast가 도달하지 않나요?

## 구두 답변

VLAN이 L2 broadcast domain을 나누기 때문입니다. A와 B가 모두 `192.0.2.0/24`라고 설정되어 있어도 A가 VLAN 10, B가 VLAN 20에만 있다면 A는 B를 on-link로 판단해 VLAN 10에서 `who-has 192.0.2.20`을 broadcast합니다. 스위치는 그 broadcast를 VLAN 10의 허용 포트로만 flooding하므로 VLAN 20의 B에는 전달하지 않습니다. 따라서 “같은 IP 대역”이라는 설정과 “같은 L2 링크”라는 실제 조건이 어긋난 주소 설계가 문제입니다.

예를 들어 VLAN 10 캡처에는 request가 보이고 VLAN 20의 B 포트에는 같은 request가 보이지 않습니다. A가 retry를 반복한다고 해서 B가 꺼졌다는 뜻은 아닙니다. 먼저 host prefix, ingress VLAN, trunk 허용 목록을 확인하고, 일반적인 설계에서는 VLAN별 IP subnet을 정렬합니다. VLAN 간 통신이 필요하면 SVI나 router에서 L3 forwarding과 ACL을 적용해야 합니다. proxy ARP나 특수 브리지 구성은 예외적으로 request/reply 관측을 바꿀 수 있으므로 그 설정도 함께 읽습니다. 단순히 trunk에서 VLAN 10과 20을 모두 허용하는 것은 두 broadcast domain을 합치지 않으며, 잘못된 on-link 판단도 자동으로 고치지 않습니다. 만약 A의 ARP request가 VLAN 10에서는 반복되고 B가 속한 VLAN 20의 캡처에는 전혀 없다면 L2 경계가 작동한 것입니다. 반대로 VLAN 20의 SVI에서 proxy ARP reply가 관찰되면 host가 받은 MAC이 B의 MAC인지 router의 MAC인지 다시 확인해야 하며, 그 이후의 통신은 별도의 L3 경로 검증으로 넘어갑니다.

## 득점 포인트

- ARP의 flooding 범위를 IP 숫자 대역이 아니라 L2 VLAN 문맥으로 설명합니다.
- on-link 판정과 VLAN 분리를 한 패킷 흐름으로 연결합니다.
- VLAN–subnet 정렬, L3 라우팅, proxy ARP를 각각 다른 조건으로 둡니다.

## 감점 포인트

- 같은 IPv4 대역이면 스위치가 VLAN을 넘어 ARP를 전달한다고 말합니다.
- trunk 허용만으로 서로 다른 VLAN이 자동으로 하나의 broadcast domain이 된다고 설명합니다.
- ARP request가 보이지 않는 즉시 상대 호스트 장애로 결론 냅니다.

## 더 파고들 거리

- proxy ARP가 켜지면 host와 SVI 캡처에서 request/reply의 target과 MAC이 어떻게 달라질까요?
- VLAN 간 라우팅을 열었는데도 실패할 때 ARP와 SVI ACL을 어느 순서로 확인할까요?
