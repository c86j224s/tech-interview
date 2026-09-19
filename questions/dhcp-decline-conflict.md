---
id: dhcp-decline-conflict
title: DHCP ACK를 받은 직후 주소가 이미 사용 중임을 발견했습니다. client와 server는 어떤 상태를 남겨야 하나요?
difficulty: 중하
category: 네트워크
tags:
  - DHCP
  - DHCPDECLINE
  - 주소 충돌
  - lease
related: []
---
# DHCP ACK를 받은 직후 주소가 이미 사용 중임을 발견했습니다. client와 server는 어떤 상태를 남겨야 하나요?

## 구두 답변

client는 ACK의 주소를 정상 사용 상태로 확정하기 전에 ARP 같은 최종 검사를 수행하고, 이미 다른 장비가 사용 중이면 DHCPDECLINE으로 server에 보고한 뒤 configuration process를 다시 시작해야 합니다. 충돌 주소를 계속 사용하거나 로컬 ARP cache만 지우는 것은 해결이 아닙니다. server가 그 주소를 즉시 다시 offer하지 않도록 제외하는 것은 필요한 운영 동작이지만, quarantine 기간과 경보 방식은 server 구현 정책으로 확인해야 합니다.

예를 들어 `.20`을 ACK받은 client가 probe를 보냈는데 다른 MAC의 응답을 받았다면 `.20`을 인터페이스에 올린 채 재시도하지 않습니다. client는 DECLINE과 client/address 정보를 server에 보내고 INIT 쪽으로 돌아가 새 주소를 요청합니다. RFC 2131은 초기 구성에서 충돌을 발견하면 과도한 traffic을 피하려고 최소 10초 기다린 뒤 재시작하도록 권고합니다.

server에는 해당 주소가 conflict로 보고된 시각, client identifier, offer/ACK transaction, relay subnet을 남깁니다. 운영자는 static host, rogue DHCP server, stale lease, 잘못된 relay/VLAN을 조사해야 합니다. 다만 probe가 응답하지 않았다고 주소가 전역적으로 유일하다는 증거는 아니며, 조용한 호스트나 필터로 충돌을 놓칠 수 있습니다.

DECLINE은 client의 로컬 상태를 지우는 명령이 아니라 server pool에 공유하는 부정적 사실입니다. server가 `.20`을 unavailable로 기록하지 않으면 다음 offer에서 같은 주소가 다시 나올 수 있습니다. 다만 static 장비가 원인이라면 DHCP 서버만 고쳐서는 해결되지 않으므로, 충돌 MAC의 switch port와 lease 데이터베이스를 함께 대조해 원인을 제거해야 합니다.

## 득점 포인트

- DECLINE과 unavailable 표시를 server 상태로 연결합니다.
- 메커니즘의 중간 상태와 실패 경계를 실제 패킷 또는 상태 값으로 설명합니다.

## 감점 포인트

- ARP cache 삭제만으로 pool 안전을 주장하지 않습니다.
- 표준이 정하지 않은 구현 정책을 모든 운영체제의 고정 규칙으로 일반화하지 않습니다.

## 더 파고들 거리

- 공유되지 않은 pool에서 재발을 막는 조건을 설명해 보세요.
- 정상 관찰과 오류 부재를 구분하는 추가 로그나 캡처 항목을 제시해 보세요.
