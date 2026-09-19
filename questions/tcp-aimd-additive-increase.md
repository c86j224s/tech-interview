---
id: tcp-aimd-additive-increase
title: 손실 없이 TCP congestion avoidance가 계속될 때 cwnd를 선형으로 키우는 이유는 무엇인가요?
difficulty: 하
category: 네트워크
tags:
  - TCP
  - AIMD
  - congestion avoidance
  - cwnd
related:
  - bandwidth-delay-product-window
---
# 손실 없이 TCP congestion avoidance가 계속될 때 cwnd를 선형으로 키우는 이유는 무엇인가요?

## 구두 답변

congestion avoidance의 선형 증가는 경로 용량에 접근할 때 매번 큰 burst를 만들지 않으면서 남은 여유를 계속 탐색하기 위한 선택입니다. RFC 5681은 cwnd > ssthresh인 구간에서 새 데이터 ACK를 누적해 대략 한 RTT마다 full-sized segment 하나, 즉 1 SMSS만큼 cwnd를 늘리도록 합니다. SMSS=1이면 cwnd=10에서 한 RTT 동안 10개의 새 바이트가 확인된 뒤 약 11이 되고, 다음 RTT에는 약 12가 됩니다. 각 ACK에 SMSS*SMSS/cwnd를 더하는 근사식을 쓰면 cwnd=10일 때 ACK마다 0.1을 누적하여 열 개의 확인 후 1이 증가합니다. 정수 byte 구현에서는 작은 결과가 0으로 잘리지 않도록 최소 1바이트 반영이나 별도 누적기를 사용해야 합니다. delayed ACK가 있더라도 ACK마다 무조건 SMSS를 더하면 창이 과도하게 커질 수 있어, 확인된 N 바이트와 RTT당 상한을 함께 적용합니다. 이 방식이 AIMD의 A(additive) 부분이고, 손실이 관찰되면 ssthresh를 낮추고 cwnd를 줄이는 M(multiplicative) 반응이 뒤따릅니다. 예를 들어 cwnd=20 SMSS에서 손실 없이 세 RTT가 지나면 21, 22, 23 근처로 올라가지만, 세 duplicate ACK의 loss signal이 오면 같은 증가를 계속하지 않고 fast recovery로 전환합니다. rwnd가 12 SMSS라면 cwnd가 23이어도 실제 outstanding 상한은 min(cwnd,rwnd)=12이므로 cwnd trace와 throughput을 동일시하면 안 됩니다. 또한 CUBIC 같은 다른 혼잡 알고리즘은 이 Reno 계열 선형식을 그대로 사용하지 않을 수 있습니다. 검증에서는 ACK 간격, bytes acknowledged, fractional accumulator, cwnd, ssthresh를 시간축에 기록하고, ACK 묶음·pacing·재정렬을 별도 시나리오로 비교해야 선형 증가의 의도와 구현 결과를 구분할 수 있습니다.

## 득점 포인트

- cwnd=10에서 RTT당 약 1 SMSS가 되는 상태를 계산한 점
- fractional SMSS*SMSS/cwnd와 delayed ACK의 관계를 설명한 점
- additive 증가와 loss 시 multiplicative 감소, rwnd 상한을 분리한 점

## 감점 포인트

- 모든 TCP 알고리즘의 보편 공식으로 단정한 점
- ACK마다 SMSS를 더해 delayed ACK 효과를 무시한 점

## 더 파고들 거리

- 정수 rounding으로 증가가 0이 되는 큰 cwnd 구현을 검토해 보세요
- Reno 계열과 CUBIC의 cwnd trace를 같은 축에 비교해 보세요
