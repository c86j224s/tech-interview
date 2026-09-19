---
id: tcp-rto-clock-granularity-floor
title: 계산된 TCP RTO가 200ms인데 timer clock이 거칠다면 실제 timeout을 어떻게 정하나요?
difficulty: 중하
category: 네트워크
tags:
  - TCP
  - RTO
  - clock granularity
  - timer
related: []
---
# 계산된 TCP RTO가 200ms인데 timer clock이 거칠다면 실제 timeout을 어떻게 정하나요?

## 구두 답변

먼저 제목의 200ms가 산출되는 입력을 분명히 하고, RFC의 최소값과 운영체제 timer tick을 따로 적용합니다. 예를 들어 SRTT=120ms, RTTVAR=20ms, G=10ms이면 SRTT+max(G,4×RTTVAR)=120+80=200ms입니다. RFC 6298의 권고에 따르면 계산값 200ms는 1초보다 작으므로 RTO를 1초로 올립니다. 따라서 이 표준 기준에서 최초 deadline은 송신 시각 t0+1.000s 이상이어야 하며, 10ms tick 때문에 t0+1.000s를 t0+0.990s로 앞당겨 재전송해서는 안 됩니다. 구현이 deadline을 tick 격자에 올림 처리한다면 t0=12.003s의 송신은 13.003s 이후의 bucket에 배치될 수 있고, scheduler가 바쁘면 callback은 그보다 늦어질 수 있습니다. 이 늦음은 RTO 산식에 3ms를 임의로 더했다는 뜻이 아닙니다. G는 RTT/RTO 계산에서 고려하는 clock granularity이고, timer wheel의 bucket rounding과 실제 callback 지연은 별도의 구현 관측값입니다. 반대로 RTO 산식이 200ms로 남는 별도 정책을 시험한다면, 계산 deadline을 t0+200ms로 두되 tick이 10ms일 때 200ms 또는 다음 안전한 210ms에 등록하는 식으로 이른 발화 금지를 확인해야 합니다. 하지만 1초 floor를 따르는 RFC 6298 기본 설명에서 실제 설정값은 1초입니다. 검증 시에는 computed=200ms, floor_applied=1000ms, registered_deadline, callback_time을 분리해 기록합니다. OS의 coalescing이나 CPU 스케줄링은 이 문서의 숫자로 성공을 보장할 수 없으므로 실제 스택 로그로 확인해야 합니다.

## 득점 포인트

- 제목의 200ms를 SRTT=120, RTTVAR=20, G=10에서 계산한 점
- 1초 floor와 tick/bucket rounding을 별도 단계로 나눈 점
- 등록 deadline과 실제 callback을 구분하고 이른 재전송 금지를 설명한 점

## 감점 포인트

- 140ms라는 다른 전제를 답으로 사용한 점
- clock tick 때문에 RTO 산식 자체에 임의 지연을 더한 점

## 더 파고들 거리

- floor를 사용하지 않는 실험 정책이라면 안전한 tick 올림을 비교해 보세요
- scheduler 지연과 timer coalescing을 별도 측정값으로 수집해 보세요
