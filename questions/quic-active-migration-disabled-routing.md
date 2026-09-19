---
id: quic-active-migration-disabled-routing
title: 주소 기반 load balancer 뒤에서 QUIC migration을 허용하면 어떤 연결 라우팅 문제가 생길 수 있나요?
difficulty: 중하
category: 네트워크
tags:
  - QUIC
  - load balancer
  - migration
  - Connection ID
related:
  - http3-quic-streams
---
# 주소 기반 load balancer 뒤에서 QUIC migration을 허용하면 어떤 연결 라우팅 문제가 생길 수 있나요?

## 구두 답변

초기 client 주소에 대한 hash만 사용하는 load balancer는 client가 이동해 tuple이 바뀐 뒤 같은 QUIC connection을 다른 backend로 보낼 수 있습니다. backend B가 backend A의 packet protection key, stream 상태, flow-control 상태를 갖고 있지 않으면 B는 정상 packet을 복호화하지 못하거나 연결을 닫습니다. 그래서 migration을 지원하려면 CID 기반 routing이나 connection state 공유가 필요하고, 지원하지 않는 배포는 active migration을 허용하지 않는 계약을 명시해야 합니다.

초기 경로에서 A로 연결된 client가 cellular로 이동해 새 IP를 사용한다고 하겠습니다. 주소 hash가 B를 선택하면, packet 안의 CID가 원래 connection을 나타내도 B가 그 CID를 A의 context로 해석할 수 없으면 의미가 없습니다. CID-aware load balancer가 안정적인 route hint를 보고 A 또는 A와 상태를 공유하는 backend로 보내야 합니다.

선택 기준은 단순히 “CID를 쓰자”가 아닙니다. CID encoding과 수명, unknown CID 처리, backend 장애 시 state 복구, 개인정보 추적 가능성을 함께 검토합니다. migration을 끄면 이동성은 잃지만 잘못된 backend 전달과 상태 복제 비용을 줄일 수 있습니다.


예를 들어 A에 connection key와 stream offset이 있고 B에는 같은 CID 문자열만 등록되어 있다고 해도, B가 packet protection key를 갖지 않으면 복호화부터 실패합니다. 반대로 state replication이 있다면 migration은 가능하지만 복제 지연 중 packet number·flow-control 값이 어긋날 수 있습니다. 따라서 라우팅 성공 여부와 backend 상태 일관성을 별도의 테스트 축으로 둡니다.
## 득점 포인트

- 주소 hash 변경이 backend state ownership을 바꾸는 과정을 설명합니다.
- CID routing, state replication, migration 비활성화를 서로 다른 선택으로 비교합니다.
- QUIC 일반 규칙과 구체적인 load balancer 배포 설계를 구분합니다.

## 감점 포인트

- load balancer가 UDP를 전달하므로 backend 변경도 자동 처리된다고 합니다.
- CID만 확인하면 암호화 key와 stream state가 자동 공유된다고 말합니다.
- migration을 항상 켜는 것이 상위 설계라고 단정합니다.

## 더 파고들 거리

- CID 기반 라우팅 정보를 외부 관찰자에게 노출하지 않으려면 어떤 형식을 선택하나요?
- backend 장애로 connection state를 잃었을 때 client가 재개할 경계를 어떻게 정하나요?
