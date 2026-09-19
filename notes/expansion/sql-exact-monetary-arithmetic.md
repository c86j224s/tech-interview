---
id: sql-exact-monetary-arithmetic
title: Decimal·부동소수점·금액 연산
topic: 데이터베이스
summary: >-
  표시 반올림과 저장 정밀도, exact numeric과 binary floating point의 합산 오차를 금액
  단위·scale·overflow 사례로 구분합니다.
questionIds: []
prerequisites:
  - identity-representation
  - sql-result-semantics
related:
  - projection-maintenance
  - schema-cutover
reviewedAt: '2026-09-19'
---
# Decimal·부동소수점·금액 연산

금액 타입을 고르는 일은 `decimal`이라는 이름을 붙이는 데서 끝나지 않습니다. 입력이 어떤 통화이고, 계산 중 얼마의 소수 자리를 보존하며, 어느 시점에 고객에게 게시할 금액으로 확정하는지를 하나의 계약으로 만들어야 합니다. PostgreSQL의 `numeric`과 `decimal`은 같은 exact numeric 계열이고 선언한 precision·scale에 맞지 않는 값은 저장 경계에서 반올림되거나 오류가 납니다. 반면 `real`과 `double precision`은 근사 부동소수점입니다. 이 차이는 단순 표시 형식이 아니라 equality, 합계, 범위 검사, 재현성의 차이입니다.

## 금액 의미

입력 `19.990`의 숫자값은 19.99와 같지만, 원문 scale을 보존해야 하는지와 통화가 USD인지 KRW인지는 별도 정보입니다. 따라서 원장 행에는 적어도 통화, 계산 규칙 버전, 원래 입력 또는 정규화된 금액, 게시 금액을 구분하는 편이 안전합니다. 센트처럼 고정 최소 단위를 쓰는 통화는 minor-unit 정수로 표현할 수 있지만, 환율 1.075나 할인율 12.5%처럼 중간 계산에 분수가 필요한 값까지 모두 정수로 밀어 넣으면 다른 scale 계약이 필요해집니다.

`numeric(12,2)`는 소수 둘째 자리까지 저장한다는 뜻이지 모든 식의 결과가 자동으로 12,2가 된다는 뜻은 아닙니다. 설명상 정수부에 최대 10자리 폭이 남지만 부호나 실제 허용 범위 정책까지 포함해 경계값을 확인해야 합니다. 음수 환불, 0, NULL, 통화가 다른 합계를 별도의 테스트 축으로 둡니다.

## Exact와 binary 표현

0.1은 십진수로 유한하지만 2의 거듭제곱 분모를 갖는 이진 분수로는 유한하게 끝나지 않습니다. 부동소수점은 가장 가까운 표현을 저장하고, 반복 덧셈에서는 각 단계의 반올림이 다음 입력에 들어갑니다. 그래서 화면 formatter가 `100.00`을 보여도 내부 합이 수학적 100과 동일하다는 뜻은 아닙니다. exact decimal도 도메인 rounding을 정해 주지는 않으므로 `numeric`을 선택했다고 반올림 위치까지 해결됐다고 말하면 안 됩니다.

PostgreSQL 문서의 구분은 실용적입니다. `numeric`은 지정 가능한 정밀도로 exact 값을 표현하는 타입이고 `real`·`double precision`은 정확도와 범위가 다른 floating-point 타입입니다. 측정값처럼 오차 모델을 허용하는 데이터에는 float가 유리할 수 있지만, “두 원장 값이 같은가”를 법적 의미로 판단하는 금액에는 별도 계약 없이 적합하지 않습니다.

## 중간 계산

단가 19.99와 세율 계수 1.075를 계산하면 다음 중간값을 얻습니다.

```text
19.99 × 1.075 = 21.48925
게시 scale 2, PostgreSQL numeric의 선언 scale로 대입 = 21.49
```

이 문장에서 `21.49`는 PostgreSQL `numeric(12,2)`에 대입하는 경계를 말합니다. PostgreSQL은 선언된 scale보다 많은 소수 자리가 있으면 그 scale로 반올림하고, numeric tie는 기본적으로 0에서 멀어지는 방향으로 처리합니다. 따라서 업무에서 half-even을 요구한다면 애플리케이션이나 별도 SQL 정책을 명시해야 하며 PostgreSQL numeric의 기본 동작으로 추정하면 안 됩니다. 정수부가 남은 precision을 초과하면 반올림으로 잘라 저장하는 대신 오류가 납니다.

곱셈 중간 결과의 precision·scale 전파 공식 자체를 모든 DB에 일반화하지 않습니다. PostgreSQL 문서가 보장하는 것은 exact 계산과 선언 타입으로의 coercion 경계이지, 모든 식에 대해 애플리케이션이 동일하게 사용할 수 있는 전파 공식이 아닙니다. 따라서 넓은 `numeric` 중간값으로 계산한 뒤 의도한 시점에 `numeric(12,2)`로 명시적으로 cast하는 경로와, 처음부터 좁은 컬럼에 대입하는 경로를 같은 것으로 취급하지 않습니다.

## 반올림 경계

세금 계산은 line과 total이 다른 계약일 수 있습니다. 세 줄의 계산값이 각각 `0.005`라면 PostgreSQL numeric의 away-from-zero 기준에서 line을 먼저 둘째 자리로 만들면 `0.01 + 0.01 + 0.01 = 0.03`입니다. 반대로 내부값을 합쳐 `0.015`를 만든 뒤 한 번 반올림하면 `0.02`입니다. 어느 값이 옳은지는 함수 호출 횟수가 아니라 세금·청구 규칙이 정합니다. half-even이나 truncation을 별도로 선택하면 결과가 달라지므로 mode와 경계를 fixture로 고정합니다.

표시용 `to_char`나 프런트엔드 formatter에서만 반올림하면 화면과 DB `SUM`이 달라질 수 있습니다. 법적 invoice가 line 금액을 확정하도록 요구한다면 반올림된 line을 원장에 저장하고, total 기준이라면 충분한 내부 scale을 보존한 값과 게시 total을 분리합니다. 이미 발행한 invoice는 계산 규칙 버전을 남겨 새 규칙으로 소급하지 않도록 합니다.

## Precision와 overflow

precision을 낮추기 전에는 실제 데이터와 미래 peak를 함께 검사합니다. 예를 들어 12,2에서 10,2로 줄이면 정수부 폭이 10자리에서 8자리로 줄어 `1,000,000,000.00`이 새 범위를 벗어납니다. 아래처럼 shadow 변환을 통해 값의 운명을 분리합니다.

| 분류 | 예시 | 처리 |
| --- | --- | --- |
| 정상 | `999,999.99` | 새 타입 변환 후 대조 |
| scale 조정 | `19.995` | 규칙에 따른 반올림 fixture |
| 범위 초과 | `1,000,000,000.00` | 보정·확장·거절 중 승인 |
| 특수 값 | 음수 환불, NULL | 의미 보존 여부 확인 |

기존 행이 모두 들어간다고 미래 계산도 안전한 것은 아닙니다. 수량×단가×세율, 누적 환불, 환율 변환 결과의 peak를 입력 분포와 별도로 계산해야 합니다. 초과 행을 조용히 문자열 절삭하거나 최대값으로 clamp하면 금액 의미가 바뀌므로 migration을 멈추거나 별도 보정 원장으로 보냅니다.

## API와 저장 경계

JSON의 숫자를 JavaScript `Number`로 읽은 뒤 DB에 보내면 DB `numeric`의 exact 성질을 이미 잃었을 수 있습니다. 문자열 decimal 또는 minor-unit 정수와 통화 코드를 받는 방식 중 하나를 정하고, 지수 표기·부호·허용 scale·최대 자릿수·통화의 최소 단위를 입력 단계에서 검증합니다. driver가 결과를 다시 `Number`로 변환하는지도 확인합니다.

쓰기 트랜잭션에서는 입력 검증, exact 중간 계산, 명시적 반올림, 컬럼 범위 검사, 원장 기록을 한 경계로 묶습니다. 읽기 응답의 표시값은 원장값을 대체하지 않고, 계산 규칙 버전과 currency를 함께 내려야 재현 가능한 정산이 됩니다.

## 검증과 실패

작은 fixture로 `19.99 × 1.075`, `0.005` 세 줄, 최대 양수, 음수 환불, NULL, 통화 불일치를 실행합니다. 각 fixture마다 입력, 중간값, 반올림 mode, 저장값, 게시값, 합계를 기록해야 “계산합니다”라는 설명을 실제 상태 추적으로 바꿀 수 있습니다. float 합은 `0.1`을 1000회 더해 엄격한 `== 100`이 실패하는지 확인하되, 실행 결과는 언어·런타임에 종속된 측정값으로 기록합니다.

migration은 shadow column에서 변환 성공·scale 조정·overflow를 분류하고, 구 writer와 신 writer가 공존하는 동안 version 조건부 백필을 사용합니다. 백필이 읽은 시점 이후의 변경을 덮지 않는지, 구·신 합계가 계산 버전별로 일치하는지 확인합니다. 이 문서 작성에서는 PostgreSQL 서버와 driver를 실행하지 않았으므로 실제 catalog/driver 결과는 배포 조합에서 다시 검증해야 합니다.

## 비용과 선택

`numeric`은 exact 의미를 주는 대신 float보다 저장·계산 비용이 커질 수 있습니다. minor-unit 정수는 합산·비교가 단순하지만 통화별 scale, 환율 중간값, 분할 금액의 잔여 단위 배분을 별도로 설계해야 합니다. double은 넓은 범위와 빠른 계산이 필요한 물리량에 선택할 수 있지만 epsilon 비교는 원장 동일성 정책이 아닙니다.

선택 순서는 통화 최소 단위, 중간 계산 scale, 게시 단위, rounding mode, overflow 처리, 감사 재현성입니다. 이 순서가 정해진 뒤 decimal·정수·float의 역할을 나누면 표시와 저장을 한 타입에 억지로 맡기는 오류를 피할 수 있습니다.

## 참고 자료

- PostgreSQL, [Numeric Types](https://www.postgresql.org/docs/current/datatype-numeric.html), §8.1.2–8.1.3. `numeric`의 exact 성질, 선언 scale coercion, ties-away-from-zero, floating-point의 근사 성질을 확인했습니다.
- 실행하지 않은 SQL trace는 설명용 계산이며, 실제 결과와 driver 변환은 PostgreSQL major·driver 조합에서 재검증해야 합니다.

```diagram
{"title":"금액 계산과 게시 경계","caption":"중간 exact 값, 선언 scale, 원장과 표시를 분리해야 반올림과 overflow를 추적할 수 있습니다.","rows":[[{"id":"input","label":"입력 금액","detail":["통화·scale 검증"]}],[{"id":"calc","label":"중간 계산","detail":["19.99×1.075=21.48925"]}],[{"id":"boundary","label":"저장 경계","detail":["numeric(12,2) 반올림"]}],[{"id":"ledger","label":"원장 기록","detail":["규칙 version·currency"]}],[{"id":"audit","label":"검증·대조","detail":["overflow·합계·게시값"]}]],"edges":[{"from":"input","to":"calc","label":"exact 입력"},{"from":"calc","to":"boundary","label":"scale 확정"},{"from":"boundary","to":"ledger","label":"저장 계약"},{"from":"calc","to":"audit","label":"peak 검사"},{"from":"ledger","to":"audit","label":"합계 대조"}]}
```
