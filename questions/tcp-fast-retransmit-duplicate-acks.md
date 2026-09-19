---
id: tcp-fast-retransmit-duplicate-acks
title: TCP가 세 개의 duplicate ACK를 받았을 때 timeout까지 기다리지 않고 재전송할 수 있는 근거는 무엇인가요?
difficulty: 중하
category: 네트워크
tags:
  - TCP
  - fast retransmit
  - duplicate ACK
  - 손실
related:
  - tcp-flow-vs-congestion-control
---
# TCP가 세 개의 duplicate ACK를 받았을 때 timeout까지 기다리지 않고 재전송할 수 있는 근거는 무엇인가요?

## 구두 답변

세 duplicate ACK는 timeout을 기다리지 않고 앞의 segment에 gap이 있지만 그 뒤 데이터는 receiver까지 도착했다는 강한 정황을 제공하기 때문에 fast retransmit의 근거가 됩니다. 예를 들어 segment 10이 손실되고 11, 12, 13이 순서 밖으로 도착하면 receiver는 다음 기대값을 나타내는 cumulative ACK=10을 반복할 수 있습니다. 세 번째 duplicate ACK가 sender에 도착하면 RFC 5681의 fast retransmit은 timer 만료 전 segment 10을 재전송합니다. 이 방식은 RTO가 1초 이상인 상황에서도 여러 뒤 segment가 이미 도착했다는 ACK clock을 이용해 복구 지연을 줄입니다. 하지만 duplicate ACK는 손실의 증명이 아닙니다. 네트워크 재정렬이나 ACK/data 복제도 같은 ACK를 만들 수 있으므로 세 개라는 임계값은 손실로 취급하기 위한 보수적 휴리스틱입니다. 기본 fast recovery에서 세 번째 duplicate ACK를 받으면 ssthresh를 max(FlightSize/2,2*SMSS) 상한으로 조정하고, 잃어버린 segment를 재전송한 뒤 cwnd를 ssthresh+3*SMSS로 설정합니다. 이후 추가 duplicate ACK마다 cwnd를 SMSS만큼 일시적으로 inflate하고, 새 데이터를 보낼 수 있으면 제한적으로 보냅니다. 재전송으로 유발된 새 cumulative ACK가 오면 cwnd를 ssthresh로 deflate합니다. SACK을 쓰는 sender는 새로운 SACK 정보가 없는 duplicate ACK만으로 새 데이터를 늘리지 않으며, 여러 손실에서는 SACK scoreboard가 어느 범위를 이미 받았는지 보완합니다. 반대로 ACK가 세 개에 도달하지 않고 timer가 만료되면 congestion response는 loss window 1 SMSS와 slow start 재개로 더 강하게 내려갑니다. 검증은 재정렬만 있는 trace와 실제 10 손실 trace를 분리해 duplicate ACK 수, SACK 정보, retransmission 시각, cwnd/ssthresh 전이를 함께 기록해야 합니다.

## 득점 포인트

- segment 10 손실과 ACK=10 반복에서 세 번째 duplicate ACK를 연결한 점
- 재정렬·복제도 duplicate ACK를 만들 수 있다는 한계를 든 점
- fast recovery와 timeout의 cwnd/LW 반응을 구분한 점

## 감점 포인트

- 세 duplicate ACK를 물리적 손실의 확정 증명으로 말한 점
- fast retransmit을 timeout 뒤 slow start와 같은 전이로 설명한 점

## 더 파고들 거리

- SACK 정보가 없는 duplicate ACK와 새 SACK 정보가 있는 ACK를 비교해 보세요
- 세 번째 ACK 이후 cwnd inflation과 deflation 시점을 trace로 그려 보세요
