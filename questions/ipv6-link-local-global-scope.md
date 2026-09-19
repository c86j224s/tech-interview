---
id: ipv6-link-local-global-scope
title: IPv6 link-local 주소로 인터넷의 다른 링크에 있는 서버와 통신할 수 없는 이유는 무엇인가요?
difficulty: 하
category: 네트워크
tags:
  - IPv6
  - link-local
  - scope
  - 주소
related:
  - dns-happy-eyeballs
---
# IPv6 link-local 주소로 인터넷의 다른 링크에 있는 서버와 통신할 수 없는 이유는 무엇인가요?

## 구두 답변

link-local 주소는 `fe80::/10` 범위로, 인터페이스가 붙어 있는 하나의 링크 안에서만 의미가 있습니다. 그래서 같은 링크의 이웃이나 기본 라우터를 찾는 데는 쓸 수 있지만, IPv6 라우터는 link-local source 또는 destination을 가진 packet을 다른 링크로 forwarding하지 않습니다. 다른 링크의 서버와 통신하려면 global unicast처럼 라우팅 가능한 destination과 그 목적지까지의 경로가 필요합니다.

예를 들어 노트북이 `fe80::10%wlan0`을 갖고 있고 서버도 다른 링크에서 `fe80::20`을 갖고 있다고 하겠습니다. 두 주소의 문자열만 보고 보내면 서버가 같은 링크에 있는지 판단할 수 없고, 운영체제도 `%wlan0` 같은 인터페이스 scope 없이는 어느 링크의 `fe80::20`인지 결정할 수 없습니다. 라우터가 중간에 있어도 link-local 범위를 확장해 주지 않으므로 packet은 인터넷으로 넘어가지 않습니다. 반면 서버의 global 주소 `2001:db8:2::20`을 사용하면 호스트는 RA로 배운 기본 라우터의 link-local 주소를 다음 홉으로 사용하고, 라우터는 global destination에 맞춰 forwarding합니다.

다만 global 주소라고 통신이 자동으로 성공하는 것은 아닙니다. route table, NDP로 해석한 다음 홉 MAC, 방화벽, 반대 방향 경로가 별도로 맞아야 합니다. link-local 실패는 주소 범위의 제한이고, global 주소 실패는 라우팅·정책·도달성 문제일 수 있어 구분해서 진단해야 합니다.

구현에서는 endpoint를 주소 문자열 하나로만 저장하지 않고 주소와 zone, 인터페이스를 함께 보관합니다. 예를 들어 `fe80::1%en0`과 `fe80::1%utun0`은 숫자 부분이 같아도 서로 다른 이웃입니다. 장애 분석에서도 먼저 목적지가 on-link인지, 아니면 기본 라우터를 통해야 하는지 확인한 뒤 NDP와 라우팅을 순서대로 확인해야 합니다.

## 득점 포인트

- `fe80::/10`과 forwarding 경계를 말하고 zone을 link 식별자로 설명합니다.
- 메커니즘의 중간 상태와 실패 경계를 실제 패킷 또는 상태 값으로 설명합니다.

## 감점 포인트

- link-local을 NAT로 인터넷에 보낼 수 있다고 말하지 않습니다.
- 표준이 정하지 않은 구현 정책을 모든 운영체제의 고정 규칙으로 일반화하지 않습니다.

## 더 파고들 거리

- remote global 목적지에서 IPv6 주소와 첫 Ethernet MAC을 비교해 보세요.
- 정상 관찰과 오류 부재를 구분하는 추가 로그나 캡처 항목을 제시해 보세요.
