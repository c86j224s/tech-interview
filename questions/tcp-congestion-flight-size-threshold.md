---
id: tcp-congestion-flight-size-threshold
title: TCP loss 뒤 ssthresh를 cwnd가 아니라 FlightSize 기준으로 줄이는 이유는 무엇인가요?
difficulty: 중하
category: 네트워크
tags:
  - TCP
  - ssthresh
  - FlightSize
  - AIMD
related:
  - tcp-flow-vs-congestion-control
---
# TCP loss 뒤 ssthresh를 cwnd가 아니라 FlightSize 기준으로 줄이는 이유는 무엇인가요?

## 구두 답변

FlightSize는 손실 순간까지 보냈지만 아직 cumulative ACK를 받지 못한 실제 outstanding 데이터이고, cwnd는 sender가 허용한 최대량입니다. 둘이 다를 수 있으므로 RFC 5681은 처음 retransmission-timer loss를 감지할 때 ssthresh=max(FlightSize/2,2*SMSS)를 사용하며, 단순히 cwnd/2를 쓰지 않습니다. 예를 들어 cwnd=100 SMSS지만 애플리케이션이 20 SMSS만 공급해 모두 outstanding이라면 FlightSize=20입니다. 이때 threshold는 max(10,2)=10 SMSS이고, cwnd/2=50을 쓰면 실제 경로에 있던 양보다 훨씬 큰 새 탐색 한도를 남깁니다. 반대로 cwnd=10, FlightSize=2라면 절반은 1이지만 최소값 때문에 ssthresh는 2 SMSS가 됩니다. 이 규칙은 sender의 예약 용량과 실제 네트워크에 주입된 부하를 구분해, idle 또는 application-limited 연결에서 혼잡 반응을 과도하게 약화하지 않으려는 것입니다. 단, timer loss 예외도 중요합니다. 해당 segment가 timer로 아직 한 번도 재전송되지 않은 첫 timer loss라면 위 식의 상한을 적용하지만, 이미 timer retransmission을 겪은 segment에서 다시 timer loss를 감지하면 RFC 5681은 ssthresh를 유지합니다. timeout 자체가 발생하면 cwnd는 LW=1*SMSS 이하로 낮추고 slow start로 재개하며, 이는 유휴 연결을 재개할 때의 restart window와 다른 상태입니다. fast retransmit의 세 duplicate ACK 경로에서도 FlightSize 기반 threshold를 사용하지만 cwnd는 fast recovery 규칙으로 별도 조정됩니다. 구현 검증에서는 cwnd, rwnd, FlightSize, SND.UNA/NXT, timer retransmitted flag를 같은 이벤트 시점에 기록해야 하며, packet capture의 한 순간 패킷 수를 FlightSize로 대체하면 안 됩니다.

## 득점 포인트

- cwnd=100, FlightSize=20에서 ssthresh=10과 cwnd/2=50의 차이를 계산한 점
- FlightSize가 실제 outstanding data이고 cwnd가 허용 한도라는 의미를 구분한 점
- 첫 timer loss와 이미 timer retransmission된 segment의 ssthresh 예외를 설명한 점

## 감점 포인트

- cwnd/2를 모든 loss에 적용한 점
- timeout 뒤 cwnd를 RW로 부르거나 후속 timeout에서 ssthresh를 다시 줄인 점

## 더 파고들 거리

- application-limited sender에서 FlightSize를 sender 변수로 산출해 보세요
- duplicate ACK fast recovery와 timeout LW 전이를 같은 연결에서 비교해 보세요
