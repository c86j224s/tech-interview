---
id: network-ipv4-cidr-routing
title: IPv4 CIDR와 최장 접두사 라우팅
topic: 네트워크
summary: CIDR 접두사로 주소 블록을 나누고 겹치는 경로에서는 가장 구체적인 접두사를 선택하며 요약 경로의 누락·루프 경계를 설명합니다.
questionIds: []
prerequisites:
  - tcp-throughput
related:
  - dns-transition
reviewedAt: '2026-09-19'
---
# IPv4 CIDR와 최장 접두사 라우팅

CIDR은 IPv4 주소의 앞쪽 비트 수를 `/n`으로 명시하여 블록 크기, on-link 판정, forwarding table의 일치 범위를 표현합니다. 핵심은 주소를 계산하는 데서 끝나지 않습니다. 여러 경로가 한 목적지에 일치하면 더 긴 접두사가 더 구체적인 후보가 되고, 연속·정렬된 주소를 묶으면 aggregate를 만들 수 있습니다. 반대로 aggregate 안의 구성요소가 사라졌는데 요약 라우터가 더 넓은 경로로 되돌리면 loop가 생길 수 있어 discard/null 경계가 필요합니다.

## 접두사 비트와 블록 크기

IPv4는 32비트이므로 `/n`은 왼쪽 n비트를 고정하고 나머지 `32-n`비트를 블록 내부에서 변화시킨다는 뜻입니다. 주소 수는 `2^(32-n)`입니다. 따라서 `/26`은 64개, `/24`는 256개, `/0`은 2^32개 범위입니다. 블록 시작은 해당 크기 경계에 정렬되어야 합니다.

`192.0.2.64/26`에서는 마지막 옥텟의 mask가 `192`입니다. `.64 & .192 = .64`, `.127 & .192 = .64`, `.128 & .192 = .128`이므로 `.127`은 .64 블록에, `.128`은 다음 .128 블록에 들어갑니다. 이는 주소 소속 계산입니다. host 사용 가능 범위, broadcast 예약, DHCP 정책은 별도의 운영 규칙이므로 같은 질문으로 합치지 않습니다.

## 주소 소속 검산

```diagram
{"title":"CIDR 후보와 최장 일치","caption":"목적지와 일치하는 모든 prefix를 모은 뒤 고정 비트 수가 가장 큰 경로를 선택합니다.","rows":[[{"id":"dst","label":"목적지","detail":["10.1.2.3","IPv4 32비트"]}],[{"id":"wide","label":"넓은 경로","detail":["10.0.0.0/8","8비트 고정"]},{"id":"narrow","label":"구체 경로","detail":["10.1.0.0/16","16비트 고정"]}],[{"id":"pick","label":"선택","detail":["/16 일치","next hop 결정"]}]],"edges":[{"from":"dst","to":"wide","label":"일치"},{"from":"dst","to":"narrow","label":"일치"},{"from":"wide","to":"pick","label":"비교"},{"from":"narrow","to":"pick","label":"더 긴 접두사"}]}
```

계산 실수는 마지막 옥텟만 보고 경계를 추측하거나 prefix 길이를 주소 개수로 읽는 데서 생깁니다. 안전한 작은 검산은 정수 주소에 mask를 AND하고, 결과가 route network와 같은지 비교하는 것입니다. 예를 들어 `/26`의 마지막 옥텟 mask `11000000`에 `.127=01111111`을 AND하면 `01000000`, `.128=10000000`을 AND하면 `10000000`입니다. 이 글의 수치는 설명용 계산이며 실제 route daemon을 실행한 결과가 아닙니다.

## Longest-prefix match

`10.0.0.0/8`과 `10.1.0.0/16`이 있고 목적지가 `10.1.2.3`이면 두 경로 모두 일치합니다. `/8`은 앞 8비트, `/16`은 앞 16비트를 고정하므로 같은 forwarding table의 matching candidates 중 `/16`이 more-specific입니다. `/16`을 설치한 next hop으로 보낸 뒤 동일한 prefix 길이 후보의 metric이나 정책을 따로 비교합니다.

이 설명을 모든 protocol RIB의 완전한 route-selection 순서로 확대하면 안 됩니다. RFC 4632 §5.1은 forwarding을 longest-match basis로 설명하지만 administrative distance, protocol별 RIB 선택, FIB 설치 순서는 구현·프로토콜마다 다를 수 있습니다. 장애 시 목적지, 설치된 mask, 선택된 next hop, RIB와 FIB의 차이를 각각 기록합니다.

## 집계와 정렬

CIDR aggregation은 여러 세부 prefix를 하나의 더 짧은 prefix로 나타내어 외부에 광고하는 방식입니다. 두 `/24`를 `/23`으로 합치려면 연속성만이 아니라 `/23` 경계 정렬도 필요합니다. `198.51.100.0/24`와 `198.51.101.0/24`는 `198.51.100.0/23`으로 정렬되지만, 임의의 두 연속 숫자가 언제나 하나의 정확한 prefix가 되는 것은 아닙니다.

주소 할당 경계가 ISP의 토폴로지와 맞으면 ISP는 고객별 세부 경로 대신 큰 aggregate를 광고할 수 있습니다. 그러나 집계는 내부 구성요소의 생존을 자동으로 증명하지 않습니다. 집계 안에 포함되지 않아야 할 주소까지 보낼 위험이 있으면 여러 prefix로 남기거나 할당 경계를 재설계해야 합니다.

## Aggregate와 discard 경로

RFC 4632 §5.1은 aggregate에 일치하지만 aggregate 내부의 더 구체적인 constituent route에는 일치하지 않는 트래픽을 aggregate router가 discard해야 한다고 설명합니다. 예를 들어 `198.51.100.0/24`와 `198.51.101.0/24`를 `198.51.100.0/23`으로 요약 광고한 뒤 `198.51.101.0/24` 연결이 사라졌다고 하겠습니다. 목적지 `198.51.101.7`에는 살아 있는 `/24`가 없으므로 `/23`의 discard가 선택되어야 합니다.

RFC의 normative discard 요구와 실제 null route 설치 방식은 구분합니다. §5.2는 이를 보통 null/discard next hop으로 구현하는 모델을 설명하지만, 어느 CLI와 어떤 동적 광고 조건을 사용할지는 장비·프로토콜 정책입니다. 살아 있는 `198.51.100.0/24`에는 더 긴 `/24`가 있으므로 정상 전달하고, 누락된 `.101.0/24`만 null로 버리는 것이 의도입니다.

## 멀티홈과 more-specific

두 ISP에 연결된 조직은 일반적으로 어느 한 provider aggregate 안에만 주소를 숨기기 어렵습니다. 두 provider가 모두 reachability를 알아야 하므로 고객 prefix를 각 provider가 명시적으로 광고하거나, 기존 aggregate보다 긴 more-specific을 광고하는 경우가 생깁니다. 한 provider 주소를 renumber하지 않고 다른 provider로 옮기면 B의 more-specific이 A의 넓은 aggregate보다 longest-prefix로 우선될 수 있지만, 전역 경로 수와 필터 관리 비용이 증가합니다.

다만 “멀티홈이면 절대로 집계 불가”는 틀립니다. RFC 4632 §4.1의 예외처럼 고객이 연속된 power-of-two 블록을 가지고 상위 토폴로지의 경계와 맞으면 일부 aggregate가 가능합니다. 그러므로 일반적으로 집계 효율이 약화된다고 말하되, 정렬·연속성·provider topology에 따라 일부 집계 여지가 있다는 조건을 함께 둡니다. 같은 `/24`가 두 ISP에 있다는 사실만으로 자동 부하 분산이 되는 것도 아닙니다. local preference, AS path, 필터와 철회 정책이 관여합니다.

## 실패 관측과 traceroute

aggregate가 계속 광고되는데 constituent route 하나가 내려가면 외부 패킷은 요약 라우터까지 올 수 있습니다. null route가 있으면 의도된 blackhole에서 종료되고, 없으면 default나 덜 구체적인 상위 경로로 돌아가 loop가 생길 수 있습니다. RFC 4632는 traceroute 같은 관측이 문제를 aggregate를 광고한 네트워크 내부 문제처럼 보이게 할 수 있다고 설명합니다. 특정 환경에서 요약 라우터 근처에서 멈추는 모양은 관측 결과이지 모든 환경의 보장된 표시가 아닙니다.

진단 순서는 `목적지 → 일치하는 prefix 전체 → 선택된 prefix length → next hop/null → constituent 상태 → 외부 광고`입니다. RIB에는 route가 있어도 FIB에 설치되지 않았을 수 있고, aggregate advertisement가 남아 있어도 내부 세부 경로가 없을 수 있습니다. 마지막 traceroute hop만 보고 장애 원인을 확정하지 않습니다.

## 비용과 검증

짧은 prefix와 more-specific을 과도하게 광고하면 전역 routing table, 메모리, 업데이트와 수렴 비용이 커집니다. 넓은 aggregate만 광고하면 내부 일부 장애를 외부에 정확히 표현하기 어렵습니다. null route는 loop를 막지만 구성요소 복구 전까지 의도적인 blackhole을 만들므로 생성·철회 조건이 중요합니다.

격리된 라우팅 table에서 `/8`과 `/16`을 함께 넣어 `/16`으로 가는지, `/16`을 제거하면 `/8`으로 내려가는지 확인합니다. 별도로 `/23` summary와 두 `/24`를 넣은 뒤 `.100`은 more-specific, `.101.7`은 null로 가는지 추적합니다. 멀티홈 실험에서는 정책을 고정한 상태에서 한 링크를 철회하고 외부 관측 지점의 prefix와 next hop을 기록합니다. 이 문서의 숫자는 안전한 설명용 계산이며 실제 BGP 세션을 실행하지 않았습니다.

## 참고자료와 확인 범위

- RFC 4632 / BCP 122, [https://www.rfc-editor.org/rfc/rfc4632](https://www.rfc-editor.org/rfc/rfc4632): §3.1 prefix 표기와 블록, §4.1 aggregation·multihoming, §5.1 longest-match와 discard, §5.2 null 구현, §6.2 관측 경계를 본문에서 확인했습니다.
- RFC 4632는 2006년 BCP입니다. 현재 registry 정책이나 특정 BGP 구현 기본값을 주장하는 근거로 사용하지 않았습니다.
- `/26`, `/8`, `/16`, `/23` 계산은 prefix mask를 적용한 설명용 검산입니다. 실제 RIB/FIB와 BGP 선택은 장비 출력으로 별도 검증해야 합니다.
