---
id: game-float-fma-determinism
title: 같은 float 수식인데 CPU에서 FMA 사용 여부가 달라지면 replay가 갈라질 수 있는 이유는 무엇인가요?
difficulty: 중하
category: 게임 서버
tags:
  - 결정성
  - 부동소수점
  - FMA
related:
  - fixed-variable-step-integration
---
# 같은 float 수식인데 CPU에서 FMA 사용 여부가 달라지면 replay가 갈라질 수 있는 이유는 무엇인가요?

## 구두 답변

분리된 `(a*b)+c`는 `round(round(a*b)+c)`처럼 중간 곱을 반올림하고, FMA는 `round(a*b+c)`로 중간 결과를 유지할 수 있습니다. 같은 source 식이어도 마지막 bit가 달라져 `x>threshold` branch가 갈릴 수 있고, 한쪽만 충돌 후보를 추가하거나 RNG를 소비해 이후 tick까지 divergence가 커집니다. 특정 십진수 결과를 근거 없이 제시하지 말고 binary32 operand를 hex 또는 bit pattern으로 고정해 FMA on/off를 각각 실행해야 합니다.

권위 replay라면 compiler contraction, fast-math, debug/release, target ISA와 SIMD 정책을 빌드 계약으로 고정합니다. first divergence tick에서 a,b,c, 두 결과 bit, threshold, branch와 state hash를 함께 남기면 실제 규칙 차이인지 확인할 수 있습니다. FMA가 항상 좋거나 나쁘다고 할 수 없고, IEEE-754 타입만 같다고 rounding point까지 같아지는 것도 아닙니다.

특히 비교 직전 `-0`, NaN, subnormal 처리까지 로그에 포함해야 합니다. FMA on/off를 바꾼 테스트에서 결과 bit가 달라도 threshold에서 같은 branch라면 그 식은 관측된 divergence 원인이 아닐 수 있고, 반대로 한 bit 차이가 clamp 경계를 넘으면 즉시 규칙 상태가 달라집니다. 그러므로 수식 차이와 실제 gameplay 차이를 trace에서 분리해야 합니다.

 단일 수식 테스트가 통과해도 전체 replay 계약이 성립하는 것은 아닙니다. 실제 velocity update의 입력을 고정한 통합 테스트에서 branch와 state hash를 비교하고, 빌드 artifact에 compiler·ISA·fast-math 설정을 남겨야 나중에 재현 가능한 원인 조사가 됩니다.

 수식 수준의 bit 차이와 실제 규칙 차이를 같은 로그에서 비교해야 원인과 상관관계를 혼동하지 않습니다.

## 득점 포인트

- 분리 곱셈·덧셈과 FMA의 반올림 지점 차이를 설명합니다.
- bit 차이가 실제 분기·상태 변화로 이어졌는지 추적합니다.

## 감점 포인트

- IEEE-754 타입만 같으면 컴파일러 contraction 정책도 같다고 합니다.
- 더 정확한 국소 계산이 기존 replay와 반드시 같은 결과라고 합니다.

## 더 파고들 거리

- binary32로 정확히 표현 가능한 입력을 이용해 FMA 반례를 어떻게 만들까요?
- fast-math를 끈 뒤에도 다른 libm 함수가 만드는 차이는 어떻게 격리하나요?
