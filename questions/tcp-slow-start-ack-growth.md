---
id: tcp-slow-start-ack-growth
title: TCP 연결의 cwnd가 작을 때 ACK마다 1 MSS씩 늘리는 동작을 slow start라고 부르는 이유는 무엇인가요?
difficulty: 하
category: 네트워크
tags:
  - TCP
  - slow start
  - cwnd
  - ACK
related:
  - tcp-flow-vs-congestion-control
---
# TCP 연결의 cwnd가 작을 때 ACK마다 1 MSS씩 늘리는 동작을 slow start라고 부르는 이유는 무엇인가요?

## 구두 답변

slow start는 느리게 보내기가 아니라, 경로 용량을 모르는 시작점에서 ACK clock을 이용해 전송량을 빠르게 탐색하는 단계입니다. RFC 5681에서 cwnd < ssthresh이면 slow start를 사용하고, 새 데이터를 누적 확인한 ACK마다 cwnd를 최대 SMSS만큼 늘립니다. 따라서 SMSS=1000바이트, cwnd=2000바이트라면 두 segment를 보낸 뒤 첫 ACK가 1000바이트의 새 데이터를 확인할 때 cwnd는 최대 3000, 다음 ACK 뒤 최대 4000바이트가 됩니다. 한 RTT 동안 ACK가 두 개 돌아오면 대략 창이 두 배가 되는 것처럼 보이지만, 실제 증가는 ACK가 확인한 새 바이트 수에 따라 정해집니다. RFC의 권고식 cwnd += min(N,SMSS)에서 N은 해당 ACK가 확인한 이전 미확인 바이트 수입니다. delayed ACK가 두 segment를 한 번에 확인해도 증가는 최대 SMSS이고, receiver가 한 segment를 잘게 나눈 ACK를 여러 개 보내도 N 기준 계산은 ACK division으로 cwnd가 부풀지 않게 합니다. cwnd=ssthresh에서는 구현이 slow start나 congestion avoidance 중 하나를 선택할 수 있고, threshold를 넘으면 후자의 대략 1 SMSS/RTT 증가로 바뀝니다. 이 값은 수신 버퍼 광고인 rwnd와 별개이므로 min(cwnd,rwnd)가 실제 송신 한도입니다. 예를 들어 cwnd가 8 SMSS로 커져도 rwnd가 3 SMSS면 세 개 이상 outstanding으로 보낼 수 없습니다. 반대로 ACK가 진행되지 않아 timeout이 나면 slow start는 단순히 계속 증가하지 않고 loss window 1 full-sized segment에서 재개합니다. 구현을 검증할 때는 ACK마다 newly acknowledged bytes, cwnd, ssthresh, rwnd를 기록하고 delayed ACK와 gap/timeout trace를 별도로 비교해야 매 RTT 정확히 2배라는 과장을 피할 수 있습니다.

## 득점 포인트

- ACK마다 최대 SMSS 또는 min(N,SMSS) 증가라는 RFC 규칙을 설명한 점
- cwnd=2SMSS에서 3→4SMSS로 가는 수치와 delayed ACK 반례를 든 점
- ssthresh, rwnd, timeout LW를 slow start 성장과 구분한 점

## 감점 포인트

- slow start를 실제로 느린 증가라고 설명한 점
- 매 RTT 정확히 두 배 또는 rwnd와 cwnd를 같은 변수로 말한 점

## 더 파고들 거리

- ACK division 방어와 Appropriate Byte Counting의 차이를 더 살펴보세요
- rwnd가 작은 application-limited trace에서 실제 송신 한도를 계산해 보세요
