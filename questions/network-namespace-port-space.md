---
id: network-namespace-port-space
title: '두 컨테이너가 같은 노드에서 같은 TCP 포트를 열 수 있는 이유와, veth·bridge를 연결하면 무엇이 다시 공유되는지 설명하세요.'
difficulty: 중하
category: 운영체제
tags:
  - namespace
  - PID
  - mount
  - network
related:
  - process-vs-thread
---
# 두 컨테이너가 같은 노드에서 같은 TCP 포트를 열 수 있는 이유와, veth·bridge를 연결하면 무엇이 다시 공유되는지 설명하세요.

## 구두 답변

두 소켓이 서로 다른 network namespace에 있으면 TCP bind 충돌을 namespace별 port 공간에서 판단하므로 두 컨테이너가 각각 `0.0.0.0:8080`을 열 수 있습니다. 하지만 bind 성공은 외부 연결 가능성을 뜻하지 않습니다. loopback 외 인터페이스, IP 주소, route, veth pair와 bridge 또는 routing/NAT가 있어야 패킷이 도달합니다. 설명용 상태로 netns A가 `10.0.0.2:8080`, B가 `10.0.0.3:8080`을 listen한다고 하겠습니다. veth 한쪽씩을 bridge에 연결하면 두 IP로 접근하는 packet path가 생기지만, bridge queue·host firewall·NAT·물리 NIC는 같은 호스트 커널 인프라를 사용합니다. 호스트 주소 `:8080`을 A에 publish하면 예약되는 endpoint는 host network namespace에 있고, 같은 주소·포트를 B에도 publish할 수 있는지는 CNI의 proxy/NAT 예약 정책에 달립니다. netns 분리만으로 host port 충돌이 없어지지 않습니다. 실제 Linux 실행이 아닌 구조적 trace이므로 진단에서는 각 namespace의 `ss -ltnp`, `ip addr`, `ip route`를 따로 저장하고 호스트의 bridge member, veth peer, nftables/iptables NAT와 firewall을 대조하겠습니다. listener가 있어도 route가 없거나 bridge가 down이거나 firewall이 drop하면 연결은 실패합니다. `hostNetwork`를 선택하면 처음의 port 공간 분리 자체가 사라지므로 내부 충돌 회피와 외부 노출 주소를 별도 의사결정으로 기록해야 합니다.

포트 충돌을 진단할 때도 주소 범위를 명시해야 합니다. A의 컨테이너 IP `10.0.0.2:8080`과 B의 `10.0.0.3:8080`은 서로 다른 목적지이지만 두 서비스가 같은 host IP의 8080을 publish하려 하면 내부 listener가 달라도 host 예약 단계에서 충돌할 수 있습니다. 반대로 host port를 쓰지 않고 reverse proxy가 두 container IP로 라우팅하면 proxy가 유일한 host endpoint가 됩니다. 따라서 “같은 포트”라는 말을 내부 bind, 컨테이너 IP, host publish 중 어느 층의 주소인지 먼저 고정하겠습니다.

## 득점 포인트

- namespace별 bind 성공과 veth·route를 통한 reachability를 분리합니다.
- host-port publish는 별도 endpoint 예약이며 bridge와 firewall은 공유되는 호스트 인프라임을 설명합니다.
- ss·ip addr·ip route와 NAT/firewall을 양쪽 관찰 지점으로 제시합니다.

## 감점 포인트

- 두 컨테이너가 같은 내부 포트를 열면 항상 host port도 충돌하지 않는다고 말합니다.
- veth가 network namespace를 합쳐 하나의 port 공간으로 만든다고 설명합니다.
- listener 존재만으로 외부 연결이 보장된다고 단정합니다.

## 더 파고들 거리

- 동일 host port를 두 컨테이너에 publish할 때 proxy 방식과 NAT 방식의 충돌 검사를 비교해 보세요.
- bridge는 살아 있지만 route가 없을 때 packet trace에서 어느 지점까지 도달하는지 설명해 보세요.
