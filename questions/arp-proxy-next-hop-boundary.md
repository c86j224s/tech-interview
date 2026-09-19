---
id: arp-proxy-next-hop-boundary
title: 호스트가 원격 서브넷의 주소를 ARP로 찾으려 합니다. 실제로는 누구의 MAC을 알아야 하나요?
difficulty: 하
category: 네트워크
tags:
  - ARP
  - 라우팅
  - default gateway
  - proxy ARP
related: []
---
# 호스트가 원격 서브넷의 주소를 ARP로 찾으려 합니다. 실제로는 누구의 MAC을 알아야 하나요?

## 구두 답변

일반적인 host routing에서는 원격 호스트의 MAC이 아니라 현재 링크에 붙은 router next hop의 MAC을 알아야 합니다. `10.0.1.20/24`가 `10.0.2.30`으로 보낼 때 `.30`은 `10.0.1.0/24`에 속하지 않으므로 route는 `10.0.1.1` 같은 default gateway를 고릅니다. 따라서 첫 ARP request의 target protocol address는 `.1`이고, 첫 Ethernet frame의 destination은 gateway MAC입니다. IP packet의 destination `.30`은 바뀌지 않습니다. router가 다음 링크로 내보낼 때에는 해당 링크에서 새 Ethernet header와 next-hop 해석을 사용합니다.

proxy ARP가 설정되면 router가 `.30`을 대신해 자신의 MAC으로 응답할 수 있습니다. 이 경우 host의 request target이 원격 주소 `.30`으로 보일 수 있지만, packet은 여전히 router의 L3 forwarding과 ACL을 통과해야 합니다. proxy ARP는 라우팅이나 보안 정책을 우회시키는 기능이 아닙니다. 진단할 때는 host route table과 prefix를 먼저 읽고, request target이 gateway인지 원격 주소인지, reply MAC이 누구인지, gateway의 ingress/egress가 실제로 이어지는지 확인합니다. proxy ARP의 응답 범위와 기본값은 RFC 826의 기본 request/reply와 동일한 보편 규칙이 아니라 구현·설정 사항입니다.

## 득점 포인트

- on-link 판정 뒤 next hop을 ARP한다는 순서를 설명합니다.
- IP destination `.30`과 링크별 Ethernet destination을 분리합니다.
- proxy ARP를 예외적인 응답 방식으로 설명하되 L3 forwarding·ACL을 유지합니다.

## 감점 포인트

- 원격 호스트의 MAC을 현재 LAN에서 직접 찾는다고 말합니다.
- proxy ARP가 router와 ACL을 우회한다고 설명합니다.
- route table 없이 ARP 캡처만으로 next hop을 확정합니다.

## 더 파고들 거리

- proxy ARP가 꺼진 상태와 켜진 상태에서 request target protocol address가 어떻게 달라지는지 비교하세요.
- gateway MAC은 얻었지만 ACL에서 차단될 때 L2 성공과 L3 실패를 어떤 관측으로 분리할까요?
