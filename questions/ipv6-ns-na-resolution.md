---
id: ipv6-ns-na-resolution
title: IPv6 호스트가 같은 링크의 이웃 MAC을 알아낼 때 ARP 대신 어떤 메시지를 사용하나요?
difficulty: 하
category: 네트워크
tags:
  - IPv6
  - NDP
  - Neighbor Solicitation
  - Neighbor Advertisement
related: []
---
# IPv6 호스트가 같은 링크의 이웃 MAC을 알아낼 때 ARP 대신 어떤 메시지를 사용하나요?

## 구두 답변

IPv6는 ARP 대신 Neighbor Discovery의 Neighbor Solicitation(NS)과 Neighbor Advertisement(NA)를 사용합니다. 호스트 A가 on-link인 호스트 B의 IPv6 주소를 알지만 MAC을 모르면 B 주소의 마지막 24비트에서 만든 solicited-node multicast group으로 NS를 보냅니다. B는 NA로 자신의 link-layer 주소를 알리고, A는 `IPv6 B → MAC B` 매핑을 neighbor cache에 기록한 뒤 Ethernet frame을 보냅니다.

예를 들어 A가 `2001:db8:1::1234`를 B의 주소로 판단하면 `ff02::1:ff00:1234` 계열의 solicited-node group을 대상으로 NS를 전송합니다. 실제 group은 주소 마지막 24비트로 계산되므로 여러 주소가 같은 group에 겹칠 수 있지만, 모든 링크의 장비를 깨우는 broadcast보다 수신 범위를 줄일 수 있습니다. A의 NS에는 source link-layer address option이 포함될 수 있어 B도 A의 MAC을 배울 수 있습니다. B가 응답한 뒤 A의 cache가 채워지고, 이후 데이터의 Ethernet 목적지는 B의 MAC, IPv6 목적지는 B의 IPv6 주소가 됩니다.

NS/NA는 최초 주소 해석만을 위한 것이 아닙니다. cache의 이웃이 여전히 reachable한지 확인하고 Duplicate Address Detection에도 사용됩니다. 따라서 NS가 보였는데도 통신이 안 되면 multicast 전달, VLAN, cache 상태, 방화벽의 ICMPv6 처리까지 확인합니다. cache가 STALE이라고 즉시 주소가 틀린 것은 아니며, 다음 전송에서 reachability 확인이 진행될 수 있습니다.

중간 상태를 보면 A의 cache는 처음에 `INCOMPLETE`이고, NS를 재전송하는 동안 데이터 전송이 대기합니다. NA가 올바른 target과 link-layer option으로 돌아오면 매핑이 채워지고, 이후 reachable timer가 지나면 `STALE`로 바뀔 수 있습니다. 이 상태를 즉시 삭제로 해석하지 않는 것이 진단에서 중요합니다.

## 득점 포인트

- NS/NA, solicited-node group, cache 상태를 실제 순서로 추적합니다.
- 메커니즘의 중간 상태와 실패 경계를 실제 패킷 또는 상태 값으로 설명합니다.

## 감점 포인트

- multicast group을 MAC 주소로 부르지 않습니다.
- 표준이 정하지 않은 구현 정책을 모든 운영체제의 고정 규칙으로 일반화하지 않습니다.

## 더 파고들 거리

- remote 목적지에서 왜 라우터 MAC을 찾는지 설명해 보세요.
- 정상 관찰과 오류 부재를 구분하는 추가 로그나 캡처 항목을 제시해 보세요.
