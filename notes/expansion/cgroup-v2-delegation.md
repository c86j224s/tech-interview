---
id: cgroup-v2-delegation
title: cgroup v2 계층 위임과 controller 경계
topic: 운영체제
summary: >-
  cgroup v2의 단일 계층·subtree controller·no internal process 규칙과 delegation의 소유권을
  자원 제한·관측 관점에서 설명합니다.
questionIds: []
prerequisites:
  - memory-accounting
  - resource-budget
related: []
reviewedAt: '2026-09-19'
---
# cgroup v2 계층 위임과 controller 경계

cgroup v2를 “프로세스를 디렉터리에 넣으면 그 디렉터리의 제한을 받는 기능”으로만 이해하면 controller가 켜지지 않는 이유와 위임 후의 권한 경계를 놓친다. unified hierarchy에서는 cgroup 계층과 controller 활성화가 별도 상태다. 부모가 `cgroup.subtree_control`에서 `+cpu`나 `+memory`를 켜야 자식에서 관련 인터페이스를 볼 수 있고, 일반 domain cgroup은 내부 프로세스와 자식에 대한 자원 분배를 동시에 수행하지 않도록 no internal process 규칙을 따른다. 위임은 하위 디렉터리의 일부 파일을 다루게 하는 일이지, 상위 예산·프로세스 소유권·커널의 전체 정책을 넘기는 일이 아니다.

## Unified hierarchy와 cgroup 객체

v2에서는 controller마다 따로 hierarchy를 만드는 v1식 모델 대신 하나의 계층에서 cgroup을 구성한다. `/sys/fs/cgroup/team-a/service-1` 같은 디렉터리는 cgroup 객체와 파일 인터페이스를 나타내지만, 생성 즉시 `cpu.max`가 제한되는 것은 아니다. 현재 부모의 `cgroup.controllers`는 그 부모가 하위에 제공할 수 있는 controller 목록이고, `cgroup.subtree_control`은 실제로 자식들에 분배하도록 활성화한 목록이다.

예를 들어 부모에서 다음을 수행한다고 하자.

```text
$ cat parent/cgroup.controllers
cpu memory
$ cat parent/cgroup.subtree_control
memory
$ cat parent/child/cpu.max
cat: No such file or directory
$ echo +cpu > parent/cgroup.subtree_control
$ cat parent/child/cpu.max
max 100000
```

위 출력은 설명용 상태 추적이다. 두 번째 `cpu.max`가 보인다는 것은 CPU 제한 파일의 인터페이스가 노출됐다는 뜻이지 child가 자동으로 특정 quota를 받았다는 뜻은 아니다. `cpu.max`의 `MAX PERIOD`에서 `200000 100000`은 fair-class 스케줄링 기준으로 한 주기 100ms 중 최대 200ms의 CPU 시간을 허용하는 상한, 즉 대략 두 CPU에 해당하는 예시다. 실제 처리량은 runnable 경쟁, 상위 quota, burst, 다른 controller 영향을 함께 받는다.

## Subtree controller 활성화

controller 가용성은 커널이 지원하고 다른 hierarchy에 붙지 않았는지에 좌우된다. 가용 목록에 있어도 기본으로 모두 켜지지 않는다. 부모의 `cgroup.subtree_control`에 `+cpu +memory`를 쓰면 자식이 해당 자원을 제어할 수 있고, 여러 변경은 함께 성공하거나 실패하는 계약을 따른다. 부모가 자원을 사용하는 내부 프로세스를 그대로 둔 채 domain controller를 자식에 내려보내려 하면 no internal process 제약에 걸릴 수 있다.

이 제약의 핵심은 “부모 프로세스가 있으면 어떤 파일도 못 쓴다”가 아니다. 일반 domain cgroup에서 부모가 직접 자원을 소비하면서 동일한 controller를 자식 사이에 분배하는 모호한 상태를 피하는 규칙이다. root cgroup은 예외적으로 프로세스와 domain child의 기준점 역할을 할 수 있다. threaded subtree는 다른 모드이며, 지원되는 threaded controller와 `cgroup.type` 전이를 별도로 검토해야 한다.

## No internal process 규칙

일반적인 구성은 manager가 프로세스를 부모에서 빼고, 그 다음 부모의 `subtree_control`을 조정하고, 마지막으로 프로세스를 leaf child로 이동하는 순서다. 이미 `parent/cgroup.procs`에 PID가 남아 있는 상태에서 `+memory`가 거절된다면, 먼저 PID의 위치와 자식의 populated 상태를 읽는다. 단순히 디렉터리를 만들거나 child에 PID를 옮기는 것만으로 parent의 controller 활성화가 자동으로 되지 않는다.

프로세스 이동은 `cgroup.procs`에 PID를 쓰는 작업이며, 파일을 쓸 수 있는 주체와 대상 cgroup의 계층 관계를 확인해야 한다. process가 child로 이동한 뒤에도 thread 단위 분배가 필요한 애플리케이션은 `cgroup.threads`와 threaded mode의 적용 범위를 따로 봐야 한다. domain controller를 threaded cgroup 안에서 같은 방식으로 쓰는 것은 실패하거나 의미가 다르다.

```diagram
{"title":"controller 활성화와 프로세스 배치","caption":"부모의 controller 제공과 프로세스 이동은 다른 단계이며, 일반 domain에서는 내부 프로세스 규칙이 두 단계를 제약합니다.","rows":[[{"id":"available","label":"cgroup.controllers","detail":["커널이 제공하는 목록"]}],[{"id":"enable","label":"subtree_control","detail":["부모가 child용으로 활성화"]}],[{"id":"place","label":"cgroup.procs","detail":["프로세스를 leaf로 이동"]}],[{"id":"observe","label":"resource files","detail":["cpu·memory·events"]}]],"edges":[{"from":"available","to":"enable","label":"가용성 확인"},{"from":"enable","to":"place","label":"계층 정책"},{"from":"place","to":"observe","label":"사용량·압력 관측"}]}
```

## CPU 계층 quota와 예산

부모 `cpu.max=200000 100000`이고 child-a와 child-b가 각각 `200000 100000`이라면 자식 limit 합은 4 CPU처럼 보인다. 그러나 둘의 실행은 parent의 2 CPU 상한 아래에서 경쟁한다. 동시에 두 서비스가 CPU를 포화시키면 100ms window마다 parent가 허용하는 총량이 먼저 소진되고, child의 quota가 남아도 parent 계층에서 throttling이 발생할 수 있다. child limit은 “이 child가 단독으로 더 많이 쓰지 못하는 상한”이지 parent가 제공하는 총량을 증액하는 약속이 아니다.

진단에서는 `cpu.stat`의 `nr_periods`, `nr_throttled`, `throttled_usec`를 parent와 child에서 함께 본다. parent만 throttled이면 하위 합이 상위 예산을 밀어붙이는 구조일 가능성이 있고, 한 child만 반복되면 child 자체 limit·weight·runnable 패턴을 의심한다. quota를 2 CPU라고 읽고 요청 처리량을 정확히 초당 두 배로 환산해서는 안 된다. 주기 경계, lock 대기, IO, scheduler 경쟁이 실제 throughput을 바꾼다.

## Memory high·max와 이벤트

`memory.high`는 usage가 경계를 넘을 때 heavy reclaim pressure와 throttling을 유도하지만 OOM killer를 직접 호출하는 hard limit이 아니다. `memory.max`는 회수로 사용량을 낮출 수 없을 때 OOM 경로를 유발하는 상한이다. high를 넘었다고 곧바로 `OOMKilled`가 되는 것은 아니며, max에 도달하지 않아도 reclaim 지연으로 작업이 느려질 수 있다.

`memory.current`는 특정 시점의 사용량이고 사건의 원인을 알려주지 않는다. `memory.events`의 `high`, `max`, `oom`, `oom_kill`을 시간에 따라 읽고, `memory.pressure`의 stall과 file/anon 구성을 함께 본다. 예를 들어 current=900MiB, high=800MiB, max=1GiB이고 events의 high만 증가한다면 reclaim 압력과 지연은 설명되지만 kill을 확정할 수 없다. max와 oom_kill 증가가 있으면 hard limit 경로를 더 강하게 의심하되 프로세스 수준 종료 원인과 kernel log도 대조한다.

## Delegation과 파일 소유권

하위 팀에 subtree를 위임할 때는 관리자가 디렉터리와 허용된 interface 파일의 소유권·쓰기 권한을 설정하고, 팀이 자기 child를 만들고 자기 workload를 이동할 수 있는지 시험한다. 동시에 팀이 parent의 `memory.max`, `cpu.max`, `cgroup.subtree_control`을 바꾸지 못하는지 확인한다. 파일 mode만 보고 안전하다고 판단하지 말고 cgroup namespace, process credential, ancestor 권한, controller별 migration 규칙을 함께 검증해야 한다.

위임받은 프로세스가 다른 팀의 PID를 `cgroup.procs`에 쓸 수 있다면 resource ownership이 깨진다. 반대로 팀이 자기 프로세스를 더 제한하는 것은 허용하되, parent가 정한 `memory.max`보다 큰 값을 child에 써도 실효 예산은 늘지 않는다. 상위 `memory.min`·`memory.low` 보호, parent pressure, root 정책도 하위에서 제거할 수 없는 잔여 조건이다. cleanup을 위해 `cgroup.events`의 `populated=0`을 관찰할 수 있지만, 그것이 외부 볼륨이나 애플리케이션 상태 정리를 대신하지는 않는다.

## 관측·실패 복구·검증

운영 점검은 `cgroup.type`, `cgroup.controllers`, `cgroup.subtree_control`, `cgroup.procs`, `cgroup.events`를 한 시점의 상태 묶음으로 저장하는 데서 시작한다. 이어 parent와 child의 `cpu.max`·`cpu.stat`, `memory.current`·`memory.events`·pressure를 같은 시간창으로 비교한다. controller 파일이 없으면 enable 실패인지 controller 비가용인지부터 구분하고, limit 파일이 있어도 실제 제한은 ancestor와 scheduler 조건을 포함해 판정한다.

이 문서에서 실제 cgroup을 생성하거나 부하를 실행하지 않았다. 따라서 위 숫자는 설명용 계산이며 kernel build, mount option, system manager, workload에 따라 관찰값이 달라질 수 있다. 특히 threaded subtree는 일반 domain의 no internal process 설명을 그대로 적용하지 않는다. 위임 설계는 “파일을 쓸 수 있는가”, “어떤 프로세스를 옮길 수 있는가”, “상위 예산을 바꿀 수 있는가”를 각각 negative test로 검증해야 한다.

## 참고자료와 범위

참고자료: https://raw.githubusercontent.com/torvalds/linux/master/Documentation/admin-guide/cgroup-v2.rst (master, kernel release 미고정, 2026-09-19 본문 확인). 문서는 unified hierarchy, controller availability와 `subtree_control`, domain/threaded 모드, memory high/max, CPU quota, `cgroup.events`를 설명한다. systemd·container runtime·Kubernetes가 만드는 경로와 권한은 배포판 및 버전에 따라 다르므로 이 노트는 해당 도구의 설정을 자동으로 보증하지 않는다. 상위 cgroup 정책이 하위 delegator의 선택보다 우선한다는 결론은 계층 자원 모델에 근거하지만, 실제 운영 수치는 반드시 해당 호스트에서 읽고 기록해야 한다.
