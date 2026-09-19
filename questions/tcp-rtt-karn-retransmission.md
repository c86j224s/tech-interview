---
id: tcp-rtt-karn-retransmission
title: 재전송된 segment가 ACK를 받았습니다. 그 ACK의 왕복 시간을 RTT sample로 써도 되나요?
difficulty: 하
category: 네트워크
tags:
  - TCP
  - Karn algorithm
  - 재전송
  - RTT
related: []
---
# 재전송된 segment가 ACK를 받았습니다. 그 ACK의 왕복 시간을 RTT sample로 써도 되나요?

## 구두 답변

그 ACK의 도착 시간 차이를 일반 RTT sample로 쓰면 안 됩니다. 예를 들어 sequence 1000~1999를 t=0에 처음 보내고, 100ms에 timeout이 나서 같은 범위를 다시 보냈다고 하겠습니다. t=140ms에 ACK=2000이 오면 140ms는 최초 전송의 RTT일 수도 있고 재전송의 RTT일 수도 있습니다. 재전송 직후부터 40ms라는 값으로 보아도 ACK가 어느 사본을 확인했는지 누적 ACK만으로는 구분할 수 없습니다. 이 모호한 값을 SRTT에 넣으면 우연히 빠른 40ms를 정상 경로 지연으로 학습하여 RTO를 과도하게 낮출 수 있고, 다음 손실에서 spurious timeout이 이어질 수 있습니다. 그래서 Karn 알고리즘은 재전송된 segment에 대응하는 sample을 버리고, 그동안 재전송되지 않은 새 데이터가 명확히 ACK되었을 때만 estimator를 갱신하게 합니다. 이는 ACK를 버린다는 뜻이 아니라 측정 입력으로만 사용하지 않는다는 뜻입니다. 예외는 TCP timestamp option을 실제로 사용하여 ACK의 timestamp echo가 어느 송신 시도를 가리키는지 식별할 수 있을 때입니다. RFC 6298은 그 경우 재전송 segment에서도 안전한 측정을 허용하지만, 캡처에 timestamp 필드가 보인다고 곧바로 해당 커널이 estimator에 사용한다고 단정할 수는 없습니다. 협상과 송수신 timestamp 처리, 스택의 sample 생성 경로를 함께 확인해야 합니다. 구현 검증에서는 최초 전송 시각, 재전송 횟수, ACK의 누적 범위, timestamp 대응 여부를 기록하고, 재전송 ACK는 sample=rejected(reason=ambiguous)로 남기는 방식이 명확합니다.

## 득점 포인트

- 최초 전송과 재전송 중 어느 ACK인지 식별할 수 없어 sample을 거부한 점
- 100ms timeout 뒤 40ms ACK가 와도 140ms 또는 40ms를 임의 선택하지 않은 점
- timestamp가 ambiguity를 제거할 때만 예외가 된다는 조건을 붙인 점

## 감점 포인트

- ACK 도착 자체를 RTT 측정 허가로 표현한 점
- 패킷 캡처 timestamp만으로 스택 estimator 사용을 단정한 점

## 더 파고들 거리

- 누적 ACK와 timestamp echo의 대응을 실제 trace로 표시해 보세요
- Karn으로 sample이 줄어들 때 RTO가 보수적으로 남는 비용을 분석해 보세요
