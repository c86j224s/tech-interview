---
id: priority-inversion-unbounded
title: >-
  높은 우선순위 작업이 낮은 우선순위의 lock holder를 기다리고 중간 우선순위 작업이 계속 실행됩니다. 왜 단순 priority
  queue만으로는 지연 상한이 없나요?
difficulty: 하
category: 동시성
tags:
  - priority inversion
  - 스케줄링
  - lock
  - 기아
related:
  - priority-queue-starvation
  - cpu-scheduling-policies
---
# 높은 우선순위 작업이 낮은 우선순위의 lock holder를 기다리고 중간 우선순위 작업이 계속 실행됩니다. 왜 단순 priority queue만으로는 지연 상한이 없나요?

## 구두 답변

단순 priority queue는 runnable 작업의 등급만 비교하고, 각 작업이 어떤 lock을 기다리는지는 스케줄 선택에 반영하지 않습니다. L이 mutex X를 잡고 있을 때 H가 X를 요청하면 H는 가장 높은 priority여도 runnable이 아니라 blocked입니다. 따라서 큐에서 실제로 선택 가능한 것은 L과 M이고, M이 X를 사용하지 않으면서도 L보다 높으면 L을 계속 선점합니다. 예를 들어 L의 X 임계 구역에 필요한 CPU 시간이 2ms인데, H가 t=1ms에 도착한 뒤 M이 5ms씩 세 번 실행되면 L이 남은 1ms를 실행하는 시점은 16ms 이후가 될 수 있습니다. M이 계속 도착하면 이 모델에는 L이 실행될 고정 시각이 없습니다. H가 큐의 앞에 있다는 사실만으로는 H가 X를 해제할 수 없으므로 지연 상한도 생기지 않습니다.

이것은 대기 cycle이 없는 priority inversion입니다. L은 결국 X를 풀 수 있지만, 중간 priority 작업의 선점 때문에 그 순간이 밀립니다. priority inheritance는 H가 X를 기다리는 동안 H의 priority를 L의 effective priority 계산에 넣어 L이 M보다 먼저 임계 구역을 마치게 하는 방식입니다. 다만 PI는 lock 밖의 디스크 I/O나 긴 계산을 줄이지 않으므로 lock 보유시간과 외부 호출도 따로 제한해야 합니다.

진단에서 M의 개수만 세는 것도 부족합니다. M이 runnable인지, L이 실제로 선점 가능한지, H가 lock 외의 다른 자원도 기다리는지를 같은 trace에 표시해야 합니다. 예컨대 PI를 적용한 뒤 L이 priority 10으로 올라가 t=2ms에 남은 임계 구역을 끝냈다면 H의 지연은 lock 작업량과 전환 비용에 가까워지지만, L이 그 안에서 파일 I/O를 수행하면 PI는 I/O 완료를 앞당기지 않습니다. 그러므로 protocol 선택 전에는 최대 lock hold time과 waiter 취소 시점을 측정합니다.


## 득점 포인트

- runnable 여부와 base priority만으로는 lock ownership에 따른 간접 blocker를 설명할 수 없다는 점을 H-L-M 상태로 연결합니다.
- `2ms` 임계 구역과 M의 `5ms × 3` 실행을 구분해, H의 대기가 최소 17ms 시점까지 늘어나는 중간 trace를 제시합니다.
- cycle이 없는 inversion과 cycle이 있는 deadlock을 구별하고, priority queue 정렬만으로 상한이 생기지 않는 이유를 말합니다.
- PI를 동적 완화책으로 제시하되 외부 I/O, 비선점 구간, 긴 임계 구역까지 해결한다고 과장하지 않습니다.

## 감점 포인트

- H가 가장 높은 priority이므로 blocked 상태에서도 CPU를 즉시 얻는다고 설명합니다.
- M이 X를 사용하지 않으므로 H에게 CPU를 양보해야 한다고 가정합니다.
- L이 결국 unlock한다는 사실을 deadlock 해소와 같은 의미로 부릅니다.
- PI를 켜면 지연이 0이 되거나 모든 priority 작업의 starvation이 자동으로 사라진다고 단정합니다.

## 더 파고들 거리

- PI를 켜고 끈 상태에서 H의 lock wait, L의 effective priority, M의 CPU 실행량을 어떤 시간순 로그로 비교할까요?
- 멀티코어에서 L의 실행 가능 CPU와 lock cache-line 경합까지 포함하면 단일 CPU trace의 상한 해석이 어떻게 달라질까요?
