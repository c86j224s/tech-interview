---
id: network-arp-resolution
title: ARP 이웃 발견과 주소 해석
topic: 네트워크
summary: 라우팅으로 선택한 다음 홉의 IPv4 주소를 Ethernet 하드웨어 주소로 바꾸는 요청·응답·캐시 갱신과 충돌 경계를 설명합니다.
questionIds: []
prerequisites:
  - tcp
related:
  - wire-format
  - tcp-throughput
reviewedAt: '2026-09-19'
---
# ARP 이웃 발견과 주소 해석

IPv4 패킷은 최종 목적지 주소를 가지고 출발하지만, Ethernet 링크에서 바로 필요한 값은 다음 홉의 MAC 주소입니다. ARP는 라우팅을 대신하는 이름 서비스가 아니라, 라우팅이 정한 현재 링크의 protocol address를 hardware address로 해석하는 동적 절차입니다. 따라서 원격 목적지의 IP와 첫 링크의 Ethernet 목적지는 달라질 수 있습니다. RFC 826 본문은 packet generation에서 next hop과 outgoing hardware를 먼저 정하고, 수신 과정에서 sender association을 갱신한 뒤 target 여부에 따라 reply를 만드는 흐름을 설명합니다.

## 라우팅과 다음 홉

최종 IP 목적지가 `198.51.100.40`이고 송신 링크가 그 네트워크에 직접 연결되지 않았다면 route table은 예를 들어 `198.51.100.1`을 immediate next hop으로 선택합니다. 첫 링크에서 ARP가 찾는 것은 `.40`의 MAC이 아니라 `.1`의 MAC입니다. IP 헤더의 destination은 `.40`으로 유지되고, Ethernet 헤더의 destination만 gateway MAC으로 채워집니다. 라우터가 다음 링크로 넘길 때에는 그 링크의 next hop에 대해 다시 별도의 주소 해석이 필요합니다.

이 순서를 뒤집으면 ARP가 경로를 선택한다고 오해하게 됩니다. 실제 OS는 miss 중인 datagram을 큐에 넣거나 폐기하고 재시도할 수 있지만, 그 정확한 횟수와 큐 정책은 RFC 826이 공통으로 정하지 않습니다. 캡처에서는 route table, ARP cache, request target protocol address, reply 뒤의 Ethernet 헤더를 같은 시간선에서 읽어야 합니다.

## ARP 필드와 요청

ARP 메시지는 hardware type, protocol type, 각 주소 길이, opcode, sender hardware/protocol address, target hardware/protocol address를 포함합니다. Ethernet과 IPv4 조합에서는 hardware address가 보통 6바이트, protocol address가 4바이트입니다. request는 target hardware address를 아직 모르므로 의미 있는 MAC을 채우지 않아도 되고, Ethernet의 목적지는 해당 L2 영역의 broadcast가 됩니다.

```diagram
{"title":"다음 홉 MAC 해석","caption":"라우팅 결과의 next hop을 현재 링크의 MAC으로 바꾸고 나서 원래 IP 목적지로 전송합니다.","rows":[[{"id":"route","label":"라우팅 결정","detail":["IP dst=.40","next hop=.1"]}],[{"id":"cache","label":"Cache 조회","detail":[".1 → MAC","hit 또는 miss"]}],[{"id":"req","label":"ARP request","detail":["L2 broadcast","target protocol=.1"]}],[{"id":"rep","label":"Reply 수신","detail":["sender MAC 관찰","매핑 갱신"]}],[{"id":"data","label":"데이터 전송","detail":["IP dst=.40 유지","Ethernet dst=next-hop MAC"]}]],"edges":[{"from":"route","to":"cache","label":"대상 결정"},{"from":"cache","to":"req","label":"miss"},{"from":"req","to":"rep","label":"응답"},{"from":"rep","to":"data","label":"해석 완료"}]}
```

설명용 상태는 `route(.40)=next-hop .1`, `cache[.1]=없음`에서 시작합니다. request를 broadcast한 뒤 `.1 → 02:00:00:00:00:01` reply를 받으면 `cache[.1]=02:00:00:00:00:01`이 됩니다. 같은 datagram의 IP destination은 계속 `.40`이고 첫 링크의 Ethernet destination만 MAC으로 채워집니다. 이는 안전한 작은 상태 추적이며 특정 OS의 실측 결과가 아닙니다.

## 수신과 sender association

RFC 826의 Packet Reception 알고리즘에서 중요한 순서는 sender association의 처리 시점입니다. 수신자는 opcode와 target 검사를 하기 전에 sender protocol address와 sender hardware address를 translation table에서 찾아 기존 항목을 갱신할 수 있습니다. 이미 항목이 있으면 hardware address가 바뀔 수 있습니다. 그러나 미등록 항목의 생성은 원문 제안 알고리즘에서 수신자가 자신의 target protocol address인지 확인하는 조건과 연결되어 있으므로, 기존 항목 갱신과 새 항목 생성은 같은 문장으로 일반화하면 안 됩니다.

따라서 unsolicited ARP가 모든 수신자의 빈 cache에 언제나 새 항목을 만든다고 말하면 과합니다. 기계적 규칙은 “기존 sender 매핑은 target이 아니어도 refresh/replacement될 수 있고, 새 항목 생성은 target 조건을 포함한 수신 알고리즘 및 구현 정책을 따른다”입니다. 운영체제는 추가 필터를 둘 수 있고, RFC 826은 인증이나 스푸핑 방어를 제공하지 않습니다.

## Cache aging과 재시도

RFC 826은 translation table에 association을 넣고 갱신하는 원리를 설명하지만 모든 구현이 공유할 cache expiration 숫자를 정하지 않습니다. “ARP cache는 항상 60초” 같은 답은 OS와 설정을 무시한 것입니다. 진단에서 확인할 값은 현재 IP-to-MAC, 상태, 마지막 갱신 시각, 실제 request 재시도, 실패 시 상위 계층의 오류입니다.

cache hit인데도 통신이 실패하면 MAC이 현재 연결을 가리키는지, 스위치 FDB 포트가 맞는지, next hop이 살아 있는지 확인합니다. miss에서 request가 반복되면 ARP reply 유실, VLAN 경계, 잘못된 prefix, 중복 주소를 후보로 둡니다. TCP 재전송만 보고 ARP 실패를 확정하지 말고, ARP와 Ethernet 캡처를 같은 시각에 맞춥니다.

## 원격 주소와 proxy ARP

`10.0.1.20/24`가 `10.0.2.30`으로 보낼 때 보통 `.30`은 on-link가 아니므로 `10.0.1.1` 같은 router next hop의 MAC을 찾습니다. 원격 호스트 `.30`의 MAC을 현재 LAN에서 직접 ARP하지 않습니다. router는 IP destination `.30`을 유지하고 다음 링크에서 새 Ethernet header를 구성합니다.

proxy ARP가 켜져 있으면 router가 원격 protocol address를 대신하여 자신의 MAC으로 응답할 수 있습니다. 이것은 첫 링크에서 사용할 MAC을 제공하는 기능이지 L3 forwarding, ACL, 경로 선택을 없애는 기능이 아닙니다. proxy ARP의 응답 범위와 기본값은 RFC 826의 기본 request/reply와 별도의 구현·설정 사항이며, RFC 1027은 proxy gateway 모델을 설명하는 추가 참고자료입니다.

## 중복 주소와 보안 경계

동일 protocol address에 MAC X와 MAC Y가 짧은 시간에 번갈아 나타나면 duplicate address와 spoofing을 모두 후보로 둡니다. cache가 마지막 packet에 따라 바뀌었다는 결과만으로 원인을 확정할 수 없습니다. DHCP lease와 binding, 스위치 포트, 링크 up/down, announcement 방향, 장비 이동 여부를 공통 시간선에 올립니다.

RFC 5227의 IPv4 Address Conflict Detection(ACD)은 probing과 announcement를 별도로 다루므로 전통적인 gratuitous ARP와 완전한 동일 개념으로 섞지 않습니다. 정상적인 주소 변경도 cache replacement를 만들 수 있고, 공격자는 같은 효과를 만들 수 있습니다. DHCP snooping과 Dynamic ARP Inspection은 현대 네트워크 방어의 예이며 RFC 826 자체의 인증 절차가 아닙니다.

## 구현 선택과 검증

수신한 sender 정보를 즉시 반영하면 이동과 장애 복구를 빠르게 따라가지만 위조 packet에 취약할 수 있습니다. 반대로 엄격히 제한하면 정상적인 주소 이동의 반영이 늦어집니다. 팀의 운영 계약에는 cache 상태 전이, 신뢰 가능한 ingress, 실패 시 상위 오류, 예외적인 proxy ARP 정책을 명시해야 합니다.

검증은 hit와 miss를 분리합니다. hit에서는 request 없이 기존 MAC으로 frame이 나가는지, miss에서는 request가 현재 L2 영역에만 나타나는지 확인합니다. 원격 목적지에서는 target protocol address가 gateway인지 확인하고, proxy ARP 환경에서는 request target이 원격 IP여도 router가 응답하는지와 이후 ACL을 별도로 확인합니다. 두 MAC 경쟁 테스트에서는 packet, FDB, DHCP binding을 하나의 시간선으로 저장합니다.

## 비용과 참고자료

ARP miss는 broadcast와 응답 대기를 추가하며, 동시 miss가 많으면 링크와 CPU 비용이 커집니다. cache를 너무 오래 보관하면 낡은 MAC으로 보낼 수 있고, 너무 빨리 버리면 broadcast와 지연이 늘어납니다. 이 trade-off의 수치는 구현 문서에서 확인해야 합니다.

- RFC 826, [https://www.rfc-editor.org/rfc/rfc826](https://www.rfc-editor.org/rfc/rfc826): packet fields, next-hop 전제, request/reply, Packet Reception의 sender association 순서를 본문에서 확인했습니다.
- RFC 5227, [https://www.rfc-editor.org/rfc/rfc5227](https://www.rfc-editor.org/rfc/rfc5227): ACD probing·announcement의 별도 범위를 확인하는 참고자료입니다.
- RFC 1027, [https://www.rfc-editor.org/rfc/rfc1027](https://www.rfc-editor.org/rfc/rfc1027): proxy ARP gateway 모델의 참고자료입니다.
- cache timer, OS 큐잉, inspection 기본값은 읽은 RFC에서 공통 수치로 확인하지 않았습니다. 숫자와 실제 패킷 결과는 구현별 검증 대상입니다.
