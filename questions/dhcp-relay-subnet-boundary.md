---
id: dhcp-relay-subnet-boundary
title: DHCP server가 다른 subnet에 있어도 초기 broadcast가 처리되는 과정은 무엇인가요?
difficulty: 하
category: 네트워크
tags:
  - DHCP
  - relay agent
  - broadcast
  - subnet
related: []
---
# DHCP server가 다른 subnet에 있어도 초기 broadcast가 처리되는 과정은 무엇인가요?

## 구두 답변

client의 DISCOVER broadcast를 라우터가 일반 IP broadcast처럼 전달하는 것이 아니라, 해당 subnet의 DHCP relay agent가 받아 DHCP server로 전달합니다. relay는 client 쪽 interface와 subnet 정보를 server에 전달하고, server는 그 context에 맞는 pool에서 OFFER를 만듭니다. 응답은 relay를 통해 다시 client subnet으로 돌아와 broadcast 또는 client hardware address를 이용해 전달됩니다.

예를 들어 VLAN 20의 SVI에 relay가 설정되어 있고 DHCP server는 다른 subnet에 있다고 하겠습니다. VLAN 20 client가 local broadcast로 DISCOVER를 보내면 SVI relay가 server로 unicast/relay 메시지를 만들고, server는 relay 정보에 따라 `.20.x` 주소를 제안합니다. client는 아직 IP가 없어도 relay가 응답 delivery를 맡을 수 있습니다. helper 주소가 틀리거나 `giaddr`·ACL·option 전달이 잘못되면 DHCP server는 다른 subnet pool을 선택하거나 응답을 못 보낼 수 있습니다.

T1 갱신의 unicast와 T2 rebinding의 broadcast도 relay 경계를 다르게 통과할 수 있으므로 “DHCP broadcast는 라우터를 넘는다”라고 일반화하지 않습니다. packet capture에서 client VLAN, relay interface, server request, 응답의 return path를 각각 봅니다. relay는 L2 broadcast domain을 하나로 합치는 장비가 아니라 DHCP 교환만 운반하는 경계 구성요소입니다.

패킷을 단계별로 기록하면 client의 DISCOVER에는 아직 유효한 source address가 없고, relay가 server 쪽 전달에 자신이 속한 interface context를 넣습니다. server가 만든 OFFER가 relay에 돌아온 뒤 relay가 client VLAN의 broadcast 조건에 맞춰 내보내므로, 양쪽 capture의 Ethernet destination이 같을 필요가 없습니다. 이 차이를 놓치면 relay 장애를 server pool 고갈로 잘못 진단합니다.

## 득점 포인트

- local broadcast, relay, `giaddr`, 반환 경계를 순서대로 설명합니다.
- 메커니즘의 중간 상태와 실패 경계를 실제 패킷 또는 상태 값으로 설명합니다.

## 감점 포인트

- relay를 일반 broadcast forwarding으로 말하지 않습니다.
- 표준이 정하지 않은 구현 정책을 모든 운영체제의 고정 규칙으로 일반화하지 않습니다.

## 더 파고들 거리

- 잘못된 `giaddr`를 capture에서 찾는 절차를 말해 보세요.
- 정상 관찰과 오류 부재를 구분하는 추가 로그나 캡처 항목을 제시해 보세요.
