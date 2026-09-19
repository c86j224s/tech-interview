---
id: tcp-sack-multiple-loss-recovery
title: 한 window에서 segment 101과 105가 사라지고 102~104·106이 도착했습니다. SACK이 없을 때와 무엇이 달라지나요?
difficulty: 중하
category: 네트워크
tags:
  - TCP
  - SACK
  - multiple loss
  - recovery
related:
  - tcp-flow-vs-congestion-control
---
# 한 window에서 segment 101과 105가 사라지고 102~104·106이 도착했습니다. SACK이 없을 때와 무엇이 달라지나요?

## 구두 답변

아래 100–106 숫자는 계산을 단순화한 1바이트 데이터 구간의 시작 sequence 번호입니다. 실제 SACK은 임의의 segment 일련번호가 아니라 바이트 sequence 범위를 보고하며, 일반 MSS 크기의 segment에서는 그 바이트 경계를 사용해야 합니다.

이 상태에서 SACK의 차이는 gap의 위치를 관찰한 정보를 sender에게 추가한다는 데 있습니다. 100~106을 보냈고 101과 105가 손실되었다면 receiver는 100까지 연속으로 받아 cumulative ACK=101을 보냅니다. 102, 103, 104가 도착하면 [102,105), 106이 도착하면 [106,107)을 보고할 수 있습니다. sender의 scoreboard는 101과 105를 아직 확인되지 않은 gap 후보로 남기고, 이미 receiver가 보고한 102~104와 106은 같은 내용을 무조건 재전송하지 않도록 표시합니다. 오른쪽 끝을 배타적으로 읽으므로 [102,105)에는 102·103·104만 들어갑니다. SACK이 없다면 반복 ACK=101만으로는 102~106이 실제로 도착했는지, 단지 재정렬되어 아직 오는 중인지 알 수 없습니다. sender는 세 duplicate ACK를 보고 101을 fast retransmit할 수 있지만, 105까지 잃었다는 사실과 중간 데이터의 수신 여부를 충분히 구분하기 어렵습니다. 그 결과 이미 도착한 segment를 재전송하거나 두 번째 손실을 timeout까지 기다릴 가능성이 커집니다. SACK이 있어도 손실이 확정됐다는 의미는 아닙니다. RFC 2018은 SACK을 advisory로 규정하여 receiver가 나중에 보고한 데이터를 버릴 수 있게 하므로, cumulative ACK가 window edge를 넘기기 전 sender buffer를 즉시 free하면 안 됩니다. option 공간이 부족하면 모든 block이 한 ACK에 들어가지 않고, ACK 손실로 과거 보고가 사라질 수도 있습니다. 또한 SACK option 자체가 현대적인 congestion-control을 정의하지 않으므로 sender는 duplicate ACK 임계값, cwnd 감소, 재정렬 정책을 별도 적용합니다. 검증은 ACK=101, SACK=[102,105),[106,107) 뒤 101 재전송, 105 재전송, cumulative ACK 진행 순서를 scoreboard와 함께 기록하고, SACK이 없는 동일 trace에서 재전송 후보가 넓어지는지 비교하면 됩니다.

## 득점 포인트

- ACK=101, [102,105), [106,107) trace에서 gap 101·105와 수신 범위를 구분한 점
- SACK 부재 시 여러 손실 위치를 추정해야 한다는 차이를 설명한 점
- advisory 정보이므로 receiver discard와 option 공간을 고려한 점

## 감점 포인트

- SACK을 손실 확정 또는 영구 저장 보장으로 표현한 점
- 이미 도착한 범위를 cumulative ACK가 확인했다고 말한 점

## 더 파고들 거리

- scoreboard가 두 gap을 재전송하는 순서를 실제 이벤트로 추적해 보세요
- 여러 손실과 재정렬을 duplicate ACK만으로 구별하기 어려운 이유를 비교해 보세요
