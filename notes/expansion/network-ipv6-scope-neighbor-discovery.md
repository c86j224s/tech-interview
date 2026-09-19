---
id: network-ipv6-scope-neighbor-discovery
title: IPv6 주소 범위와 Neighbor Discovery
topic: 네트워크
summary: >-
  IPv6의 unicast·multicast·link-local 범위와 Router/Neighbor
  Solicitation·Advertisement를 주소 해석·중복 검사·도달성 상태와 연결합니다.
questionIds: []
prerequisites:
  - computer-science-foundations
related:
  - dns-transition
reviewedAt: '2026-09-19'
---
# IPv6 주소 범위와 Neighbor Discovery

IPv6의 주소를 이해할 때는 128비트 값을 외우는 것보다 그 주소가 어느 범위에서 의미가 있는지와 다음 홉을 어떻게 찾는지를 함께 추적해야 합니다. `fe80::/10` link-local 주소는 인터페이스가 붙어 있는 한 링크에서만 유효하고, `2001:db8:...` 같은 global unicast 주소는 라우팅 가능한 주소 공간에 속할 수 있지만 실제 도달성까지 보장하지는 않습니다. 이 구분이 없으면 “주소가 있으니 인터넷으로 나가겠지” 또는 “RA의 lifetime이 0이니 모든 prefix가 사라졌겠지” 같은 진단 오류가 생깁니다.

이 글에서 link-local은 RFC 4291의 주소 구조와 forwarding 제한으로, Neighbor Discovery Protocol(NDP)은 RFC 4861의 RS/RA·NS/NA·NUD 절차로 설명합니다. 주소 자동 설정 자체의 세부 규칙은 RFC 4862와 운영체제 정책의 영역이므로 여기서는 NDP가 전달하는 정보와 주소 충돌·도달성 판단의 경계를 분리합니다. DAD의 unicast 대상, unspecified-source NS, tentative 주소 수신 규칙은 RFC 4862 §5.4를 함께 기준으로 삼습니다.

## 128비트 주소와 인터페이스 귀속

IPv6 주소는 호스트 전체에 막연히 붙는 값이 아니라 인터페이스에 할당됩니다. 같은 노드가 Wi-Fi와 유선에 각각 주소를 가질 수 있고, 패킷의 source와 destination을 고를 때 어느 인터페이스와 범위를 사용할지가 중요합니다. 표기 `2001:db8:12:3::25/64`에서 `/64`는 앞의 64비트가 prefix라는 뜻이며, 나머지 부분은 해당 prefix 안에서 인터페이스를 식별하는 값입니다. `/64`라는 관습을 모든 주소 종류의 자동 설정 규칙으로 확대하면 안 됩니다.

주소 종류도 도달성의 약속이 다릅니다. unicast는 한 인터페이스를 식별하고, anycast는 여러 인터페이스 중 라우팅상 가까운 한 곳으로 전달될 수 있으며, multicast는 여러 수신자 그룹을 식별합니다. link-local unicast의 prefix는 `fe80::/10`이고, RFC 4291은 이 주소를 단일 링크에서 사용하도록 정의합니다. 따라서 같은 `fe80::1` 문자열이 서로 다른 링크의 장비에 존재할 수 있습니다. 링크 범위를 벗어나면 주소만으로 어느 인터페이스의 이웃인지 결정할 수 없으므로 운영체제와 명령행 도구가 `%en0` 같은 zone/interface 식별자를 요구할 수 있습니다.

## 범위와 라우터 전달 경계

link-local source 또는 destination을 가진 패킷은 IPv6 라우터가 다른 링크로 전달하지 않습니다. 라우터의 link-local 주소가 기본 라우터로 보이는 것은 라우터와 호스트가 **같은 링크에서** 그 다음 홉을 식별하는 데 편리하기 때문이지, 그 주소가 전역 목적지 주소가 되는 것은 아닙니다. 반대로 global unicast를 사용해도 라우팅 테이블, 방화벽, NDP, 반대 방향 경로가 맞아야 통신이 됩니다.

예를 들어 호스트 A의 `fe80::a`가 스위치 링크 L1에 있고 서버의 `fe80::b`는 링크 L2에 있다고 합시다. A가 `fe80::b`를 목적지로 잡아도 라우터는 link-local 범위를 넘겨 전달하지 않습니다. 목적지의 global 주소가 `2001:db8:2::b`라면 A는 먼저 RA로 배운 기본 라우터를 다음 홉으로 선택하고, 같은 L1에서 그 라우터의 link-layer 주소를 NDP로 알아냅니다. 패킷의 최종 IPv6 destination은 서버 주소이고, Ethernet destination은 L1 라우터의 MAC입니다.

```diagram
{"title":"주소 범위가 다음 홉 선택을 제한합니다","caption":"link-local 주소는 링크 안의 이웃·라우터 식별에 머물고, 다른 링크의 목적지는 라우팅 가능한 주소와 기본 라우터 경로를 필요로 합니다.","rows":[[{"id":"host","label":"호스트 A","detail":["fe80::a · global 주소"]}],[{"id":"neighbor","label":"같은 링크의 NDP","detail":["라우터 MAC 해석"]}],[{"id":"router","label":"기본 라우터","detail":["link-local next hop"]}],[{"id":"remote","label":"다른 링크의 서버","detail":["global unicast 목적지"]}]],"edges":[{"from":"host","to":"neighbor","label":"on-link 판단"},{"from":"neighbor","to":"router","label":"NS / NA"},{"from":"router","to":"remote","label":"global 경로 전달"}]}
```

## RS와 RA의 라우터 발견

인터페이스가 활성화된 호스트는 다음 정기 RA를 기다리는 대신 Router Solicitation(RS)을 보내 라우터가 RA를 빨리 생성하도록 요청할 수 있습니다. Router Advertisement(RA)는 라우터의 존재와 함께 on-link 판단에 쓸 prefix, 주소 자동 설정 관련 prefix flag, hop limit, 선택적인 link MTU 등의 정보를 전달합니다. 호스트는 여러 라우터의 RA를 받아 default router 목록을 만들며, 라우터가 일정 시간 광고하지 않았다는 사실만으로 즉시 장애를 확정하지는 않습니다. 별도의 NUD가 reachability를 판단합니다.

RA의 필드를 한 덩어리의 “주소 설정 결과”로 읽으면 안 됩니다. Router Lifetime은 기본 라우터 목록에서 그 라우터를 사용할 수 있는 시간입니다. RFC 4861은 lifetime 0을 해당 라우터가 default router가 아니라는 의미로 정의하고, 이 필드는 다른 메시지 필드나 option의 정보에는 적용되지 않는다고 명시합니다. Prefix Information Option은 자체 valid/preferred lifetime과 L/A flag를 가지므로, 같은 RA 안에 `2001:db8:1::/64` prefix가 있고 Router Lifetime이 0이라면 기본 경로 후보는 제거하되 prefix 정보의 유효성은 각 option 규칙에 따라 별도로 평가합니다.

## NS와 NA의 주소 해석

호스트가 목적지가 on-link라고 판단하면 destination IPv6 주소에 대응하는 solicited-node multicast 주소로 Neighbor Solicitation(NS)을 보냅니다. RFC 4291의 solicited-node multicast는 unicast 또는 anycast 주소의 마지막 24비트를 사용해 `ff02::1:ffXX:XXXX` 형태로 만들며, 여러 주소가 같은 그룹에 겹칠 수 있습니다. 그래서 모든 링크의 모든 노드를 깨우는 broadcast 대신 관련 가능성이 있는 그룹만 수신하게 합니다.

대상은 Neighbor Advertisement(NA)로 자신의 link-layer 주소를 알려줄 수 있습니다. NS에는 송신자의 link-layer 주소 option이 포함될 수 있으므로, 정상적인 요청-응답 한 쌍에서 요청자도 대상 MAC을 배우고 대상도 요청자의 MAC을 배울 수 있습니다. 이미 cache에 있던 매핑을 검증하는 unicast NS와 최초 해석의 multicast NS는 관찰 모양이 다를 수 있습니다. NS/NA는 단순 ARP 대체 패킷이 아니라 address resolution, reachability 확인, DAD에 재사용되는 NDP 메시지입니다.

## NUD와 캐시 상태

Neighbor cache는 “IPv6 주소와 MAC을 영원히 매핑한 표”가 아닙니다. NDP는 reachability를 추적하는 상태를 가지며, 구현이 사용하는 세부 timer와 상태 전이는 운영체제에 따라 확인해야 합니다. RFC 4861이 설명하는 대표 상태에는 INCOMPLETE, REACHABLE, STALE, DELAY, PROBE가 있습니다. 아직 응답을 기다리는 해석은 INCOMPLETE이고, 확인된 이웃도 reachable timer가 지나면 STALE이 될 수 있습니다. STALE은 즉시 삭제나 즉시 장애를 뜻하지 않고, 다음 전송을 계기로 확인 절차가 다시 시작될 수 있는 상태입니다.

주소가 올바른데도 통신이 끊기면 다음 홉 선택과 cache 상태를 분리해서 봅니다. 목적지가 remote global 주소이면 먼저 기본 라우터가 선택됐는지, 그 라우터의 MAC 해석이 INCOMPLETE에서 멈췄는지 확인합니다. 목적지 자체가 on-link라면 서버의 solicited-node group에 대한 NS/NA와 서버의 cache를 봅니다. multicast 차단, 잘못된 VLAN, 방화벽의 ICMPv6 필터, 이동 후 stale MAC은 같은 “ping 실패”를 만들지만 수정 위치는 다릅니다.

## DAD와 주소 사용 전제

Duplicate Address Detection(DAD)은 인터페이스에 unicast 또는 anycast 주소를 실제로 사용하기 전에 같은 링크에서 이미 그 주소를 쓰는 노드가 있는지 확인하는 절차입니다. 새 주소의 solicited-node multicast를 대상으로 NS를 보내고, 기존 노드가 해당 주소를 사용하고 있으면 NA 또는 관련 트래픽으로 충돌 신호를 낼 수 있습니다. DAD는 주소의 전역 고유성이나 라우터의 정책 승인을 보장하지 않습니다. 상대가 꺼져 있거나 multicast가 필터링되면 같은 링크의 충돌을 관찰하지 못할 수 있습니다.

예를 들어 두 장비가 `2001:db8:1::1234/64`를 잘못 구성했다면 두 번째 장비는 DAD가 끝나기 전 주소를 tentative 상태로 취급해야 합니다. 이때 같은 링크의 첫 장비가 이미 해당 주소를 사용하고 있다는 사실이 NS 또는 NA 관찰의 source·target 정보로 드러나면 두 번째 장비는 주소를 올리지 않고 설정 오류를 기록합니다. 반대로 양쪽이 모두 tentative인 동시 DAD에서는 어느 쪽도 tentative target에 대한 정상 NA 응답자가 되지 않으므로, 양쪽의 DAD NS를 관찰해 중복으로 처리하는 규칙을 설명해야 합니다. 서로 다른 링크에 같은 값이 있다면 DAD가 탐지할 대상이 아니며, global prefix를 여러 링크에 광고한 라우팅·주소 계획 오류는 별도 검증이 필요합니다.

## 숫자와 패킷 상태 추적

설명용으로 A가 L1에서 `fe80::a`와 `2001:db8:1::10/64`를 가지고, 라우터 R이 L1에서 `fe80::1`, 서버 S가 L2에서 `2001:db8:2::20`을 가진다고 하겠습니다. A가 S로 1500바이트 패킷을 보내는 과정을 숫자로 나누면 다음과 같습니다.

1. A는 목적지 `2001:db8:2::20`이 자신의 on-link prefix `2001:db8:1::/64`에 속하지 않는다고 판단합니다. 따라서 next hop은 R입니다.
2. A의 neighbor cache에 `fe80::1 → 02:00:00:00:00:01`이 없으면 R의 solicited-node group에 NS를 보냅니다. 설명용 MAC이며 실제 값은 환경마다 다릅니다.
3. R의 NA를 받아 cache가 채워지면 Ethernet destination은 R의 MAC, IPv6 destination은 여전히 S의 `2001:db8:2::20`입니다. 라우터가 L2로 전달할 때 L2 destination은 다시 바뀝니다.
4. R이 RA에서 `2001:db8:2::/64`를 직접 광고하지 않았더라도 자신의 라우팅 테이블에 경로가 없으면 packet은 다른 단계에서 실패합니다. link-local 주소를 global 목적지처럼 넣는 방식은 라우팅을 우회하지 않습니다.

이 흐름은 설명용 계산과 예상 상태이며 이 환경에서 실제 네트워크 패킷을 실행한 결과가 아닙니다. 실제 진단에서는 RA capture, neighbor table, route table, VLAN, ICMPv6 정책을 같은 시각의 자료로 대조합니다.

## 구현 선택과 검증 경계

애플리케이션은 `fe80::` 주소를 문자열만 저장하지 말고 인터페이스 scope와 함께 endpoint를 표현해야 합니다. 기본 라우터를 고정 문자열로 박아 두기보다 RA와 OS route selection 결과를 사용하고, 장애 시 link-local next hop의 NUD 실패와 remote 서버의 서비스 실패를 다른 원인으로 기록합니다. 전역 주소가 있다고 바로 외부 통신을 재시도하는 것도 안전하지 않습니다. 방화벽과 라우팅이 정상인지 확인한 뒤 재시도 예산을 적용합니다.

검증은 세 묶음으로 나누는 것이 좋습니다. 같은 링크의 link-local NS/NA, 다른 링크의 global 전달, 중복 주소 DAD를 각각 재현합니다. RA에서는 Router Lifetime 0인 경우 default route 후보만 변하는지와 prefix option의 valid lifetime이 별도로 처리되는지 확인합니다. cache에서는 REACHABLE 이후 STALE로 넘어간 매핑이 다음 probe에서 갱신되는지, multicast가 막혔을 때 어떤 로그와 timeout이 남는지 확인합니다.

## 비용과 한계

NDP는 IPv4의 ARP보다 더 많은 역할을 맡기 때문에 ICMPv6를 무심코 전부 차단하면 주소 해석뿐 아니라 router discovery, PMTUD, reachability가 함께 깨질 수 있습니다. solicited-node multicast가 수신 범위를 줄여도 스위치의 multicast 처리, 무선 절전, 보안 필터에 의한 손실은 남습니다. RA Guard나 DHCPv6 정책 같은 운영 보안은 이 글의 핵심 규격에서 벗어나므로 배포 환경 문서를 별도로 확인해야 합니다.

또한 RFC 4291과 RFC 4861은 각각 주소 아키텍처와 NDP 절차를 설명하지만 실제 주소 자동 설정의 전체 동작은 후속 RFC와 OS 구현에 의존합니다. 여기서 제시한 MAC과 상태 전이는 설명용 예이고 특정 운영체제의 timer 상수나 명령 출력으로 오해해서는 안 됩니다.

## 참고 자료

- RFC 4291, *IP Version 6 Addressing Architecture*, 특히 link-local unicast와 solicited-node multicast 주소 범위.
- RFC 4861, *Neighbor Discovery for IPv6*, RS/RA·NS/NA·NUD와 Router Lifetime 필드.
- RFC 4862, *IPv6 Stateless Address Autoconfiguration*, §5.4의 DAD 대상·unspecified-source NS·tentative address 처리 규칙. 이 글에서는 주소 자동 설정 전체가 아니라 해당 DAD 경계만 대조했습니다.

### 참고 경로

- [https://www.rfc-editor.org/rfc/rfc4291](https://www.rfc-editor.org/rfc/rfc4291)
- [https://www.rfc-editor.org/rfc/rfc4861](https://www.rfc-editor.org/rfc/rfc4861)

위 링크는 개념별 참고 경로이며, 본문에서 명시한 확인 범위와 미확인 구현 조건을 함께 적용합니다.
