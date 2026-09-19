---
id: cidr-multihoming-specificity
title: 멀티홈드 네트워크가 두 ISP에 같은 주소 블록을 광고할 때 CIDR 요약이 깨지는 이유는 무엇인가요?
difficulty: 중하
category: 네트워크
tags:
  - CIDR
  - multihoming
  - aggregation
  - BGP
related: []
---
# 멀티홈드 네트워크가 두 ISP에 같은 주소 블록을 광고할 때 CIDR 요약이 깨지는 이유는 무엇인가요?

## 구두 답변

멀티홈 조직은 두 ISP를 통해 도달 가능해야 하므로 일반적으로 어느 한 provider의 aggregate 안에만 주소를 숨기기 어렵습니다. 각 provider와 외부 라우터가 조직의 reachability를 알아야 하므로 조직 prefix가 두 provider에서 명시적으로 광고되거나, 기존 aggregate보다 긴 more-specific으로 나타날 수 있습니다. 예를 들어 고객이 ISP A와 B에 같은 `/24`를 광고해도 자동으로 링크가 절반씩 사용되는 것은 아닙니다. 두 경로의 prefix 길이가 같으면 BGP의 local preference, AS path, 필터, primary/secondary 정책과 철회 시점이 관여합니다.

provider 변경도 문제를 키웁니다. A에서 받은 주소를 renumber하지 않고 B로 옮기면 B가 more-specific을 광고해 A의 넓은 aggregate보다 longest-prefix로 우선되게 할 수 있지만, 전역 routing table과 필터 관리 비용이 증가합니다. 그렇다고 멀티홈이면 절대로 집계할 수 없는 것은 아닙니다. RFC 4632는 연속된 power-of-two 주소 블록이 상위 토폴로지 경계와 맞는 경우 일부 집계가 가능하다는 예외를 둡니다. 따라서 정확한 표현은 “일반적으로 aggregation 효율이 약화되지만, 정렬·연속성·provider topology에 따라 일부 집계가 가능하다”입니다. 검증에서는 각 provider의 prefix 길이, BGP 정책, 장애 철회 후 외부 관측 경로를 따로 기록해야 합니다. 또한 두 ISP가 같은 `/24`를 받아도 한 provider가 export filter로 그 경로를 외부에 전파하지 않을 수 있습니다. 광고 목록만 보는 것보다 서로 다른 외부 vantage point의 RIB와 AS path를 비교해야 하며, 철회 전파 지연 동안에는 의도한 primary 경로와 실제 선택 경로가 잠시 달라질 수 있습니다.

## 득점 포인트

- 멀티홈 reachability 광고와 단순 물리 링크 이중화를 구분합니다.
- aggregate·more-specific·longest-prefix와 BGP 정책을 서로 다른 선택 단계로 둡니다.
- contiguous power-of-two 블록과 상위 토폴로지에 따른 집계 예외를 포함합니다.

## 감점 포인트

- 같은 주소를 두 ISP가 광고하면 자동으로 부하가 균등 분산된다고 말합니다.
- 멀티홈이면 어떤 조건에서도 aggregate가 불가능하다고 단정합니다.
- CIDR이 장애 철회와 BGP 정책을 자동으로 해결한다고 설명합니다.

## 더 파고들 거리

- B의 more-specific 철회가 늦을 때 외부에서 관찰할 prefix와 경로 선택을 어떻게 검증할까요?
- 연속 블록의 일부 집계가 가능한 조건을 주소 정렬과 provider 경계로 설명해 보세요?
