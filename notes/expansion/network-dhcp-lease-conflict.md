---
id: network-dhcp-lease-conflict
title: DHCP 임대 갱신과 주소 충돌
topic: 네트워크
summary: 'DHCP 초기 할당의 DORA와 T1·T2 갱신·재결합, 릴레이 경계, DECLINE으로 보고하는 주소 충돌을 상태 전이로 설명합니다.'
questionIds: []
prerequisites:
  - computer-science-foundations
related:
  - dns-transition
reviewedAt: '2026-09-19'
---
# DHCP 임대 갱신과 주소 충돌

DHCP는 “IP 하나를 받아 왔다”는 단일 요청이 아니라, client가 제안 후보를 받고 특정 server를 선택하고, server가 binding을 저장하고, 만료 전에 그 binding을 연장하는 상태 프로토콜입니다. `DHCPOFFER`가 보였다는 사실만으로 주소가 확정된 것은 아니며, 보통 `DHCPREQUEST`와 선택된 server의 `DHCPACK`까지 확인해야 client가 해당 주소를 사용할 수 있습니다. 이후에도 T1과 T2가 지나면서 통신 상대와 전송 방식이 달라지고, ACK 직후 중복 주소가 발견되면 `DHCPDECLINE`으로 다시 초기화해야 합니다.

이 글은 RFC 2131의 DHCPv4 상호작용을 중심으로 설명합니다. DHCP 서버의 pool quarantine, 운영자 경보, switch 보안 기능은 RFC가 모든 구현 세부를 고정하지 않으므로 권고와 구현 정책을 나누어 기록합니다. T1/T2의 숫자는 server option으로 조정될 수 있으며 기본값은 설명용 기준이지 모든 client가 동일한 상수라는 뜻이 아닙니다.

## 임대 binding과 DORA

초기 할당은 흔히 DORA로 부르는 네 단계로 읽습니다. client는 local physical subnet에 `DHCPDISCOVER`를 broadcast해 server를 찾습니다. server는 사용 가능한 `yiaddr`와 option을 담아 `DHCPOFFER`를 보냅니다. client는 여러 offer를 비교한 뒤 하나를 선택해 `DHCPREQUEST`를 broadcast하고, 이 요청에는 선택한 server identifier와 offer의 requested IP가 들어갑니다. 선택된 server는 client binding을 persistent storage에 commit한 뒤 `DHCPACK`으로 configuration과 committed network address를 전달합니다.

여러 server가 `.20`과 `.30`을 제안했다고 하겠습니다. client가 `.20`을 선택한 `DHCPREQUEST`를 broadcast하면 server A는 binding을 commit하고, server B는 자신의 offer가 선택되지 않았다는 통지를 받습니다. 따라서 offer는 예약처럼 보일 수 있어도 확정된 lease가 아닙니다. server는 offer 주소를 잠시 unavailable로 둘 수 있지만, 요청이 오지 않으면 다시 available로 표시하는 정책을 가질 수 있습니다. 실제 동시 할당 방지의 강도는 server 구현과 저장소 계약에 달려 있습니다.

```diagram
{"title":"제안과 확정된 binding은 다른 상태입니다","caption":"OFFER는 후보를 만들고 REQUEST가 선택을 알린 뒤 ACK 시점에 server가 binding을 저장합니다. 주소 충돌은 확정 뒤에도 다시 초기화를 일으킬 수 있습니다.","rows":[[{"id":"discover","label":"DHCPDISCOVER","detail":["client broadcast"]}],[{"id":"offer","label":"DHCPOFFER","detail":["주소 후보 · option"]}],[{"id":"request","label":"DHCPREQUEST","detail":["선택 server 식별"]}],[{"id":"ack","label":"DHCPACK","detail":["binding commit"]}],[{"id":"check","label":"최종 충돌 검사","detail":["사용 중이면 DECLINE"]}]],"edges":[{"from":"discover","to":"offer","label":"server 후보 응답"},{"from":"offer","to":"request","label":"client 선택"},{"from":"request","to":"ack","label":"server 저장 후 확인"},{"from":"ack","to":"check","label":"주소 사용 전 점검"}]}
```

## 초기 할당의 broadcast와 선택

초기 client는 아직 주소가 없으므로 `ciaddr`를 채울 수 없고 local subnet broadcast에 DISCOVER를 보냅니다. client는 하나의 offer를 즉시 선택할 수도 있고 여러 offer를 잠시 모은 뒤 option과 정책을 비교할 수도 있습니다. REQUEST는 원래 DISCOVER와 같은 broadcast 조건을 유지하며 relay agent를 거쳐 같은 server 집합에 전달될 수 있어야 합니다. 선택되지 않은 server는 REQUEST를 보고 자신의 offer가 거절되었다고 해석합니다.

server가 ACK를 보냈을 때에야 client는 DHCPACK의 lease duration과 다른 configuration을 기록하고 configured 상태로 이동합니다. ACK 전후를 로그에서 구분하려면 transaction ID, client identifier 또는 `chaddr`, requested IP, server identifier를 함께 남기는 편이 좋습니다. `DHCPOFFER`만 있고 REQUEST가 없으면 “주소를 받았다”고 기록하지 않고, ACK가 있지만 최종 검사에서 충돌하면 정상 configured 상태로 확정하지 않습니다.

## T1 갱신과 원래 server

client는 lease에 대해 T1과 T2라는 상대 시간을 유지합니다. RFC 2131의 기본값은 T1이 lease duration의 0.5, T2가 0.875이며 server가 option으로 조정할 수 있습니다. T1은 RENEWING 상태로 들어가는 시점입니다. 이때 client는 원래 주소를 발급한 server에 unicast `DHCPREQUEST`를 보내고, `ciaddr`에 현재 주소를 넣으며 server identifier는 넣지 않습니다. server가 `DHCPACK`을 보내면 client는 ACK의 lease duration을 기준으로 만료 시각을 다시 계산하고 BOUND로 돌아갑니다.

예를 들어 lease가 3600초라면 설명용 기본값으로 T1은 1800초, T2는 3150초입니다. 실제 option이 다른 값을 주면 그 값을 따라야 합니다. T1에서 server까지의 unicast가 실패했다고 해서 즉시 주소를 버리지는 않습니다. client는 T2 이전에 재전송할 수 있고, 이 구간은 원래 server가 아직 살아 있을 수 있는 조용한 갱신 단계입니다. ACK의 transaction ID가 현재 REQUEST와 맞지 않으면 오래된 응답을 현재 lease에 적용하지 않습니다.

## T2 rebinding과 만료

T2까지 원래 server의 ACK를 받지 못하면 client는 REBINDING 상태로 이동합니다. 이제 특정 server에 고정할 수 없으므로 `DHCPREQUEST`를 broadcast하고 server identifier를 넣지 않아 다른 DHCP server도 요청을 처리할 수 있게 합니다. 목적은 장애 난 원래 server만 기다리는 것이 아니라 같은 subnet 또는 relay 경로에 있는 권한 있는 server로 lease를 연장하는 것입니다.

T1=1800초, T2=3150초인 3600초 lease를 예로 들면 1800초부터 원래 server에 unicast, 3150초부터 broadcast rebinding, 3600초가 되면 lease expiry입니다. 3600초 전에 ACK를 받지 못하면 client는 INIT으로 돌아가 즉시 다른 network processing을 멈추고 초기화 요청을 시작해야 합니다. lease가 끝난 뒤 이전 주소를 계속 사용하면서 “재시도가 될 때까지” 기다리는 것은 DHCP 계약과 맞지 않습니다.

T1/T2 요청이 응답을 받지 못할 때의 재전송 간격도 RFC에 규칙이 있지만 client 구현에 따라 로그 타이밍이 달라질 수 있습니다. 운영에서는 lease start, T1, T2, expiry, REQUEST destination mode, ACK/NAK transaction ID를 기록합니다. 여러 client가 같은 시각에 갱신해 broadcast burst가 생기지 않도록 RFC는 T1/T2에 random fuzz를 둘 수 있다고 설명합니다.

## 릴레이와 subnet 경계

DHCP relay agent는 local broadcast domain을 그대로 늘리는 장치가 아닙니다. client의 broadcast를 해당 VLAN/SVI의 relay가 받아 server subnet으로 전달하고, relay 정보와 interface context를 이용해 server가 어느 client subnet의 pool을 선택할지 판단하게 합니다. server의 OFFER·ACK·NAK는 relay를 통해 client subnet으로 돌아옵니다. 따라서 server가 각 L2 세그먼트에 하나씩 존재하지 않아도 되지만, helper 주소, relay interface, `giaddr` 처리, ACL과 option 전달이 맞아야 합니다.

VLAN 20의 client가 DISCOVER를 보냈고 SVI relay가 DHCP server로 전달한다고 하겠습니다. server는 relay가 알려준 subnet에 맞는 `.20.x` pool에서 offer를 만들고, relay는 그 응답을 client의 hardware address 또는 broadcast 조건에 맞춰 전달합니다. client가 아직 올바른 IP를 가지고 있지 않아도 relay가 전달 경계를 대신 처리할 수 있습니다. 반대로 relay가 잘못된 `giaddr`를 넣으면 다른 pool이 선택되어 ACK는 오지만 잘못된 subnet mask나 gateway가 내려갈 수 있습니다.

T1 갱신은 현재 주소가 있는 client가 원래 server로 unicast할 수 있는 상태를 전제로 합니다. T2 rebinding의 broadcast는 local subnet에서 relay를 거쳐 다른 server까지 도달할 수 있습니다. 어떤 단계에서 broadcast가 필요한지와 relay가 실제로 어떤 destination으로 변환하는지를 packet capture에서 분리해 보아야 합니다. “DHCP는 모든 broadcast가 라우터를 통과한다”는 설명은 틀립니다.

## ACK 뒤의 주소 충돌과 DECLINE

RFC 2131은 client가 DHCPACK를 받은 뒤 ARP 등으로 최종 configuration을 점검하도록 합니다. 이미 같은 주소를 사용하는 호스트가 발견되면 client는 `DHCPDECLINE`을 server에 보내고 configuration process를 다시 시작해야 합니다. 초기 할당 절차에서는 과도한 traffic을 피하기 위해 최소 10초 기다린 뒤 재시작하도록 권고합니다. DECLINE은 단순히 로컬 ARP cache를 지우는 메시지가 아니라 “이 network address는 이미 사용 중”이라는 server 보고입니다.

예를 들어 client가 `.20` ACK를 받고 probe했는데 MAC `aa:...` 응답이 돌아오고 자신의 MAC이 아니라고 합시다. client는 `.20`을 정상 주소로 계속 올리지 않고 server에 DECLINE을 보냅니다. server는 해당 주소를 다시 즉시 offer하지 않도록 제외할 수 있지만, RFC 2131이 특정 quarantine duration이나 운영자 alert 시스템을 표준화하지는 않습니다. 따라서 “server가 반드시 30분 차단한다”와 같은 정책은 구현 문서 없이는 말할 수 없습니다.

충돌 원인은 static host, 다른 DHCP server, 복원된 오래된 lease, relay/VLAN 오설정 등 다양합니다. server log의 binding과 client의 transaction, ARP/neighbor 응답의 MAC, switch port를 함께 대조해야 원인을 좁힐 수 있습니다. 충돌 검사가 응답을 받지 못했다고 주소의 유일성이 증명되는 것도 아닙니다. 조용한 호스트, 보안 필터, probe 방식의 한계가 남습니다.

## 상태 추적과 중간 값

다음은 lease duration 3600초와 RFC 기본 T1/T2를 사용한 설명용 상태표입니다.

| 상대 시각 | client 상태 | 요청 방식 | 허용된 판단 |
| ---: | --- | --- | --- |
| 0 | BOUND 직후 | ACK 기록 | `.20` 사용 시작, expiry=3600 |
| 1800 | RENEWING | 원래 server로 unicast REQUEST | ACK면 새 expiry 계산 |
| 3150 | REBINDING | server identifier 없는 broadcast REQUEST | 어느 권한 server든 ACK 가능 |
| 3600 | INIT | 기존 주소 사용 중지 | 새 DISCOVER/REQUEST 시작 |

이 표는 서버가 T1/T2 option을 생략하고 기본값을 사용한다는 설명용 계산입니다. 실제 client가 1800초와 3150초에 정확히 송신한다는 측정 결과가 아니며, jitter·재전송·시계·절전·OS scheduler가 로그 시각을 바꿀 수 있습니다. 핵심은 시각 숫자가 아니라 원래 server만 겨냥하던 단계가 any server를 허용하는 단계로 바뀌고, expiry 뒤에는 이전 주소 사용권이 끝난다는 순서입니다.

## 구현과 검증 절차

DHCP client를 구현하거나 장애를 분석할 때 상태 전이를 packet type만으로 추정하지 않습니다. `xid`, client identifier/`chaddr`, requested IP, `yiaddr`, server identifier, `ciaddr`, `giaddr`, broadcast flag, lease duration과 T1/T2 option을 같은 trace ID로 묶습니다. 초기 할당에서는 OFFER 수와 선택된 server를, 갱신에서는 REQUEST destination과 server identifier 유무를, 충돌에서는 probe와 DECLINE을 별도로 기록합니다.

검증은 local subnet과 relay subnet을 나눠 진행합니다. 두 server가 서로 다른 offer를 주는 경우 선택되지 않은 server가 주소를 회수하는지, T1에서 unicast가 실패할 때 T2에서 broadcast로 바뀌는지, expiry 후 이전 주소를 쓰는 작업이 멈추는지 확인합니다. ACK 뒤 다른 장비가 주소를 사용하는 상황은 허가된 테스트 VLAN에서만 재현하고, server의 실제 quarantine과 alert 동작은 구현 문서로 검증합니다.

## 비용과 한계

DHCP broadcast와 relay는 중앙 pool을 공유하게 해 운영을 단순화하지만, relay 한 지점의 장애와 잘못된 helper 설정이 여러 VLAN에 동시에 영향을 줍니다. T2 rebinding은 복구 기회를 늘리지만 broadcast와 server 선택의 불확실성을 만들며, ACK가 늦게 도착하는 경합은 transaction ID로 걸러야 합니다. lease duration을 지나치게 짧게 하면 갱신 traffic이 커지고, 지나치게 길게 하면 죽은 client 주소가 오래 묶일 수 있습니다.

또한 RFC 2131은 DHCPv4 상호작용을 정의하지만 모든 server cluster의 binding 일관성, DHCP snooping, IP source guard, 무선 절전, 운영 경보를 동일하게 정하지 않습니다. 주소 충돌을 발견했다는 client 보고와 운영자가 원인을 해결했다는 사실도 다릅니다. 최종 판단은 protocol trace와 server 저장소·L2 관찰을 함께 두고 내립니다.

## 참고 자료

- RFC 2131, *Dynamic Host Configuration Protocol*, DORA, relay, T1/T2, lease expiry, DHCPDECLINE 절차.
- RFC 2132, DHCP options 정의를 추가로 확인할 자료. 이 문서에서는 RFC 2131의 option 참조와 state machine을 중심으로 대조했습니다.
- 기존 노트 `networking/dns-transition.md`: 주소 이름 전환과 기존 연결 수명을 다루며, 이 글은 DHCP binding과 lease state를 구분합니다.

### 참고 경로

- [https://www.rfc-editor.org/rfc/rfc2131](https://www.rfc-editor.org/rfc/rfc2131)

위 링크는 개념별 참고 경로이며, 본문에서 명시한 확인 범위와 미확인 구현 조건을 함께 적용합니다.
