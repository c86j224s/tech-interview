---
id: dhcp-t1-t2-renew-rebind
title: DHCP 임대가 T1을 지나고 T2에 도달하면 REQUEST의 대상과 전송 방식은 어떻게 달라지나요?
difficulty: 하
category: 네트워크
tags:
  - DHCP
  - T1
  - T2
  - renewal
  - rebinding
related: []
---
# DHCP 임대가 T1을 지나고 T2에 도달하면 REQUEST의 대상과 전송 방식은 어떻게 달라지나요?

## 구두 답변

T1에서는 client가 원래 lease를 발급한 server에 unicast DHCPREQUEST를 보내는 RENEWING 단계입니다. T1부터 T2까지 그 server가 응답하지 않으면, T2에서 REBINDING으로 넘어가 특정 server를 지정하지 않은 broadcast DHCPREQUEST를 보내 다른 DHCP server의 ACK를 받을 수 있게 합니다. lease expiry 전까지 ACK가 오지 않으면 client는 이전 주소 사용을 멈추고 INIT으로 돌아가 새 초기화를 시작해야 합니다.

RFC 2131의 기본 계산을 lease 3600초에 적용하면 T1은 1800초, T2는 3150초지만 server option으로 바뀔 수 있습니다. T1 요청은 현재 주소를 `ciaddr`에 넣고 server identifier를 넣지 않습니다. T2의 broadcast 요청도 현재 주소를 `ciaddr`에 넣고 server identifier를 넣지 않아 특정 원래 server에 묶이지 않습니다. T2 이후에도 ACK가 없는데 기존 주소를 계속 쓰는 것은 lease 계약 위반입니다.

진단에서는 단순히 “REQUEST가 나갔다”가 아니라 destination mode, server identifier 유무, `ciaddr`, T1/T2 option, expiry와 ACK transaction ID를 함께 봅니다. T1 unicast 실패가 곧 즉시 주소 폐기를 뜻하지는 않지만, expiry는 명확한 사용 중지 경계입니다.

3600초 trace의 1800초와 3150초는 이해를 위한 계산이며, 실제 packet은 재전송과 scheduler 지연으로 경계 주변에 나타날 수 있습니다. 중요한 관찰은 T1 요청의 destination이 원래 server이고 T2 요청의 broadcast bit와 server identifier 부재가 any-server 처리 조건을 만든다는 점입니다. expiry 이후 늦게 도착한 ACK도 현재 lease 세대와 transaction ID가 맞는지 확인해야 합니다.

## 득점 포인트

- T1 unicast와 T2 broadcast, expiry를 field로 비교합니다.
- 메커니즘의 중간 상태와 실패 경계를 실제 패킷 또는 상태 값으로 설명합니다.

## 감점 포인트

- T2를 즉시 만료로 설명하지 않습니다.
- 표준이 정하지 않은 구현 정책을 모든 운영체제의 고정 규칙으로 일반화하지 않습니다.

## 더 파고들 거리

- 늦은 ACK를 transaction ID로 거르는 이유를 말해 보세요.
- 정상 관찰과 오류 부재를 구분하는 추가 로그나 캡처 항목을 제시해 보세요.
