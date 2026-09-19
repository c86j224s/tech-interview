---
id: icmp-error-quoted-packet-correlation
title: ICMP 오류 payload에 원래 패킷 일부가 포함되는 이유는 무엇이며 어떤 요청과 연결하나요?
difficulty: 중하
category: 네트워크
tags:
  - ICMP
  - 오류 상관관계
  - datagram
  - 진단
related: []
---
# ICMP 오류 payload에 원래 패킷 일부가 포함되는 이유는 무엇이며 어떤 요청과 연결하나요?

## 구두 답변

ICMP 오류 수신자가 어느 원래 datagram 때문에 실패했는지 알아야 올바른 transport process와 요청 상태에 전달할 수 있으므로, 오류 payload에는 triggering packet의 IP header와 상위 계층을 식별할 만큼의 앞부분이 포함됩니다. IPv4 RFC 792는 원래 Internet Header와 데이터 첫 64비트를, IPv6 RFC 4443은 최소 IPv6 MTU를 넘지 않는 범위에서 invoking packet을 가능한 많이 포함하도록 정의합니다. 이것은 전체 애플리케이션 요청을 되돌려 주는 기능이 아닙니다.

UDP probe라면 인용된 source/destination port와 payload nonce를 발송 로그와 맞추고, IPv6라면 Next Header와 인용 길이를 확인합니다. 예를 들어 TTL 2 probe에 `port=33436, nonce=0x71`을 넣었다면 ICMP 안의 해당 값으로 여러 동시 probe 중 실패한 하나를 매칭할 수 있습니다. 인용이 잘려 nonce가 없으면 5-tuple과 송신 시각, TTL을 이용하되 확신 수준을 낮춥니다.

ICMP는 중복·지연·spoofing될 수 있고 middlebox가 같은 길이의 인용을 보장하지 않습니다. 따라서 하나의 오류 payload만으로 애플리케이션 상태를 취소하거나 서버 장애를 확정하지 않고 checksum, tuple, 현재 연결 세대, packet capture와 함께 검증합니다. 오류 자체는 상위 애플리케이션의 처리 commit이 아니라 네트워크 계층의 관찰입니다.

예를 들어 동일 포트를 1초 간격으로 재사용하면 늦은 오류가 새 probe에 붙을 위험이 있습니다. 송신 시각과 monotonic probe ID를 payload에 넣고, 인용 payload가 잘렸으면 매칭 결과를 `unknown`으로 남기는 편이 안전합니다. 오류를 받았다는 사실은 네트워크 계층에서 폐기되었다는 관찰이지, 서버가 요청을 전혀 처리하지 않았다는 증명은 아닙니다.

## 득점 포인트

- quoted tuple·port·nonce를 probe와 매칭합니다.
- 메커니즘의 중간 상태와 실패 경계를 실제 패킷 또는 상태 값으로 설명합니다.

## 감점 포인트

- ICMP source만으로 원래 요청을 확정하지 않습니다.
- 표준이 정하지 않은 구현 정책을 모든 운영체제의 고정 규칙으로 일반화하지 않습니다.

## 더 파고들 거리

- 인용이 잘렸을 때 unknown을 남기는 기준을 말해 보세요.
- 정상 관찰과 오류 부재를 구분하는 추가 로그나 캡처 항목을 제시해 보세요.
