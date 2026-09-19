---
id: tcp-sack-permitted-handshake
title: TCP 수신자가 SACK block을 보내려면 연결 후 어떤 협상이 먼저 필요하나요?
difficulty: 하
category: 네트워크
tags:
  - TCP
  - SACK
  - SYN
  - 옵션
related: []
---
# TCP 수신자가 SACK block을 보내려면 연결 후 어떤 협상이 먼저 필요하나요?

## 구두 답변

먼저 SYN 교환에서 SACK-Permitted option을 광고해야 합니다. RFC 2018은 이 option을 kind 4, length 2로 정의하며 SYN segment에서만 보낼 수 있고, established connection의 ACK에 넣는 실제 SACK block(kind 5)과 분리합니다. 예를 들어 client SYN에 SACK-Permitted가 있고 server SYN/ACK에도 같은 capability가 있으면 연결이 성립한 뒤 server가 data receiver일 때 ACK에 [left,right) block을 포함할 수 있습니다. 반대로 server가 capability를 광고하지 않았다면 client가 out-of-order data를 보았더라도 그 연결에 SACK option을 보내서는 안 됩니다. 양쪽 중 한 곳의 로컬 구현이 kind 5를 만들 수 있다는 사실보다, 이번 연결에서 SYN으로 허용이 확인되었는지가 우선입니다. 협상은 사용 가능을 여는 단계일 뿐, 모든 ACK가 반드시 SACK을 포함한다는 뜻은 아닙니다. RFC는 수신 queue에 gap이 있고 SACK을 선택했다면 해당 조건의 ACK에 block을 싣도록 설명하지만, option 공간과 ACK 진행에 따라 실제 보고 범위는 달라집니다. timestamp option을 함께 쓰면 40바이트 TCP option 공간에서 SACK block 수가 줄어드는 것도 고려해야 합니다. 송신자는 이 정보를 cumulative ACK의 대체값으로 읽지 않고, 누적 ACK가 확인한 prefix와 비연속 block을 함께 scoreboard에 반영합니다. 검증은 SYN/SYN-ACK의 kind 4 존재, data ACK의 kind 5 존재, 상대 capability 부재 시 kind 5 미사용을 packet trace에서 각각 확인하는 방식이 좋습니다. SACK 협상만으로 Reno/CUBIC이나 현대 recovery 알고리즘까지 선택되었다고 확장하면 안 됩니다.

## 득점 포인트

- SACK-Permitted kind 4의 SYN 협상과 established kind 5 block을 분리한 점
- 상대가 capability를 광고하지 않으면 SACK block을 보내지 않는다고 한 점
- 협상과 실제 ACK별 block 생성, option 공간을 별개로 설명한 점

## 감점 포인트

- 연결 후 ACK에서 SACK-Permitted를 협상한다고 말한 점
- SACK 협상만으로 recovery algorithm까지 보장한다고 한 점

## 더 파고들 거리

- SYN/SYN-ACK와 data ACK의 option bytes를 packet trace로 대조해 보세요
- timestamp 동시 사용 때 block 수가 줄어드는 경우를 계산해 보세요
