---
id: game-snapshot-buffer-delay
title: snapshot jitter buffer를 너무 짧거나 길게 잡으면 어떤 trade-off가 생기나요?
difficulty: 중하
category: 게임 서버
tags:
  - snapshot
  - jitter
  - 보간
related:
  - rewind-tick-interpolation-evidence
---
# snapshot jitter buffer를 너무 짧거나 길게 잡으면 어떤 trade-off가 생기나요?

## 구두 답변

결론부터 말하면 buffer delay는 원격 snapshot의 표시 지연과 결측 흡수력을 맞바꾸는 값입니다. 로컬 입력 반응 지연과 같은 숫자로 취급하면 안 됩니다. server snapshot 주기가 50ms이고 arrival delay의 p95가 48ms인 상황에서 30ms buffer를 쓰면 renderServerTime이 다음 sample보다 앞서 gap이 생길 수 있습니다. 100ms로 올리면 같은 burst를 기다릴 여유가 생기지만 원격 문이나 상대 위치가 최대 약 70ms 더 오래된 상태로 보일 수 있습니다. 계산은 `renderServerTime=estimatedServerNow-buffer`로 하고, `t=5.000,x=10`과 `t=5.050,x=12`를 bracket하면 `t=5.025`에서 `α=.5`, x=11입니다. 47ms의 arrival 간격을 속도 계산에 쓰지 않습니다. 운영에서는 평균 RTT가 아니라 p95/p99 arrival, gap 비율, extrapolation 누적시간, correction 크기, 화면 표시 지연을 함께 측정해 최소·최대 범위 안에서 완만하게 조정합니다. 다음 sample이 없으면 50ms 같은 짧은 maxExtrapolation 뒤 정지나 stale로 바꾸며 무한히 마지막 속도를 연장하지 않습니다. 판정은 authoritative tick history를 사용하고 렌더 buffer를 재사용하지 않습니다.


추가로 buffer를 조정할 때는 한 연결의 통계와 모든 entity의 렌더 경계를 함께 기록해야 합니다. 예를 들어 p95가 48ms에서 75ms로 올라갔다고 곧바로 30ms를 100ms로 바꾸면 이미 도착한 sample의 renderServerTime이 한 번에 뒤로 이동해 화면 전체가 점프할 수 있습니다. target delay를 10ms씩 늘리고 낮출 때도 hysteresis를 두며, 변경 전후의 gap 감소가 표시 지연 증가보다 큰지 비교합니다. 이 판단은 원격 관찰 객체에만 적용하고 로컬 캐릭터의 input-to-photon 측정과 별도 대시보드로 관리합니다.
## 득점 포인트

- 서버 timestamp 기반 bracket 계산과 arrival jitter의 역할을 이 사례의 숫자로 구분합니다.
- p95·gap·correction을 함께 보고 buffer를 동적으로 바꾸되 급격한 전역 점프를 피하는 선택을 설명합니다.
- 외삽 window 이후 stale 전환과 판정 상태 분리를 명시합니다.

## 감점 포인트

- “RTT가 50ms이므로 buffer도 50ms”라고 왕복 지연과 one-way 분포를 동일시합니다.
- 100ms가 로컬 입력을 70ms 늦춘다고 단정하거나, 결측 동안 무제한 외삽을 허용합니다.
- 보간 위치를 충돌·보상 판정의 권위 위치로 설명합니다.

## 더 파고들 거리

- adaptive buffer가 p99 개선 대신 화면 지연 예산을 초과할 때 어떤 hysteresis를 둘지 묻습니다.
- 150ms render delay와 50ms sampling에서 필요한 retained boundary를 sampling 정책별로 계산해 보세요.
