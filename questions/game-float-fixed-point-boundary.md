---
id: game-float-fixed-point-boundary
title: 게임 규칙 중 어떤 값을 fixed-point나 정수로 옮기면 결정성에 도움이 되지만 어떤 비용이 생기나요?
difficulty: 중하
category: 게임 서버
tags:
  - fixed-point
  - 결정성
  - 수치 범위
related:
  - game-server-tick-budget
---
# 게임 규칙 중 어떤 값을 fixed-point나 정수로 옮기면 결정성에 도움이 되지만 어떤 비용이 생기나요?

## 구두 답변

범위와 정밀도를 미리 계약할 수 있는 금액·점수·탄약·tick·격자 좌표부터 정수화하는 편이 좋습니다. 금액을 cents로 두면 반올림 규칙이 명확합니다. fixed-point라면 `raw=round(real*S)`, 곱셈 `rawA*rawB/S`, 음수 rounding, 0 나누기와 중간 overflow를 계약해야 합니다. raw 두 값의 곱이 저장 타입을 넘을 수 있으므로 정수라는 이유로 overflow가 사라지지 않습니다.

속도·위치·물리 전체를 옮기면 scale을 높일수록 정밀도는 늘지만 범위와 비용이 나빠집니다. 외부 physics가 float를 반환하면 경계에서 플랫폼 차이가 남습니다. 권위 판정은 fixed-point, render interpolation은 float로 분리할 수 있지만 presentation 값을 gameplay 입력으로 되돌리지 않아야 합니다. 최대 월드·속도·tick을 넣은 overflow test와 음수 rounding test를 실행하고, 남은 float·iteration·RNG·serialization까지 결정성 계약에 포함합니다.

예를 들어 scale=1000으로 위치를 저장하고 최대 좌표가 2,000,000이면 raw가 2,000,000,000이 되어 signed 32-bit 여유가 거의 없습니다. 속도와 dt를 곱할 때는 64-bit 중간값과 명시적 rounding을 사용한 뒤 범위 검사를 해야 합니다. 음수 값을 0 방향으로 자를지 -무한대 방향으로 내릴지도 양쪽 replay에서 같아야 하며, 이러한 규칙은 serialization 포맷에도 반영해야 합니다.

 정수화 범위를 정할 때 단일 tick 최대치만 보지 말고 누적 적분과 보정 전후의 임시값까지 포함해야 합니다. overflow를 wrap으로 둘지 saturate로 둘지 panic으로 둘지도 규칙이며, 참가자마다 다른 기본 overflow 모드를 그대로 두면 결정성이 다시 깨집니다.

 남은 float library와 thread scheduling도 같은 테스트 매트릭스에서 바꾸어 보며, 정수화된 component만 일치하는지 전체 상태도 일치하는지 구분하겠습니다.

## 득점 포인트

- scale·표현 범위·중간 곱·음수 반올림 규칙을 함께 고정합니다.
- 정수화한 규칙 상태와 남은 float·외부 물리 경계를 구분합니다.

## 감점 포인트

- 정수 타입이면 overflow가 없다고 가정합니다.
- 포화·wrap·오류 처리 정책이 참가자마다 달라도 결정적이라고 합니다.

## 더 파고들 거리

- 위치 scale을 두 배로 바꿀 때 저장 포맷과 최대 월드 크기는 어떻게 바뀌나요?
- 물리 엔진의 float 결과를 고정소수점 규칙으로 가져오는 시점은 어디인가요?
