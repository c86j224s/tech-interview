---
id: priority-inheritance-boost-drop
title: >-
  최고 우선순위 waiter가 timeout으로 취소됐습니다. lock holder의 상속 우선순위는 언제 낮아져야 하며 무엇을 다시
  계산하나요?
difficulty: 중하
category: 동시성
tags:
  - priority inheritance
  - timeout
  - waiter
  - effective priority
related:
  - semaphore-acquire-cancel-race
---
# 최고 우선순위 waiter가 timeout으로 취소됐습니다. lock holder의 상속 우선순위는 언제 낮아져야 하며 무엇을 다시 계산하나요?

## 구두 답변

holder의 priority는 timeout 함수가 반환했다는 사실만으로 낮추지 않고, 해당 waiter가 실제 대기 집합과 owner의 PI bookkeeping에서 제거된 것이 선형화된 뒤 다시 계산해야 합니다. L이 mutex A와 B를 보유하고 base priority가 2이며, A의 최고 live waiter가 9, B의 최고 live waiter가 6이라고 하겠습니다. 이때 `effective(L)=max(2,9,6)=9`입니다. A의 priority 9 waiter가 timeout으로 확정 제거되면 결과는 `max(2,6)=6`이지 즉시 2가 아닙니다. B의 waiter도 제거될 때만 base 2로 돌아갑니다. A에 같은 priority 9의 다른 waiter가 남아 있으면 9를 유지해야 하므로, 취소된 숫자를 단순히 빼는 방식은 틀립니다.

반대로 timeout과 lock 획득이 경쟁하면 waiter가 lock을 얻은 뒤 timeout 경로가 늦게 관찰될 수 있습니다. 이때 donor를 너무 일찍 삭제하면 holder가 아직 막고 있는 높은 waiter를 무시해 inversion을 재도입하고, 자료구조에서 이미 사라진 waiter를 남기면 불필요한 boost가 지속됩니다. 구현은 waiter 상태, mutex 대기 구조, owner의 PI 구조를 일관된 순서로 갱신해야 합니다. Linux rt_mutex의 내부 구조를 모든 mutex API의 계약으로 일반화할 수는 없지만, 재계산의 입력이 base와 각 보유 mutex의 최고 live waiter라는 원칙은 분명합니다.

검증 시에는 취소 결과만 검사하지 말고 세 사건의 순서를 표로 남깁니다. `waiter enters → timeout/lock outcome is linearized → PI edge removed`를 기록하고, A의 9와 B의 6을 각각 독립 donor로 관찰합니다. 같은 시각에 unlock이 일어났다면 어느 경로가 lock ownership을 확정했는지 API의 반환값과 wake-up 기록을 대조해야 합니다. 이런 검사가 없으면 드물게 발생하는 stale boost나 조기 priority drop을 정상 동작으로 오인합니다.


## 득점 포인트

- timeout 반환과 실제 waiter 제거의 선형화 시점을 구분합니다.
- `max(2,9,6) → max(2,6) → 2`라는 숫자 trace로 다른 mutex donor를 보존합니다.
- timeout·unlock·lock 획득 경쟁에서 너무 이른 삭제와 너무 늦은 삭제의 결과를 비교합니다.
- 구현 자료구조의 세부는 대상 mutex 계약으로 확인하되 재계산 입력을 명시합니다.

## 감점 포인트

- 최고 priority waiter 하나가 취소되면 holder를 무조건 base까지 낮춥니다.
- A만 보고 B의 priority 6 waiter를 무시합니다.
- timeout 오류 반환만 확인하고 waiter가 PI 구조에서 제거됐는지 확인하지 않습니다.
- priority 하락을 scheduler가 임의로 하는 현상처럼 설명하고 ownership 상태를 빠뜨립니다.

## 더 파고들 거리

- timeout 직전에 lock 획득이 성공한 경우 획득과 취소 중 어느 사건을 선형화할지 API가 어떻게 정의해야 할까요?
- 남은 donor와 unlock 시각을 기록해 PI 재계산 비용과 지연을 어떻게 분리해서 측정할까요?
