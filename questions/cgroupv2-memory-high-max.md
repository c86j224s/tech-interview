---
id: cgroupv2-memory-high-max
title: >-
  memory.high를 넘었지만 아직 OOMKilled가 아닙니다. memory.high·memory.max·memory.events를
  어떻게 해석하나요?
difficulty: 중하
category: 운영체제
tags:
  - cgroup
  - hierarchy
  - controller
related:
  - cgroup-file-anon-memory-pressure
---
# memory.high를 넘었지만 아직 OOMKilled가 아닙니다. memory.high·memory.max·memory.events를 어떻게 해석하나요?

## 구두 답변
`memory.high`는 초과 즉시 kill하는 선이 아니라 reclaim pressure와 throttling을 유도하는 조절선이고, `memory.max`는 회수로 줄이지 못할 때 cgroup OOM 경로를 일으킬 수 있는 hard limit입니다. 따라서 `memory.current=900MiB`, `memory.high=800MiB`, `memory.max=1GiB`인 상태에서 작업이 느려지고 `memory.events`의 `high`만 증가하며 `oom_kill=0`인 것은 모순이 아닙니다. file cache가 회수되어 current가 내려갈 수도 있고, anonymous memory 비중이 높으면 reclaim stall이 지속될 수 있습니다.

진단은 한 번의 current 읽기로 끝내지 않습니다. 이전 샘플과 현재의 `memory.events`에서 `high`, `max`, `oom`, `oom_kill` counter 증가를 비교하고, `memory.pressure`의 some/full stall과 file/anon 구성을 같은 시간창으로 봅니다. high만 증가하면 high 경계의 압력과 지연을 우선 설명하고, max·oom·oom_kill이 함께 증가하면 hard limit 경로와 실제 종료 task, kernel log를 대조합니다. `memory.max`를 넘는 순간의 reclaim·allocation 타이밍과 반환 오류 때문에 사용량 숫자만으로 kill 원인을 단정하지도 않습니다.

운영 선택으로는 high를 사전 압력 신호와 latency 보호선으로, max를 장애 격리용 hard 경계로 사용하고 events counter를 주기적으로 수집합니다. file/anonymous 구분은 기존 pressure 진단과 겹치지만 이 질문의 핵심은 high/max가 서로 다른 정책 사건이라는 점과 `events`가 누적 사건을 보여 준다는 점입니다. 실제 부하와 kernel 버전을 여기서 실행하지 않았으므로 900MiB 예는 계약을 설명하는 계산입니다.

## 득점 포인트
- high의 reclaim·throttle 성격과 max의 OOM 경로를 수치 상태로 분리합니다.
- current, events counter, pressure, file/anon을 시간축으로 함께 관찰합니다.
- high 초과와 OOMKilled 부재가 양립하는 구체적인 결과를 설명합니다.

## 감점 포인트
- high를 넘는 순간 항상 OOMKilled 된다고 말하면 조절선과 hard limit을 합칩니다.
- current 하나로 reclaim 실패, OOM 원인, 종료 task를 모두 확정하면 관측 범위를 넘습니다.
- events 값을 현재 사용량처럼 읽으면 누적 사건과 순간 상태를 혼동합니다.

## 더 파고들 거리
- `memory.low`·`memory.min` 보호와 ancestor max가 충돌할 때 계층별 reclaim·보호를 비교합니다.
- `memory.events`의 cgroup-local 값과 subtree 집계, pressure mount 조건을 실제 호스트에서 구분합니다.
