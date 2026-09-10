---
id: process-state-suspended
title: "프로세스가 실행되지 않는데 하나는 Ready, 다른 하나는 Blocked 상태입니다. 각각 무엇을 기다리며 CPU를 더 배정하면 둘 다 바로 실행할 수 있나요?"
answerMinutes: 5
followups: [{"id":"profiling-cpu-offcpu","prompt":"Ready 큐 대기와 DB·락 대기를 off-CPU 프로파일에서 어떤 신호로 나누어 볼까요?"},{"id":"context-switch-overhead","prompt":"Blocked가 많은 시스템에서 컨텍스트 스위치 증가가 정상 I/O인지 경쟁인지 어떻게 검증할까요?"},{"id":"graceful-shutdown","prompt":"종료 신호가 왔을 때 Ready·Blocked 작업을 새 유입 차단과 기존 작업 정리 순서에 어떻게 반영할까요?"}]
difficulty: 하
category: 운영체제
tags: ["프로세스 상태","스케줄러","대기"]
related: ["profiling-cpu-offcpu"]
---

# 프로세스가 실행되지 않는데 하나는 Ready, 다른 하나는 Blocked 상태입니다. 각각 무엇을 기다리며 CPU를 더 배정하면 둘 다 바로 실행할 수 있나요?

## 구두 답변

Ready와 Blocked는 모두 현재 Running이 아니지만 기다리는 대상이 다릅니다. Ready는 CPU만 배정되면 실행할 수 있는 상태이고, Blocked는 I/O 완료, 락 획득, 조건 충족처럼 특정 사건이 일어나야 다음 명령으로 진행할 수 있는 상태입니다. 따라서 Ready 프로세스에 CPU를 더 주면 실행 기회가 늘지만, Blocked 프로세스에는 기다리는 사건을 처리할 장치나 다른 작업의 신호가 필요합니다. 상태 이름보다 진행 조건을 보는 것이 핵심입니다.

### Suspended를 같은 대기로 보지 않습니다
교과서에서 Suspended는 장기·중기 스케줄러가 프로세스를 실행 집합에서 잠시 제외하거나 메모리 밖으로 옮긴 상태를 뜻할 수 있습니다. I/O를 기다리는 Blocked와 결합해 Blocked-Suspended처럼 표현하기도 하지만 실제 OS 도구의 상태 표시는 다릅니다. 프로세스가 CPU를 쓰지 않는다는 한 사실만으로 Ready·Blocked·Suspended를 구분할 수 없으므로, run queue에 있는지, 어떤 wait channel인지, 페이지가 resident인지와 같은 관찰값을 확인하겠습니다.

I/O 완료 인터럽트가 도착하면 Blocked 프로세스는 즉시 Running이 되는 것이 아니라 대개 Ready 큐로 이동해 CPU 배정을 기다립니다. 같은 시점에 다른 작업이 실행 중일 수 있기 때문입니다. 커널의 중단 불가 대기처럼 신호가 와도 즉시 빠져나오지 못하는 경로가 있고, 락 대기는 소유자 실행과 경쟁합니다. 그래서 CPU를 늘리기 전에 Ready 큐 지연이면 CPU·스케줄러를, DB·디스크·락 대기면 해당 자원과 보유 시간을 봅니다.

상태는 프로세스 전체가 아니라 스레드별로 달라질 수 있습니다. 한 프로세스 안에서 스레드 하나는 Ready이고 다른 하나는 DB I/O Blocked인데 도구가 프로세스를 sleeping으로 요약할 수 있습니다. 또한 Linux의 sleep·uninterruptible sleep·stopped 같은 표시는 교과서의 Suspended와 일대일 대응하지 않습니다. 프로세스 요약만 보고 CPU를 증설하지 않고 스레드별 wait reason과 최근 상태 전이를 확인하겠습니다.

Ready 큐 대기가 200ms라면 코어 배치·우선순위·run queue를 보고 CPU 용량을 검토하지만, Blocked가 200ms라면 DB·디스크·락의 처리율과 보유 시간을 봅니다. Suspended가 메모리 압력으로 발생했다면 다시 Ready가 된 뒤 page-in 때문에 늦을 수 있습니다. 진단은 현재 상태의 개수보다 상태별 체류 시간, 전이 원인, 종료 시 남은 작업과 복구 계약을 기록하는 방식으로 진행하겠습니다.

예를 들어 Ready 스레드가 100개여도 다른 스레드들이 실제로 한 코어의 affinity에 몰리면 나머지 코어는 놀 수 있습니다. Blocked 스레드가 100개라면 그 수보다 어떤 DB·락·I/O 사건을 기다리는지가 중요합니다. 상태별 체류 시간을 원인별로 집계해야 증설과 병목 완화를 올바르게 선택할 수 있습니다.

Ready·Blocked는 프로세스가 아니라 스레드별 상태일 수 있습니다. 한 프로세스의 스레드 하나가 Ready이고 다른 하나가 DB Blocked라면 프로세스 요약만으로 자원 병목을 판단할 수 없습니다. 상태별 체류 시간과 wait reason을 기록하고, Ready 큐가 200ms인 경우에는 affinity·우선순위를, Blocked가 200ms인 경우에는 DB·디스크·락의 처리율을 확인하겠습니다.

## 득점 포인트

- Ready의 CPU 대기와 Blocked의 사건 대기를 명확히 구분한다.
- Suspended의 논리 모델과 실제 OS 상태 표시를 나눈다.
- 상태별 대기 원인에 맞는 지표와 자원 대응을 제시한다.

## 감점 포인트

- CPU를 추가하면 모든 Blocked 작업이 바로 진행된다고 말한다.
- CPU를 쓰지 않는 프로세스는 모두 같은 상태라고 단정한다.
- 교과서 상태 이름을 OS 도구의 상태와 동일시한다.

## 더 파고들 거리

- I/O 완료 후 Ready 큐에서 오래 기다리는 이유는 무엇인가요?
- 중단 불가 대기가 종료 요청을 지연시키는 조건은 무엇인가요?
- 실행 큐 지연·락 대기·I/O 대기를 trace로 어떻게 분리하나요?
