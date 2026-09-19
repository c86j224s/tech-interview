---
id: arp-unsolicited-sender-update
title: ARP reply가 내가 요청하지 않은 형태로 도착했습니다. 기존 매핑을 갱신해도 되나요?
difficulty: 중하
category: 네트워크
tags:
  - ARP
  - cache
  - unsolicited
  - 보안
related: []
---
# ARP reply가 내가 요청하지 않은 형태로 도착했습니다. 기존 매핑을 갱신해도 되나요?

## 구두 답변

기계적인 RFC 826 수신 모델에서는 기존 sender 매핑이 갱신될 수 있지만, 기존 항목의 갱신과 빈 cache에 새 항목을 만드는 조건을 분리해서 답해야 합니다. RFC 826의 Packet Reception 순서는 opcode와 target 검사보다 먼저 sender protocol address와 sender hardware address를 translation table과 병합하도록 설명합니다. 이미 같은 protocol address가 있으면 새 hardware address로 refresh 또는 replacement될 수 있습니다. 반면 미등록 항목의 생성은 원문 제안 알고리즘에서 수신자가 target protocol address의 당사자인지 확인하는 조건과 연결되어 있으므로, unsolicited packet이 모든 수신자의 빈 cache에 언제나 새 항목을 만든다고 일반화하면 안 됩니다.

예를 들어 A가 주소와 MAC을 announcement로 알리면 B의 기존 A 항목은 갱신될 수 있습니다. 그러나 같은 형식을 공격자가 보내면 B가 이후 프레임을 공격자 포트로 보낼 위험도 있습니다. “프로토콜상 갱신 가능”과 “운영에서 신뢰하여 forwarding에 반영할지”는 별개의 판단입니다. 로그에는 opcode, sender IP/MAC, 기존 cache 값, ingress VLAN·포트, 링크 상태를 함께 남깁니다. RFC 5227의 ACD announcement와 probing은 현대 주소 충돌 절차의 별도 규약이므로 전통적인 gratuitous ARP와 완전히 같은 것으로 취급하지 않습니다. DHCP binding, ARP inspection 등 방어는 RFC 826이 제공하지 않는 구현·정책 영역입니다.

## 득점 포인트

- existing mapping의 refresh/replacement와 absent mapping의 생성 조건을 분리합니다.
- sender 병합이 opcode/target 검사보다 앞설 수 있다는 원문 순서를 설명합니다.
- 정상 announcement와 spoofing을 packet·포트·binding 시간선으로 구분합니다.

## 감점 포인트

- unsolicited ARP는 표준상 언제나 무시된다고 단정합니다.
- 기존 항목과 새 항목을 구분하지 않고 모든 수신자가 cache를 만든다고 말합니다.
- cache 변화만으로 공격 또는 정상 이동을 확정합니다.

## 더 파고들 거리

- `기존 X→Y 갱신`과 `미등록 Y 생성`을 각각 어떤 수신 상태에서 검증할까요?
- inspection 정책이 정상적인 주소 이동 announcement를 막을 수 있는 ingress 조건은 무엇일까요?
