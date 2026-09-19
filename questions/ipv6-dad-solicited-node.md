---
id: ipv6-dad-solicited-node
title: IPv6 주소를 인터페이스에 붙이기 전에 왜 solicited-node multicast와 DAD가 필요한가요?
difficulty: 중하
category: 네트워크
tags:
  - IPv6
  - DAD
  - multicast
  - 주소 충돌
related: []
---
# IPv6 주소를 인터페이스에 붙이기 전에 왜 solicited-node multicast와 DAD가 필요한가요?

## 구두 답변

DAD(Duplicate Address Detection)는 새 unicast 주소를 실제로 사용하기 전에 같은 링크에서 그 주소를 이미 사용하는 장비가 있는지 검사하는 절차입니다. 새 주소에서 유도한 solicited-node multicast group을 대상으로 NS를 보내고, 기존 장비가 그 주소를 사용하고 있으면 NA나 관련 응답으로 중복을 알릴 수 있습니다. solicited-node group은 주소의 마지막 24비트로 정해져 모든 노드 broadcast보다 수신 범위를 줄이는 역할을 합니다.

예를 들어 두 장비가 `2001:db8:1::1234/64`를 구성하면 두 번째 장비는 주소를 tentative 상태로 두고 DAD NS를 보냅니다. 기존 주소 사용 노드의 source·target 정보가 중복을 드러내면 새 장비는 해당 주소를 정상 주소로 올리지 않고 설정 실패를 처리해야 합니다. 이는 같은 링크에서 동시에 같은 주소를 사용해 neighbor cache가 서로 다른 MAC을 가리키는 상황을 줄입니다. DAD는 전역 고유성이나 상위 인가를 보장하는 절차는 아닙니다. 충돌 장비가 꺼져 있거나 multicast/ICMPv6가 필터링되면 탐지하지 못할 수 있습니다.

일반 주소 해석 NS와 DAD NS를 구분하는 것도 중요합니다. 일반 해석은 이미 사용 중인 source 주소에서 대상의 MAC을 묻지만, DAD는 새 주소가 아직 확정되지 않았으므로 source를 unspecified로 두는 규칙과 연관됩니다. 실제 주소 자동 설정의 세부 타이밍은 RFC 4862와 OS 구현을 확인해야 하며, DAD 성공을 곧 인터넷 라우팅 성공으로 확대하지 않습니다.

DAD 패킷을 볼 때는 일반 NS처럼 이미 확정된 source 주소가 있다고 가정하지 않습니다. 새 주소가 tentative인 동안 source는 unspecified이고, target은 검사할 unicast 주소입니다. 따라서 캡처에서 “NA가 없었다” 하나만으로 성공을 판정하지 말고, 동일 링크의 중복 노드 상태와 필터링 여부까지 함께 확인해야 합니다.

## 득점 포인트

- 새 unicast와 tentative NS의 source를 설명하고 anycast를 제외합니다.
- 메커니즘의 중간 상태와 실패 경계를 실제 패킷 또는 상태 값으로 설명합니다.

## 감점 포인트

- DAD NS에 항상 NA로 응답한다고 말하지 않습니다.
- 표준이 정하지 않은 구현 정책을 모든 운영체제의 고정 규칙으로 일반화하지 않습니다.

## 더 파고들 거리

- 동시 tentative DAD에서 NS와 NA 부재를 어떻게 판정할지 말해 보세요.
- 정상 관찰과 오류 부재를 구분하는 추가 로그나 캡처 항목을 제시해 보세요.
