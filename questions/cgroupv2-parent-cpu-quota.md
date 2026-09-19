---
id: cgroupv2-parent-cpu-quota
title: 상위 cgroup CPU quota는 2코어인데 두 하위 서비스 limit 합은 4코어입니다. 처리량 예측이 틀리는 이유는 무엇인가요?
difficulty: 중하
category: 운영체제
tags:
  - cgroup
  - hierarchy
  - controller
related:
  - cgroup-file-anon-memory-pressure
---
# 상위 cgroup CPU quota는 2코어인데 두 하위 서비스 limit 합은 4코어입니다. 처리량 예측이 틀리는 이유는 무엇인가요?

## 구두 답변
`cpu.max=200000 100000`은 parent 전체가 100ms period 동안 최대 200ms의 CPU 시간을 쓰는 상한으로 읽을 수 있어 대략 2 CPU 예시가 됩니다. child-a와 child-b에 각각 `200000 100000`을 써도 합계 4 CPU가 parent에 새 예산을 만들어 주지 않습니다. 두 서비스가 동시에 runnable이면 parent가 허용한 200ms를 놓고 경쟁하고, parent quota가 먼저 소진되면 child의 개별 quota가 남아 있어도 parent 계층에서 throttling됩니다. child limit은 각 child의 단독 상한이지 예약된 몫이 아닙니다.

한 period에서 a가 120ms, b가 80ms를 사용하면 parent budget이 끝납니다. a와 b 모두 개별 limit 아래에 있었더라도 다음 period까지 더 실행할 수 없습니다. 반대로 a만 runnable이면 parent의 2 CPU 예산을 거의 사용할 수 있지만, IO 대기·lock·scheduler 경쟁으로 작업 처리량이 정확히 2배가 되지는 않습니다. `cpu.stat`의 `nr_periods`, `nr_throttled`, `throttled_usec`를 parent와 각 child에서 같은 시간창에 읽어 parent 막힘과 child 자체 quota 막힘을 구별해야 합니다.

따라서 예측은 limit 합이 아니라 실제 CPU-bound 비율, runnable 수, `cpu.weight`, quota period, burst와 tail latency를 포함해야 합니다. parent를 그대로 둔 채 child limit만 4 CPU로 올리는 변경은 상한을 늘리지 않으며, parent throttling이 사라졌다는 증거도 아닙니다. 실제 kernel 통계는 workload를 실행해 검증해야 하고, 여기의 시간 배분은 설명용 계산입니다.

## 득점 포인트
- `MAX PERIOD`를 시간 예산으로 환산하고 parent 총량을 먼저 적용합니다.
- child quota 합을 예약·보장량으로 읽지 않고 parent와 경쟁하는 상한으로 설명합니다.
- parent·child `cpu.stat`를 함께 비교해 throttling의 계층을 판정합니다.

## 감점 포인트
- 두 child limit 합이 4 CPU이므로 처리량도 4 CPU라고 말하면 계층 상한을 무시합니다.
- quota를 CPU 사용률 숫자로만 말하고 period당 허용시간을 계산하지 않으면 중간 상태가 없습니다.
- latency 증가만 보고 quota throttling을 확정하면 IO·lock·scheduler 원인을 배제하지 못합니다.

## 더 파고들 거리
- `cpu.weight` 분배와 `cpu.max` hard cap을 동일 workload에서 각각 바꿔 관찰합니다.
- period와 burst가 짧은 작업의 tail latency를 어떻게 바꾸는지 `cpu.stat`와 요청 지연을 함께 기록합니다.
