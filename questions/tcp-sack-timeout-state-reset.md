---
id: tcp-sack-timeout-state-reset
title: >-
  SACK 정보를 받은 뒤 retransmission timeout이 발생했습니다. 이전 SACK block을 그대로 재전송 판단에 써도
  되나요?
difficulty: 중하
category: 네트워크
tags:
  - TCP
  - SACK
  - timeout
  - 재전송
related: []
---
# SACK 정보를 받은 뒤 retransmission timeout이 발생했습니다. 이전 SACK block을 그대로 재전송 판단에 써도 되나요?

## 구두 답변

그대로 믿으면 안 됩니다. RFC 2018에서 SACK은 receiver가 현재 보유하고 있다고 보고한 범위를 알려 주는 advisory 정보이며, receiver는 이후 그 데이터를 버릴 수 있습니다. 예를 들어 sender가 cumulative ACK=200과 SACK [300,400)을 받은 뒤 연결이 멈췄다고 하겠습니다. timeout 시점에도 [300,400)이 receiver buffer에 남아 있다고 보장할 수 없으므로, sender는 이전 SACKed 표시를 끄고 left edge의 segment를 반드시 재전송 후보로 취급해야 합니다. 기존 block을 영구 면제하면 receiver가 이미 버린 300~399를 다시 채울 기회를 잃어 연결이 계속 진행되지 않을 수 있습니다. timeout 뒤의 처리 순서는 congestion-control과 scoreboard를 나누어 보는 것이 중요합니다. 먼저 오래된 SACK 상태를 폐기하고, cumulative ACK가 아직 확인하지 않은 outstanding 범위를 보수적으로 재전송 큐에 남깁니다. RFC 2018은 timeout 뒤 window의 왼쪽 edge segment를 SACKed bit가 켜져 있어도 재전송하도록 하며, 그 buffer는 cumulative ACK가 edge를 넘을 때까지 해제하지 않습니다. 이는 cwnd를 어떻게 줄일지와 다른 문제입니다. RFC 5681 기준 timeout은 cwnd=LW=1 SMSS 수준으로 낮추고 slow start로 재개하는 손실 반응을 적용하지만, 그 조치만으로 SACK scoreboard가 자동으로 최신화되지는 않습니다. 구현 자료구조에는 sacked, acked_cumulatively, timer_retransmitted를 별도 상태로 두고 timeout event에서 sacked만 reset하는 것이 명확합니다. 테스트는 SACK 보고 후 receiver가 유지하는 경우와 reneging하는 경우를 각각 만들고, timeout 직후 left edge가 재전송되는지, 새 SACK 도착 후 이미 보관된 범위가 다시 제외되는지를 확인해야 합니다.

## 득점 포인트

- timeout에서 이전 SACKed bit를 끄고 left edge를 재전송하는 이유를 설명한 점
- receiver reneging과 cumulative ACK buffer 해제를 연결한 점
- SACK scoreboard reset과 cwnd/LW 감소를 별도 상태로 나눈 점

## 감점 포인트

- timeout 뒤 이전 SACK을 확정 사실로 계속 사용한 점
- SACK reset만으로 congestion-control reset이 끝났다고 말한 점

## 더 파고들 거리

- receiver가 SACKed data를 버리는 trace와 유지하는 trace를 비교해 보세요
- 새 SACK 도착 뒤 scoreboard를 다시 채우는 자료구조를 설계해 보세요
