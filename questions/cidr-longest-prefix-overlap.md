---
id: cidr-longest-prefix-overlap
title: 10.0.0.0/8과 10.1.0.0/16 경로가 모두 있을 때 10.1.2.3에는 어느 경로를 사용하나요?
difficulty: 하
category: 네트워크
tags:
  - CIDR
  - longest-prefix match
  - 라우팅
related: []
---
# 10.0.0.0/8과 10.1.0.0/16 경로가 모두 있을 때 10.1.2.3에는 어느 경로를 사용하나요?

## 구두 답변

`10.1.2.3`에는 두 prefix가 모두 일치하지만, 같은 forwarding table에서 matching 후보를 비교하면 `/16`인 `10.1.0.0/16`이 `/8`보다 구체적이므로 우선됩니다. `/8`은 앞 8비트만 고정하고 `/16`은 앞 16비트를 고정하기 때문입니다. 중간 상태를 쓰면 `dst∈10.0.0.0/8=yes`, `dst∈10.1.0.0/16=yes`, 비교값 `8 vs 16`, 승자 `/16`입니다. 따라서 선택된 `/16`의 next hop으로 전달합니다.

이 결론을 “모든 라우팅 프로토콜에서 metric보다 항상 먼저 적용되는 완전한 route-selection 순서”라고 확대하면 안 됩니다. RFC 4632 §5.1은 forwarding을 longest-match basis로 설명하지만, protocol RIB가 어떤 후보를 FIB에 설치할지, administrative distance와 정책을 어떻게 적용할지는 구현·프로토콜별 영역입니다. 같은 `/16` 후보 두 개라면 prefix 길이만으로 승자를 정하지 못하고 실제 metric·정책·next-hop 상태를 봅니다. `/16`이 철회되면 같은 목적지는 `/8`으로 내려갈 수 있어 장애 범위가 넓어집니다. 진단에서는 destination, mask, RIB/FIB, selected next hop을 함께 기록해야 합니다. 예를 들어 FIB에 `/16`이 설치되어도 next hop이 unresolved이면 실제 forwarding 결과는 장비의 unresolved 처리와 대체 경로 정책에 영향을 받을 수 있습니다. 그러므로 “수학적으로 /16이 더 구체적이다”와 “현재 패킷이 그 인터페이스로 나갔다”는 관측을 구분하고, counters나 packet capture로 마지막 단계를 확인합니다.

## 득점 포인트

- 두 경로가 모두 목적지에 일치하는지 먼저 확인하고 prefix length 8과 16을 비교합니다.
- longest-prefix forwarding 모델과 protocol RIB/정책 선택을 구분합니다.
- `/16` 철회 뒤 `/8`으로 내려가는 상태 변화를 설명합니다.

## 감점 포인트

- 더 넓은 `/8`이 먼저 선택된다고 답합니다.
- metric과 administrative policy의 모든 순서가 RFC 4632에 고정됐다고 단정합니다.
- route table에서 실제 mask와 설치 상태를 확인하지 않습니다.

## 더 파고들 거리

- `/16` 철회 전후의 next hop과 장애 범위를 비교해 보세요.
- 같은 `/16` 후보가 둘이면 prefix 비교 뒤 어떤 RIB 정보로 승자를 판정할까요?
