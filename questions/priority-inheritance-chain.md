---
id: priority-inheritance-chain
title: >-
  높은 우선순위 작업이 A의 lock을 기다리고 A는 B의 lock을 기다립니다. priority inheritance는 어느 owner까지
  전파되어야 하나요?
difficulty: 중하
category: 동시성
tags:
  - priority inheritance
  - PI chain
  - rt_mutex
  - lock
related:
  - deadlock-prevention
---
# 높은 우선순위 작업이 A의 lock을 기다리고 A는 B의 lock을 기다립니다. priority inheritance는 어느 owner까지 전파되어야 하나요?

## 구두 답변

전파 범위는 현재 waiter가 아니라 실제 실행을 막고 있는 ownership chain의 끝까지입니다. H가 mutex A를 기다리고 A의 owner L1이 mutex B를 기다린다면, A를 바로 풀 수 있는 L1을 올리는 것만으로는 충분하지 않을 수 있습니다. B의 owner L2가 M에게 선점되어 실행되지 않는다면 L2가 먼저 B를 풀어야 L1이 재개되고, 그 뒤 L1이 A를 풀어 H가 진행합니다. 예를 들어 `base(L1)=2`, `base(L2)=1`, `priority(H)=10`, `priority(M)=5`라면 H가 A를 기다리는 순간 `effective(L1)=10`이 되고, L1이 B를 기다리는 순간 그 유효 priority 10이 L2에도 반영되어 `effective(L2)=10`이 됩니다. L2가 B를 해제하고 L1이 A를 해제하는 순서가 전파의 실질적인 이유입니다.

이것은 H의 priority를 모든 runnable 작업에 복사하는 규칙이 아닙니다. 각 mutex의 owner와 waiter 관계를 따라 현재 blocker에게만 donor가 연결됩니다. Linux `rt_mutex` 설계 문서는 waiter와 owner를 priority-sorted 구조로 관리하고 ownership dependency를 따라 boost가 전파될 수 있음을 설명합니다. 그러나 chain depth와 tie-break를 모든 구현의 일반 보장으로 말할 수는 없습니다. chain에 cycle이 생기면 PI는 deadlock을 제거하지 않으므로 lock order나 별도 검출이 필요합니다.

실무 trace에는 각 edge가 언제 만들어지고 사라지는지도 남깁니다. H가 A에서 빠지면 L1의 donor가 사라지고, L1이 B를 계속 기다리는지에 따라 L2의 boost도 유지되거나 내려갑니다. 반대로 L1이 A를 얻은 뒤 즉시 unlock하면 H의 wake-up과 L2의 원래 priority 복귀가 서로 다른 사건입니다. 이 순서를 구분해야 “chain 끝까지 올린다”는 설명이 모든 owner를 영구히 최고 priority로 만든다는 오해를 피할 수 있습니다.


## 득점 포인트

- `H → A owner L1 → B owner L2`의 순서를 실제 실행 선행조건으로 설명합니다.
- `2, 1, 10, 5` 숫자로 L1과 L2의 effective priority가 차례로 10이 되는 과정을 보여 줍니다.
- donor를 모든 작업에 전파하는 것이 아니라 ownership dependency를 따라 전파한다고 한정합니다.
- Linux rt_mutex 문서의 구현 설계와 POSIX·RTOS 전체의 보편 계약을 구분합니다.

## 감점 포인트

- A owner인 L1까지만 올리면 항상 충분하다고 단정합니다.
- H의 priority를 M을 포함한 모든 runnable task에 복제한다고 설명합니다.
- cycle이 생겨도 priority propagation이 lock을 자동으로 풀어 준다고 말합니다.
- 특정 Linux 문서만으로 모든 chain depth와 동순위 처리 규칙을 보장합니다.

## 더 파고들 거리

- L1이 B를 기다리는 동안 H가 timeout으로 빠지면 L1과 L2의 donor를 어떤 순서로 재계산해야 할까요?
- PI mutex와 일반 mutex가 chain 중간에서 섞이면 어떤 edge에서 전파가 끊기는지 관측할 수 있을까요?
