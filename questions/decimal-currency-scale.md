---
id: decimal-currency-scale
title: '금액을 decimal(12,2)로 저장할 때 곱셈·세금·반올림으로 scale이 늘어나는 상황을 어떻게 계약하나요?'
difficulty: 하
category: 데이터베이스
tags:
  - SQL
  - decimal
  - currency
  - scale
related:
  - denormalization-maintenance
---
# 금액을 decimal(12,2)로 저장할 때 곱셈·세금·반올림으로 scale이 늘어나는 상황을 어떻게 계약하나요?

## 구두 답변

먼저 `decimal(12,2)`를 모든 계산의 중간 저장소로 쓸지, 게시되는 최종 금액의 형식으로 쓸지 분리하겠습니다. 단가 19.99에 세율 계수 1.075를 곱하면 설명용 중간값은 21.48925입니다. 이 값을 바로 21.49로 줄일지, 더 높은 scale을 보존한 뒤 invoice 게시 시점에 반올림할지는 line별·전체 합산 규칙에 달려 있습니다.

`decimal`은 십진 의미의 exact 연산을 제공할 수 있지만 precision·scale이 무한히 늘어나지는 않습니다. `numeric(12,2)`는 정수부와 소수부 폭을 제한하므로 수량·세율·환율을 곱한 결과가 범위를 넘으면 명시적으로 실패하거나 더 넓은 중간 타입으로 계산해야 합니다. 통화 코드와 최소 단위도 함께 검증하겠습니다.

반올림 위치는 화면 formatter에 숨기지 않습니다. line rounding인지 total rounding인지, half-up인지 half-even인지, 환불이 원래 계산 version을 따르는지를 저장·테스트 계약으로 둡니다. migration 전에는 최댓값·실제 scale·계산 peak를 검사하고 overflow 행을 보정·거절·별도 원장으로 분류합니다. 화면에 21.49로 보인다는 이유만으로 DB 합계가 같은 것은 아니므로 원장값·게시값·반올림 차이를 별도 대조하겠습니다.

PostgreSQL을 전제로 하면 이 사례의 저장 상태를 더 구체적으로 말할 수 있습니다. `19.99 × 1.075 = 21.48925`를 넓은 `numeric` 중간값으로 계산한 뒤 `numeric(12,2)`에 대입하면 declared scale 2로 반올림되어 `21.49`가 됩니다. PostgreSQL numeric tie는 0에서 멀어지는 방향이므로 업무가 half-even이라면 별도 구현을 명시해야 합니다. 반올림 뒤 정수부가 남은 precision을 넘으면 저장 성공이 아니라 오류로 처리합니다. 따라서 컬럼 선언의 scale과 계산식의 scale 전파를 같은 것으로 가정하지 않고, 중간값·저장값·게시값을 각각 fixture로 검증합니다.

세금이 line 기준이면 각 line의 확정값을 원장에 남기고, total 기준이면 내부 scale을 유지한 합계와 게시 total을 분리합니다. 예를 들어 세 줄의 중간세금이 0.005라면 PostgreSQL numeric 기준 line 결과는 0.01×3=0.03이고 total 결과는 0.015→0.02입니다. 이 차이는 화면 formatter가 해결할 문제가 아닙니다. currency, 계산 규칙 version, overflow 거절 수를 함께 기록해 재정산 때 동일한 경계를 재현합니다.

## 득점 포인트

- 단가×세율의 중간 scale과 게시 scale을 다른 경계로 설명합니다.
- precision/scale 범위를 확인하고 overflow 행을 사전 분류합니다.
- line rounding과 total rounding을 도메인 규칙으로 명시합니다.
- 표시 포맷과 저장·합산 원장을 분리합니다.

## 감점 포인트

- `decimal`이면 모든 계산이 자동으로 통화 규칙에 맞는다고 단정합니다.
- DDL이 성공했다는 사실만으로 미래 곱셈의 overflow가 없다고 말합니다.
- 반올림 mode와 적용 위치를 생략하고 formatter에 맡깁니다.

## 더 파고들 거리

- 세 줄의 세금을 line별로 반올림할 때와 전체 합산 후 반올림할 때의 차이를 어떻게 고정할까요?
- minor unit 정수와 decimal 중 환율 계산에서 어떤 중간 상태가 필요한가요?
