---
id: network-icmp-errors-traceroute
title: ICMP 오류 전파와 traceroute 해석
topic: 네트워크
summary: >-
  IPv4·IPv6의 Destination Unreachable, Time Exceeded, Packet Too Big을 원래 패킷의 실패
  지점과 traceroute 관찰로 해석합니다.
questionIds: []
prerequisites:
  - tcp-handshake
related:
  - datagram-contracts
reviewedAt: '2026-09-19'
---
# ICMP 오류 전파와 traceroute 해석

ICMP 오류는 “네트워크가 실패했다”는 한 줄짜리 로그가 아니라, 어느 계층에서 어떤 이유로 원래 datagram을 처리하지 못했는지 전달하는 제어 메시지입니다. IPv4의 ICMP type 3에는 network unreachable, host unreachable, protocol unreachable, port unreachable, DF 때문에 fragmentation이 필요한 경우가 서로 다른 code로 들어갑니다. type 11은 TTL 만료 또는 fragment 재조립 timeout을 구분합니다. IPv6에서는 ICMPv6 type 1 Destination Unreachable, type 2 Packet Too Big, type 3 Time Exceeded가 핵심이며, IPv6 라우터는 중간 조각화를 하지 않으므로 Packet Too Big이 경로 MTU 탐색에 직접 연결됩니다.

오류를 받았다는 사실과 원래 애플리케이션 요청이 어떤 상태인지도 분리해야 합니다. 오류 메시지는 보통 원래 패킷의 IP header와 상위 계층 식별에 필요한 앞부분을 인용하지만 전체 요청 본문이나 서버 애플리케이션의 응답은 아닙니다. 또한 오류 생성은 rate limiting과 필터의 영향을 받으므로 오류가 없다고 정상 경로를 증명할 수 없습니다.

## ICMP 오류의 역할과 인용 데이터

ICMP error는 실패한 datagram의 송신자에게 네트워크 계층의 관찰을 알립니다. IPv4 RFC 792의 Destination Unreachable과 Time Exceeded 메시지는 원래 Internet Header와 원래 데이터의 첫 64비트를 포함합니다. 상위 프로토콜이 UDP나 TCP라면 일반적으로 이 앞부분에 source/destination port가 있어 수신 호스트가 어느 소켓 또는 처리와 연결할지 찾을 수 있습니다. IPv6 RFC 4443은 minimum IPv6 MTU를 넘기지 않는 범위에서 invoking packet을 가능한 많이 넣도록 요구합니다.

이 구조 때문에 ICMP 수신기는 먼저 인용된 원래 packet의 source/destination, protocol 또는 Next Header, transport identifier를 읽어 보냄 당시의 요청과 매칭합니다. UDP probe에 고유 port와 nonce를 넣었다면 여러 probe의 응답을 구분하는 데 도움이 됩니다. 그러나 인용이 잘리면 애플리케이션 ID가 없을 수 있고, ICMP 자체의 source와 원래 packet의 destination을 혼동하면 안 됩니다. ICMP가 완전한 애플리케이션 응답이라는 해석도 틀립니다.

```diagram
{"title":"오류 메시지는 원래 패킷의 단서를 운반합니다","caption":"오류 생성 지점은 원래 datagram을 폐기하고, 인용된 헤더·앞부분을 송신자에게 돌려보내 상관관계를 가능하게 합니다.","rows":[[{"id":"probe","label":"원래 probe","detail":["UDP port · nonce"]}],[{"id":"failure","label":"라우터 또는 목적지","detail":["TTL · MTU · 전달 실패"]}],[{"id":"icmp","label":"ICMP 오류","detail":["type/code · 인용 header"]}],[{"id":"match","label":"송신자 진단","detail":["5-tuple · probe 상태"]}]],"edges":[{"from":"probe","to":"failure","label":"처리 불가"},{"from":"failure","to":"icmp","label":"오류 생성 가능"},{"from":"icmp","to":"match","label":"원래 요청 매칭"}]}
```

## IPv4 Destination Unreachable code

IPv4 type 3 code 0은 routing table상 network unreachable을, code 1은 host unreachable을 나타낼 수 있습니다. code 2는 목적지 호스트에서 해당 protocol module이 활성화되지 않은 경우, code 3은 목적지 port에 수신 process가 없을 때 쓰입니다. code 4는 DF(Don’t Fragment)가 설정된 datagram을 더 작은 MTU 링크로 보내려 했지만 fragmentation할 수 없다는 상황입니다. code 5는 source route failed입니다. RFC 792는 gateway에서 받을 수 있는 code와 host에서 받을 수 있는 code를 구분하지만 현대 장비의 보고 방식은 경로 장비와 정책에 따라 달라질 수 있습니다.

따라서 같은 type 3이라도 바로 같은 재시도를 하면 안 됩니다. UDP probe에 destination port 33434를 사용했고 최종 호스트가 type 3/code 3을 보냈다면, 해당 probe가 목적지까지 도달했지만 그 port를 듣는 애플리케이션이 없다는 종료 신호로 해석할 수 있습니다. 반면 code 1이면 경로상 host 도달 실패, ARP, 라우팅, 장비 필터 등을 추가로 확인해야 합니다. code 4라면 페이로드를 줄이거나 PMTUD 경로를 고치는 쪽이 재시도 횟수를 늘리는 것보다 직접적인 대응입니다.

다만 RFC 792의 “may send” 표현처럼 일부 오류 보고는 선택적입니다. 중간 라우터가 type 3을 만들지 않거나 방화벽이 버리면 송신자는 timeout만 볼 수 있습니다. 그래서 code가 없다는 것을 code 0이나 code 1로 추정하지 말고, route table, ARP/neighbor 상태, capture, 애플리케이션 port listen 상태를 함께 확인합니다.

## TTL과 Time Exceeded

IPv4 packet의 TTL은 라우터를 지날 때 감소하며, 라우터가 0이 된 datagram을 폐기한 뒤 type 11/code 0을 송신자에게 보낼 수 있습니다. fragment를 목적지 호스트가 재조립하다가 정해진 시간 안에 필요한 조각을 받지 못하면 type 11/code 1이 될 수 있습니다. 두 code는 모두 “시간 초과”라는 외부 표시는 같지만, 전자는 forwarding path의 hop limit 소진이고 후자는 fragment 재조립 실패입니다.

traceroute는 이 TTL 소비를 의도적으로 이용합니다. TTL 1인 probe는 첫 번째 라우터에서 만료되고 그 라우터의 주소가 ICMP Time Exceeded source로 돌아옵니다. TTL 2 probe는 첫 라우터를 지나 두 번째 라우터에서 만료됩니다. TTL을 1, 2, 3으로 증가시키며 각 hop에서 돌아온 오류의 source와 왕복 시간을 기록하면 한 경로의 관찰 가능한 중간 지점을 추정할 수 있습니다. UDP 방식은 목적지의 폐쇄된 port를 사용해 최종 host에서 type 3/code 3을 종료 신호로 삼을 수 있고, ICMP 또는 TCP 방식은 다른 최종 응답을 사용합니다.

```text
probe 1: TTL=1 -> R1에서 0 -> ICMP type 11/code 0 -> R1 주소
probe 2: TTL=2 -> R1 통과, R2에서 0 -> ICMP type 11/code 0 -> R2 주소
probe 3: TTL=3 -> 목적지 도착 -> UDP port 미사용 -> ICMP type 3/code 3
```

위 숫자는 traceroute 알고리즘의 설명용 계산입니다. 실제 캡처를 실행한 결과가 아니며, 중간 hop별 왕복 시간은 같은 목적지 애플리케이션 요청의 latency와 일치한다고 보장하지 않습니다.

## 응답 공백과 경로 추론 한계

traceroute 출력의 `*`는 해당 probe에 대한 응답을 관찰하지 못했다는 뜻이지, 그 hop이 반드시 packet을 버렸다는 증거가 아닙니다. 라우터가 ICMP error를 만들지 않거나, rate limit을 적용하거나, 방화벽이 응답만 차단하거나, 반환 경로가 다를 수 있습니다. 한 라우터가 TTL-expired 응답을 제한해도 실제 forwarding은 계속할 수 있습니다. 서로 다른 probe가 ECMP로 다른 경로를 택하면 같은 hop 번호에 다른 주소가 나타납니다.

RFC 4443은 ICMPv6 error 생성에 rate limit을 요구하고, 단순 timer 하나로 일정 간격만 허용하는 방식은 bursty한 traceroute를 부당하게 처리할 수 있다고 설명합니다. 그러므로 probe를 한 번씩 보낸 결과보다 여러 번의 패턴, 대상 애플리케이션의 성공/실패, 양방향 capture를 함께 봅니다. 어느 한 hop부터 별표가 시작됐다는 이유로 그 장비가 이후 모든 traffic을 차단한다고 단정하지 않습니다.

## IPv6 Packet Too Big과 PMTUD

IPv6 router가 outgoing link의 MTU보다 큰 packet을 forwarding할 수 없으면 packet을 버리고 ICMPv6 type 2 Packet Too Big을 보냅니다. 메시지의 32비트 MTU 필드는 **next-hop link의 MTU**이고, 가능한 범위의 원래 packet이 함께 인용됩니다. 송신자는 이 값을 사용해 path MTU를 낮추고 이후 packetization 또는 TCP segment 크기를 조정해야 합니다. IPv6 router가 중간에서 fragmentation하지 않는다는 사실 때문에 이 feedback은 연결 유지에 중요합니다.

예를 들어 송신자가 IPv6 packet 1500바이트를 보내고 어느 터널 이후 link MTU가 1280이라면, 해당 router는 type 2와 MTU 1280을 보낼 수 있습니다. 송신자는 전체 packet 크기를 1280 이하로 줄이거나 TCP의 MSS·QUIC packetization이 그 경로에 맞춰지도록 해야 합니다. ICMPv6 오류가 필터링되면 handshake나 작은 요청은 성공하지만 큰 TLS certificate chain 또는 response data에서 재전송과 timeout이 반복되는 black hole이 될 수 있습니다. 이때 애플리케이션 timeout만 늘리면 폐기된 packet이 복구되지 않습니다.

IPv4 code 4와 IPv6 Packet Too Big은 모두 크기 문제를 알려주지만 세부 동작은 다릅니다. IPv4는 DF 설정과 fragmentation 가능성에 따라 경로가 달라지고, IPv6는 router fragmentation을 기대하지 않습니다. TCP MSS는 TCP payload 크기이므로 IP MTU와 같은 값이 아니며, VPN·GRE·QUIC 또는 다른 encapsulation header가 실제 사용 가능한 payload를 줄입니다.

## 오류 상관관계와 안전한 상태 변경

수신한 ICMP를 애플리케이션 요청에 연결할 때는 인용 packet의 5-tuple과 protocol identifier, transport sequence 또는 UDP port, 요청 ID를 확인합니다. UDP probe 포트만 재사용하면 늦게 도착한 오류가 새 probe에 잘못 매칭될 수 있으므로 nonce와 발송 시각·TTL을 함께 기록하는 편이 안전합니다. TCP의 경우 인용된 sequence와 connection tuple이 현재 socket의 세대와 맞는지 확인한 뒤 congestion 또는 PMTU 상태에 반영해야 합니다.

ICMP 오류는 spoofing되거나 중복될 수 있고, 인용 본문이 잘릴 수 있습니다. 따라서 한 오류만으로 계정 작업을 취소하거나 서버 장애를 확정하지 않고, 재현 가능한 패킷·상위 계층 로그·경로별 관찰을 결합합니다. Packet Too Big은 MTU 후보를 낮추는 유용한 신호지만, 값이 현재 경로와 맞는지 검증하고 너무 작은 값으로 영구 고정해 효율을 손상시키지 않습니다.

## 진단 절차와 구현 선택

먼저 오류의 IP version, ICMP type/code, source, 인용된 원래 tuple을 보존합니다. 다음으로 probe의 TTL/Hop Limit와 목적지 port 또는 nonce를 원본 송신 로그와 맞춥니다. TTL 만료라면 해당 hop의 응답 여부와 이후 hop·애플리케이션 도달을 분리하고, Destination Unreachable이라면 code의 의미에 맞춰 route·ARP/ND·protocol listener·MTU를 선택적으로 확인합니다. Packet Too Big이면 오류의 MTU와 캡슐화 경로, 송신 스택의 PMTU cache를 대조합니다.

운영 시스템은 ICMP를 단순 문자열로만 로그하지 말고 `type`, `code`, `quoted_protocol`, `quoted_ports`, `quoted_sequence`, `probe_id`, `path_mtu` 같은 구조화된 필드를 남기는 편이 좋습니다. 다만 모든 OS와 middlebox가 같은 인용 길이를 보장하지 않는다는 전제를 둡니다. 오류가 없는 경우에는 동일 probe의 timeout과 성공 경로를 비교하고 rate limit 때문에 생긴 관찰 공백을 고려합니다.

## 비용과 한계

traceroute는 경로의 제어 메시지 응답을 측정하는 도구이지 애플리케이션의 완전한 경로 지도나 성능 보증 도구가 아닙니다. probe가 실제 서비스 traffic과 다른 protocol·port·크기를 사용하면 방화벽, QoS, ECMP의 다른 정책을 통과할 수 있습니다. ICMP 오류를 전부 허용하면 진단에는 유리하지만 인터넷 경계에서 무제한 생성·전달을 허용해서는 안 되며 rate limiting과 필터 설계가 필요합니다.

또한 RFC 792와 RFC 4443은 각각 기본 메시지 형식과 생성 규칙을 제공하지만 최신 운영체제, 라우터, 터널, TCP/QUIC 구현의 PMTUD와 오류 전달 방식 전체를 하나의 RFC로 결정하지 않습니다. 이 글의 route와 MTU 숫자는 설명용 상태 추적이며 실제 네트워크 성공을 주장하지 않습니다.

## 참고 자료

- RFC 792, *Internet Control Message Protocol*, IPv4 type 3/code와 type 11/code, 원래 datagram 인용 형식.
- RFC 4443, *ICMPv6 for IPv6*, Destination Unreachable·Packet Too Big·Time Exceeded, 인용 범위와 rate limit.
- RFC 1191, IPv4 Path MTU Discovery를 추가로 대조할 자료. 이 문서에서는 전문 본문을 직접 검증하지 않아 세부 timer는 단정하지 않습니다.
- 기존 노트 `networking/datagram-contracts.md`, `questions/network-mtu-pmtud.md`: MTU와 데이터그램 전달 계약을 다루지만, 여기서는 ICMP type/code와 traceroute 상관관계를 중심으로 구분합니다.

### 참고 경로

- [https://www.rfc-editor.org/rfc/rfc792](https://www.rfc-editor.org/rfc/rfc792)
- [https://www.rfc-editor.org/rfc/rfc4443](https://www.rfc-editor.org/rfc/rfc4443)

위 링크는 개념별 참고 경로이며, 본문에서 명시한 확인 범위와 미확인 구현 조건을 함께 적용합니다.
