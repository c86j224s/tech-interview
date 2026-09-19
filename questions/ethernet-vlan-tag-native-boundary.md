---
id: ethernet-vlan-tag-native-boundary
title: 두 스위치 사이 trunk 링크에서 VLAN 태그가 붙은 프레임과 붙지 않은 프레임은 어떻게 해석되나요?
difficulty: 하
category: 네트워크
tags:
  - VLAN
  - 802.1Q
  - trunk
  - access
related: []
---
# 두 스위치 사이 trunk 링크에서 VLAN 태그가 붙은 프레임과 붙지 않은 프레임은 어떻게 해석되나요?

## 구두 답변

태그의 의미는 프레임 한 장만 보고 결정되지 않고, 양 끝 포트의 VLAN 처리 계약과 캡처 위치로 결정됩니다. 벤더 장비에서 흔히 access라고 부르는 포트는 보통 하나의 VLAN에 무태그 ingress를 귀속시키고, trunk라고 부르는 링크는 여러 VLAN을 운반하기 위해 VLAN 식별 정보를 태그로 표현합니다. 다만 IEEE 802.1Q 카탈로그만으로 모든 장비의 access/trunk 명칭, native VLAN 기본값, 태그 삽입·제거 시점을 확정할 수는 없습니다. 그러므로 “trunk의 모든 프레임은 언제나 태그된다”는 식의 보편 명제는 피해야 합니다.

예를 들어 스위치 A 내부에서 VLAN 20으로 분류된 프레임이 trunk 구간에서 VLAN 20 태그로 나가고, B의 trunk가 VLAN 20을 허용하면 B는 이를 VLAN 20의 브리지 문맥으로 이어 줄 수 있습니다. 허용 목록에서 20이 빠지면 링크가 살아 있어도 폐기됩니다. 반대로 한쪽 설정은 무태그 프레임을 VLAN 10 native로 해석하고 다른 쪽은 VLAN 20으로 귀속하면 유실이 아니라 잘못된 broadcast domain으로 들어갈 수 있습니다. 진단 순서는 호스트 ingress의 무태그 여부, 스위치에서 분류된 VLAN, trunk 와이어의 실제 태그, 반대편 허용 목록과 native mapping을 각각 확인하는 것입니다. 태그는 식별 정보이지 ACL이나 L3 인가를 대신하는 보안 경계가 아닙니다. 따라서 태그 불일치를 찾을 때는 한 프레임의 ingress와 egress를 함께 잡아야 합니다. A에서 VLAN 20으로 분류된 프레임이 trunk에 나갈 때 태그가 생겼다가 B ingress에서 native 규칙으로 제거될 수 있기 때문입니다. 같은 프레임의 MAC과 VLAN을 구간별로 표로 만들면 태그가 없다는 사실과 VLAN 경계가 없다는 결론을 혼동하지 않게 됩니다.

## 득점 포인트

- access/trunk를 케이블 종류가 아니라 포트의 VLAN 처리 모델로 설명합니다.
- 표준이 다루는 VLAN 식별 범위와 vendor-specific native/default 동작을 명시적으로 구분합니다.
- VLAN 20 허용 여부와 무태그 오귀속을 실제 캡처·설정 상태로 연결합니다.

## 감점 포인트

- trunk에서는 모든 프레임이 반드시 태그된다고 단정합니다.
- IEEE 카탈로그만으로 특정 장비의 native VLAN 기본값을 확정합니다.
- 태그가 일치하면 ACL과 다른 VLAN 간 L3 정책도 자동으로 해결된다고 말합니다.

## 더 파고들 거리

- 양쪽 native VLAN이 다를 때 무태그 프레임의 오귀속을 어느 두 캡처로 증명할 수 있을까요?
- VLAN 20이 trunk를 통과했지만 SVI ACL에서 차단되는 경우 L2와 L3 증상을 나눠 보세요.
