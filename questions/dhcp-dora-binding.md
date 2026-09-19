---
id: dhcp-dora-binding
title: DHCPDISCOVER부터 DHCPACK까지 진행됐다고 해서 OFFER 시점에 임대가 확정된 것으로 보면 안 되는 이유는 무엇인가요?
difficulty: 하
category: 네트워크
tags:
  - DHCP
  - DORA
  - lease
  - broadcast
related: []
---
# DHCPDISCOVER부터 DHCPACK까지 진행됐다고 해서 OFFER 시점에 임대가 확정된 것으로 보면 안 되는 이유는 무엇인가요?

## 구두 답변

DHCPOFFER는 server가 제안한 주소와 option일 뿐이고, client가 DHCPREQUEST로 한 server의 offer를 선택한 뒤 그 server가 binding을 저장하고 DHCPACK을 보내야 할당이 확정됩니다. 여러 server가 동시에 offer를 보내도 client는 하나를 선택합니다. 선택된 server는 persistent storage에 binding을 commit하고, 선택되지 않은 server는 broadcast REQUEST를 통해 자신의 offer가 거절되었다는 사실을 알 수 있습니다.

예를 들어 server A가 `.20`, server B가 `.30`을 제안했다고 하겠습니다. client가 A의 server identifier와 requested IP `.20`을 넣은 REQUEST를 broadcast하면 B는 자신의 offer를 선택하지 않았다고 처리하고, A는 binding을 저장한 뒤 `.20` ACK를 보냅니다. client가 ACK를 받기 전에는 `.20`을 확정된 주소로 쓰지 않고, ACK 후에도 ARP 등 최종 충돌 검사를 할 수 있습니다.

로그에서는 DISCOVER, OFFER, REQUEST, ACK를 같은 transaction ID와 client identifier로 묶습니다. OFFER만 있고 REQUEST가 없으면 후보 상태이며, REQUEST는 있지만 ACK 대신 NAK나 timeout이면 binding 확정으로 표시하지 않습니다. relay 환경에서는 broadcast가 relay를 거쳐 전달되므로 server와 client가 같은 L2에 있다고 가정하지 않습니다.

중간 상태는 `SELECTING`에서 offer 후보를 모으고, `REQUEST`를 보낸 뒤 선택된 server의 ACK를 기다리는 단계입니다. 이때 client가 offer 주소를 미리 정상 interface 주소로 사용하면 다른 host와 충돌하거나 서버의 선택 상태와 어긋날 수 있습니다. ACK 이후에도 lease time과 option을 실제 interface에 반영한 시점을 로그에 남겨 “ACK 수신”과 “구성 적용”을 구분합니다.

## 득점 포인트

- OFFER, REQUEST, binding, ACK 순서를 구분합니다.
- 메커니즘의 중간 상태와 실패 경계를 실제 패킷 또는 상태 값으로 설명합니다.

## 감점 포인트

- OFFER만으로 lease 확정을 기록하지 않습니다.
- 표준이 정하지 않은 구현 정책을 모든 운영체제의 고정 규칙으로 일반화하지 않습니다.

## 더 파고들 거리

- relay `giaddr`가 pool 선택에 주는 증거를 말해 보세요.
- 정상 관찰과 오류 부재를 구분하는 추가 로그나 캡처 항목을 제시해 보세요.
