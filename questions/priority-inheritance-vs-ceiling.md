---
id: priority-inheritance-vs-ceiling
title: >-
  PI와 priority ceiling을 함께 검토합니다. 현재 lock holder의 우선순위를 올리는 방식과 lock 접근 전에 상한을
  예약하는 방식은 어떤 전제가 다른가요?
difficulty: 중하
category: 동시성
tags:
  - priority inheritance
  - priority ceiling
  - 실시간
  - lock
related:
  - cpu-scheduling-policies
---
# PI와 priority ceiling을 함께 검토합니다. 현재 lock holder의 우선순위를 올리는 방식과 lock 접근 전에 상한을 예약하는 방식은 어떤 전제가 다른가요?

## 구두 답변

PI와 ceiling은 모두 priority 지연을 줄이지만 결정 시점과 필요한 정보가 다릅니다. PI는 실제 높은 priority waiter가 lock에서 block된 뒤 그 waiter의 priority를 현재 owner의 effective priority에 넣습니다. 반면 ceiling 계열은 자원별로 가능한 priority를 사전에 설정하고, protocol에 따라 mutex를 보유한 thread의 실행 priority를 acquisition 시 올립니다. POSIX의 `PTHREAD_PRIO_PROTECT`는 configured ceiling을 사용해 owner의 실행 priority를 높이는 규칙을 정의하지만, 이것을 모든 ceiling protocol의 접근 거부 규칙으로 확대해서는 안 됩니다. PCP나 SRP의 admission/blocking을 말하려면 그 정확한 표준이나 RTOS를 지정해야 합니다.

예를 들어 A ceiling이 8, B ceiling이 10이고 작업 H의 priority가 9라면, PI는 H가 실제로 A를 기다린 뒤 A owner를 9 수준으로 올립니다. `PTHREAD_PRIO_PROTECT`에서는 H가 waiter를 만들기 전에도 B를 보유하면 configured ceiling 10이 owner priority 계산에 관여합니다. 따라서 PI는 실제 경합과 ownership chain의 동적 bookkeeping이 핵심이고, ceiling은 자원 목록과 priority 등록의 완전성이 분석의 전제입니다. 둘 다 긴 임계 구역·외부 I/O를 없애지 않으며, Linux rt_mutex의 PI 설명이 Linux의 ceiling semantics를 의미하지도 않습니다.

따라서 질문의 “상한을 예약한다”는 표현을 protocol 이름 없이 구현 규칙으로 확정하면 안 됩니다. POSIX 보호 mutex를 선택한다면 ceiling 설정 실패, thread priority가 ceiling을 초과하는 경우, mutex 보유 중 priority가 어떻게 보이는지를 그 API의 오류와 상태로 검증합니다. PCP/SRP를 선택한다면 ceiling 계산표, 동시에 잠글 수 있는 자원 집합, admission 조건을 해당 RTOS 문서와 대조합니다. PI는 등록표가 덜 정적일 수 있지만 런타임 chain 갱신 비용을 부담합니다.


## 득점 포인트

- 실제 blocked waiter에 반응하는 PI와 자원별 configured ceiling을 acquisition 시 적용하는 `PTHREAD_PRIO_PROTECT`를 구별합니다.
- A=8, B=10, H=9 예에서 waiter가 생기기 전과 후의 결정 시점을 대비합니다.
- PCP·SRP의 admission 규칙은 별도 protocol로 명시해야 한다고 범위를 제한합니다.
- 분석 가능성과 등록·검증 비용, 긴 임계 구역의 잔여 지연을 함께 평가합니다.

## 감점 포인트

- PI와 ceiling을 단지 같은 동적 priority donation으로 설명합니다.
- 모든 ceiling protocol이 다른 시스템 상태를 보고 lock 획득을 거부한다고 일반화합니다.
- ceiling 값만 설정하면 lock order 오류와 긴 I/O가 사라진다고 말합니다.
- Linux `rt_mutex` 문서 하나로 POSIX 보호 protocol의 의미까지 증명합니다.

## 더 파고들 거리

- resource ceiling을 잘못 등록했을 때 실제 priority와 admission 오류를 어떤 trace와 assertion으로 찾을까요?
- 목표 RTOS가 `PRIO_INHERIT`, `PRIO_PROTECT`, PCP 중 무엇을 구현하는지 어떤 API·문서 조합으로 대조할까요?
