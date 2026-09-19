---
id: tcp-sack-range-boundaries
title: SACK block의 시작과 끝 숫자가 100과 120이면 어떤 byte 범위를 받은 것인가요?
difficulty: 하
category: 네트워크
tags:
  - TCP
  - SACK
  - sequence number
  - 범위
related: []
---
# SACK block의 시작과 끝 숫자가 100과 120이면 어떤 byte 범위를 받은 것인가요?

## 구두 답변

SACK block의 두 숫자는 [left,right) 구간입니다. 따라서 left=100, right=120이면 sequence number 100부터 119까지, 총 120−100=20바이트가 연속으로 수신되어 queue에 있다는 뜻이고 byte 120은 포함되지 않습니다. right edge가 마지막 byte가 아니라 마지막 byte 바로 다음 sequence number라는 점이 핵심입니다. 예를 들어 cumulative ACK=80인 ACK에 SACK [100,120)이 함께 있다면 수신자는 80부터 99까지의 gap을 아직 메우지 못했지만 100~119는 받아 보관하고 있다는 상태입니다. 송신자는 80~99 중 outstanding 범위와 100~119를 분리해, 뒤 block을 다시 보내지 않고 gap을 우선 후보로 삼을 수 있습니다. 다만 SACK option은 ACK 번호의 의미를 바꾸지 않습니다. RFC 2018도 ACK field는 여전히 누적된 연속 prefix를 나타낸다고 명시하므로, [100,120)을 보고 ACK=120으로 바꾸어 처리하면 안 됩니다. 구현에서는 left/right 경계가 segment 경계와 일치하지 않을 수 있습니다. 예를 들어 한 segment가 96~112이고 다음이 112~128인데 block이 [100,120)이면 완전히 포함된 segment만 SACKed로 표시하거나 부분 범위를 재패킷화 규칙에 맞춰 처리해야 합니다. option 길이도 제한되어 timestamp가 있으면 한 ACK에 실을 수 있는 block 수가 줄어듭니다. sequence number wrap-around가 가까우면 단순 정수 대소 비교도 위험하므로 TCP sequence-space 비교 함수를 사용해야 합니다. 단위 테스트는 [100,120), [100,121), 인접 [100,110)+[110,120) 병합, cumulative ACK=80을 각각 넣어 byte 수와 재전송 후보가 맞는지 확인하는 식으로 구성합니다.

## 득점 포인트

- [100,120)의 20바이트와 byte 120 미포함을 명시한 점
- cumulative ACK=80과 SACK block을 함께 해석한 점
- segment 경계·wrap-around·option 공간의 구현 경계를 언급한 점

## 감점 포인트

- right edge를 포함해 21바이트로 센 점
- SACK block을 cumulative ACK 자체로 읽은 점

## 더 파고들 거리

- 부분적으로 겹치는 segment를 scoreboard에 표시하는 규칙을 설계해 보세요
- 인접 block 병합과 sequence wrap 비교를 단위 테스트로 작성해 보세요
