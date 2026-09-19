---
id: network-ethernet-switch-vlan
title: Ethernet 스위칭의 MAC 학습과 VLAN 경계
topic: 네트워크
summary: >-
  스위치가 출발지 MAC을 학습하고 목적지 MAC을 전달·플러딩하는 과정과 VLAN이 브로드캐스트 도메인 및 태그 경계를 나누는 방식을
  설명합니다.
questionIds: []
prerequisites:
  - computer-science-foundations
related:
  - wire-format
  - computer-science-foundations
reviewedAt: '2026-09-19'
---
# Ethernet 스위칭의 MAC 학습과 VLAN 경계

Ethernet 스위칭의 핵심은 목적지 MAC을 보고 즉시 포트를 고르는 단순한 규칙이 아니라, 수신 포트와 VLAN 문맥에서 출발지 위치를 관찰하고 그 결과를 forwarding database(FDB)에 반영한 뒤 목적지 전달 범위를 계산하는 순서입니다. 이 순서를 분리해야 unknown-unicast flooding, MAC 이동, VLAN 오구성을 같은 증상으로 뭉뚱그리지 않을 수 있습니다. IEEE 802.1Q-2022 카탈로그는 MAC/VLAN 브리지의 동작·관리·프로토콜·알고리즘을 표준 범위로 제시하지만, 장비별 aging 시간이나 access/trunk/native 기본값까지 공개하는 본문은 아닙니다. 따라서 이 글은 표준 범위와 일반적인 장비 모델을 나누어 설명합니다.

## 프레임과 브리지 문맥

프레임에는 출발지 MAC과 목적지 MAC이 있습니다. 스위치는 프레임이 들어온 물리 포트뿐 아니라 해당 포트에서 해석된 VLAN 문맥을 함께 사용합니다. 같은 문자열 MAC이라도 VLAN 10의 FDB 항목과 VLAN 20의 항목은 별개의 전달 상태일 수 있습니다. 출발지 MAC 학습은 단말이 영구적으로 그 포트에 있다는 선언이 아니라, “이 VLAN 문맥의 이 포트에서 이 출발지를 보았다”는 최신 관측입니다.

목적지 조회는 출발지 학습과 별개입니다. 현재 VLAN에서 목적지에 유효한 포트가 있으면 일반적인 브리지 모델은 그 포트로만 전달합니다. 항목이 없거나 목적지가 브로드캐스트이면 같은 VLAN의 다른 전달 포트로 flooding합니다. 이때 모든 물리 포트가 아니라 VLAN 허용, 포트 상태, 분리 정책을 통과한 범위가 대상입니다. 멀티캐스트 최적화, hairpin 허용, 보안 필터 같은 세부 동작은 장비 설정에 달려 있습니다.

## 출발지 학습과 목적지 조회

```diagram
{"title":"출발지 학습과 전달 결정","caption":"FDB 관찰과 목적지 조회를 순서대로 분리한 일반 브리지 모델입니다.","rows":[[{"id":"in","label":"수신 프레임","detail":["src=A, dst=B","포트 1 · VLAN 10"]}],[{"id":"learn","label":"FDB 학습","detail":["A → 포트 1","VLAN 문맥 포함"]}],[{"id":"lookup","label":"목적지 조회","detail":["B 유효 항목 확인","없으면 unknown"]}],[{"id":"out","label":"전달 범위","detail":["known은 단일 포트","unknown·broadcast는 VLAN"]}]],"edges":[{"from":"in","to":"learn","label":"관찰"},{"from":"learn","to":"lookup","label":"학습 뒤 조회"},{"from":"lookup","to":"out","label":"전달 결정"}]}
```

설명용 상태를 적으면 포트 1에서 `A→B`가 들어온 순간 `FDB[VLAN10][A]=1`, `B=unknown`입니다. 스위치는 VLAN 10에서 허용된 포트 2와 포트 3으로 복제할 수 있습니다. 포트 3의 B가 `B→A`를 보내면 `FDB[VLAN10][B]=3`이 되고, 다음 `A→B`는 포트 3만 대상으로 바뀝니다. 이는 설명용 상태 전이이며 특정 스위치에서 실제 실행한 결과가 아닙니다.

## FDB 수명과 이동

FDB는 정적 주소록이 아닙니다. 일정 시간 출발지 관측이 없으면 aging으로 동적 항목이 삭제될 수 있고, 이후 첫 프레임은 다시 unknown-unicast flooding을 만들 수 있습니다. 정확한 타이머는 장비·소프트웨어·설정마다 다르므로 표준 일반론으로 고정하지 않습니다. 운영 시에는 MAC, VLAN, 포트, 마지막 학습 시각, 정적 고정 여부를 함께 읽어야 합니다.

단말을 포트 1에서 포트 3으로 옮기면 새 포트의 프레임을 본 뒤 `A: 1 → 3`으로 한 번 바뀌고 안정되는 패턴이 가능합니다. 이중 연결이나 브리지 루프라면 같은 MAC이 포트 1과 3에서 반복적으로 관찰되어 FDB가 흔들리고, 중복 프레임이나 broadcast 증가가 동반될 수 있습니다. 가상 스위치, 무선 브리지, NIC teaming처럼 정상적으로 여러 경로가 보이는 구성도 있으므로 flap 한 줄만으로 루프를 확정하면 안 됩니다.

## MAC 이동과 루프 진단

진단 순서는 변화 시각, VLAN별 포트, 두 링크의 상태, 물리·가상 토폴로지, STP 또는 루프 방지 상태, broadcast·unknown-unicast 카운터의 시간선을 맞추는 방식이 안전합니다. `09:00:00 포트 1`, `09:00:01 포트 3`, `09:00:02 포트 1`처럼 짧은 양방향 반복이면 단일 이동보다 반복 경로의 설명력이 큽니다. 반면 기존 링크가 내려간 뒤 새 포트에서 안정되면 이동 가설이 강해집니다.

캡처 위치도 중요합니다. access 구간에서 본 무태그 프레임과 trunk 구간에서 본 태그 프레임은 같은 내부 VLAN을 다른 와이어 표현으로 보여 줄 수 있습니다. 관리 인터페이스의 FDB 포트와 미러링 캡처의 ingress 포트가 다르면 가상화 계층 또는 미러 위치를 먼저 확인합니다. 원인 확정 전 포트를 차단하면 증거와 서비스 모두 잃을 수 있으므로, 영향 범위와 복구 방법을 기록하고 격리합니다.

## VLAN 포트 역할

VLAN은 하나의 물리 스위치 안에서도 브리지 전달과 broadcast flooding의 논리적 범위를 나누는 문맥입니다. 벤더 장비에서 흔히 access라고 부르는 포트는 한 VLAN에 귀속되어 무태그 호스트 프레임을 그 VLAN으로 해석하는 모델입니다. trunk라고 부르는 링크는 여러 VLAN을 운반하면서 VLAN 식별 정보를 태그로 표현하는 모델입니다. 이 용어와 기본 동작은 장비 설정 인터페이스의 관행이며, IEEE 카탈로그 페이지 자체가 모든 vendor default를 정의한다고 읽어서는 안 됩니다.

실제 확인 항목은 허용 VLAN 목록, 무태그 ingress의 귀속 VLAN, 송신 때 태그를 제거하는 VLAN, 태그가 예상과 다를 때의 폐기 정책입니다. 양 끝의 설정이 맞지 않으면 프레임 유실뿐 아니라 무태그 프레임의 오귀속도 생길 수 있습니다. 태그가 보였다는 사실은 프레임의 무결성 단서일 뿐, ACL이나 L3 인가를 대체하지 않습니다.

## VLAN과 IP 서브넷

호스트가 `192.0.2.0/24`에 있다고 판단하면 같은 링크의 주소를 직접 찾기 위해 ARP broadcast를 낼 수 있습니다. A가 VLAN 10, B가 VLAN 20에만 있고 두 호스트 모두 이 대역을 설정했다면 A의 ARP는 VLAN 10에서만 flooding되고 VLAN 20의 B에는 도달하지 않습니다. IP prefix의 숫자와 L2 broadcast domain이 일치한다는 보장은 없기 때문에 이는 주소 설계 오구성입니다.

일반적인 설계는 VLAN과 IP subnet의 경계를 정렬하고, 서로 다른 VLAN 사이에는 SVI나 라우터를 두어 L3 정책을 적용하는 방식입니다. proxy ARP나 특수 브리지 구성은 예외적으로 관찰 결과를 바꿀 수 있으므로 실제 host prefix, VLAN membership, SVI, proxy ARP, ACL을 함께 확인합니다. trunk 허용 목록을 넓히는 것만으로 잘못된 on-link 판단이 해결되지는 않습니다.

## 비용과 검증

known-unicast는 한 포트로만 전달되어 링크와 수신 CPU 낭비를 줄입니다. FDB가 비어 있거나 aging된 직후의 flooding은 동일 VLAN의 여러 포트에 추가 처리 비용을 만듭니다. VLAN을 세분화하면 broadcast 범위는 작아지지만 VLAN 간 통신에 L3 장비와 정책이 필요합니다. 허용 VLAN을 넓히면 연결은 쉬워져도 격리 경계가 약해집니다.

격리된 테스트에서 빈 FDB로 `A→B`, B의 응답, 두 번째 `A→B`를 캡처하고 flooding에서 단일 포트 전달로 바뀌는지 확인합니다. 이어 aging 뒤 첫 프레임의 범위를 측정하되 실제 타이머를 장비에서 읽습니다. VLAN 10·20에서 ARP를 각각 발생시키고 trunk 캡처의 태그, 반대편 허용 목록, SVI 경로를 나란히 기록합니다. 이 글에서 실행한 것은 다음 상태를 검산한 설명용 추적이지 실제 스위치 실행이 아닙니다.

## 참고자료와 확인 범위

- IEEE 802.1Q-2022 카탈로그: [https://standards.ieee.org/ieee/802.1Q/10323/](https://standards.ieee.org/ieee/802.1Q/10323/). MAC/VLAN 브리지 범위와 표준 판본을 확인했습니다. 카탈로그만으로 FDB 알고리즘, aging 수치, native VLAN 기본값은 확인하지 않았습니다.
- FDB 학습·aging·access/trunk/native 동작은 일반적인 브리지 및 vendor port-mode 모델로 설명했으며, 장비 독립적인 normative default로 쓰지 않았습니다.
- 모든 포트와 VLAN 전이는 설명용 계산입니다. 실제 현장 판단은 FDB 출력, 설정, trunk 캡처와 STP 상태를 함께 확인해야 합니다.
