---
id: tcp-rtt-first-sample-estimator
title: TCP에서 첫 RTT sample을 얻었습니다. SRTT와 RTTVAR를 어떤 초기값으로 시작하나요?
difficulty: 하
category: 네트워크
tags:
  - TCP
  - RTT
  - SRTT
  - RTTVAR
  - RTO
related:
  - tcp-flow-vs-congestion-control
---
# TCP에서 첫 RTT sample을 얻었습니다. SRTT와 RTTVAR를 어떤 초기값으로 시작하나요?

## 구두 답변

첫 번째 유효한 RTT 측정값을 R이라고 하면 RFC 6298의 시작 상태는 SRTT=R, RTTVAR=R/2입니다. 이어 RTO를 SRTT+max(G, 4×RTTVAR)로 계산하고, 그 값이 1초보다 작으면 1초로 올립니다. 예를 들어 R=100ms, G=10ms라면 SRTT=100ms, RTTVAR=50ms, 변동성 항=200ms이므로 계산 RTO는 300ms이고 권고 표현의 RTO는 1초입니다. 첫 측정에 예전 연결의 평균을 섞지 않는 이유는 새 경로의 지연 분포와 이전 경로의 상태가 다를 수 있기 때문입니다. 다만 sample 자체가 최초 전송에 대응한다는 전제가 먼저입니다. timeout 뒤 재전송된 segment의 ACK처럼 어느 전송을 확인했는지 모호한 값은 첫 sample로 인정하지 않습니다. 두 번째 sample R′=140ms가 들어오면 old SRTT=100을 사용하여 RTTVAR=0.75×50+0.25×|100−140|=47.5ms를 먼저 계산하고, 그 다음 SRTT=0.875×100+0.125×140=105ms로 바꿉니다. 따라서 새 값을 먼저 대입하면 |105−140|=35ms를 써서 46.25ms가 되어 다른 추정 궤적을 만들게 됩니다. 구현에서는 srtt·rttvar·rto를 별도 상태로 두고 sample accepted 여부, G, floor 적용 전후 값을 로그로 남기는 것이 안전합니다. 특히 연결별 상태가 비어 있는 동안에는 RFC 6298이 1초 초기 RTO를 권고하므로, 첫 sample 이전부터 임의의 100ms timer를 쓰는 것으로 설명하면 안 됩니다. 첫 sample 이후에도 RTO는 SRTT만 복사한 값이 아니라 변동성 항과 G를 함께 계산한 결과이며, timer 만료가 곧 estimator 갱신을 의미하지 않습니다. 실제 timer callback은 scheduler 지연과 별개이므로 RTO 숫자만으로 발화 시각을 단정하지 않습니다.

## 득점 포인트

- R=100ms에서 SRTT=100, RTTVAR=50, floor 전 RTO=300ms를 직접 계산한 점
- 두 번째 R=140ms에서 old SRTT를 사용해 RTTVAR를 먼저 갱신한 순서를 설명한 점
- sample의 유효성 판단과 RTO 산식을 timer firing 시각과 분리한 점

## 감점 포인트

- RTO를 첫 RTT의 단순 배수라고만 말한 점
- 새 SRTT를 먼저 대입하거나 재전송 ACK를 무조건 sample로 넣은 점

## 더 파고들 거리

- Karn 제외와 timestamp 예외를 같은 trace에서 비교해 보세요
- G, 1초 floor, timer callback 지연을 각각 로그로 설계해 보세요
