---
id: arp-duplicate-address-conflict
title: 두 장비가 같은 IPv4 주소를 사용하면 ARP 관찰만으로 무엇을 확인할 수 있나요?
difficulty: 중하
category: 네트워크
tags:
  - ARP
  - duplicate address
  - 충돌
  - 진단
related: []
---
# 두 장비가 같은 IPv4 주소를 사용하면 ARP 관찰만으로 무엇을 확인할 수 있나요?

## 구두 답변

같은 protocol address에 서로 다른 hardware address가 반복해서 나타난다면 duplicate address와 spoofing을 모두 후보로 둘 수 있습니다. 하지만 ARP cache가 마지막 응답에 따라 X에서 Y로 바뀌었다는 현상만으로 원인을 확정할 수는 없습니다. `10.0.0.8→MAC X`가 09:00:00, `10.0.0.8→MAC Y`가 09:00:01, 다시 X가 09:00:02에 나타났다고 하겠습니다. 이때 두 MAC이 연결된 스위치 포트의 link 상태가 동시에 up인지, DHCP 서버가 한 lease에 어떤 binding을 기록했는지, 한 장비가 이동한 시각인지, announcement가 어느 방향에서 시작됐는지를 맞춰야 합니다.

한 장비가 포트를 옮겨 이전 링크가 내려가고 새 MAC 또는 새 포트만 안정되면 정상 이동 가능성이 있습니다. 두 포트가 동시에 살아 있고 X·Y가 짧은 간격으로 반복되면 실제 중복 설정이나 spoofing의 우선순위가 올라갑니다. 가상 인터페이스나 미러링 오류도 있으므로 캡처 지점과 FDB의 ingress 포트를 대조합니다. RFC 826은 동적 association과 replacement를 설명하지만 충돌 탐지와 출처 인증을 완결하지 않습니다. RFC 5227의 ACD, DHCP snooping, ARP inspection은 별도 규약·방어이며, 조치 전에는 packet·FDB·lease를 보존하고 임의의 cache 고정으로 증상을 숨기지 않습니다. 추가로 ARP reply의 방향을 봐야 합니다. X와 Y가 모두 request에 응답한 것인지, 한쪽이 unsolicited announcement만 보낸 것인지에 따라 충돌과 위조의 증거 강도가 다릅니다. 스위치의 FDB가 같은 MAC을 실제로 어느 포트에서 학습했는지까지 맞아야 캡처 미러링 오류도 제외할 수 있습니다.

## 득점 포인트

- 동일 IP·다른 MAC을 확정 판정이 아니라 후보 신호로 해석합니다.
- DHCP lease, 스위치 포트, link event, ARP 방향을 하나의 시간선으로 대조합니다.
- RFC 826의 동적 매핑과 ACD·inspection 방어의 범위를 구분합니다.

## 감점 포인트

- cache가 바뀌면 항상 IP 충돌이라고 말합니다.
- MAC만 보고 실제 연결 포트와 동시성을 확인하지 않습니다.
- 원본 ARP가 spoofing을 방지한다고 설명합니다.

## 더 파고들 거리

- 한 MAC은 안정적이고 다른 MAC만 간헐적으로 나타날 때 어떤 packet 방향과 포트 통계를 추가할까요?
- 원인이 확인된 뒤 정상 서비스 중단을 최소화하며 어느 lease와 포트를 먼저 격리할까요?
