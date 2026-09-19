---
id: cgroupv2-internal-process-rule
title: >-
  cgroup v2에서 상위 cgroup에 프로세스가 남아 있을 때 subtree controller가 활성화되지 않습니다. 어떤 규칙을
  확인하나요?
difficulty: 중하
category: 운영체제
tags:
  - cgroup
  - hierarchy
  - controller
related:
  - cgroup-file-anon-memory-pressure
---
# cgroup v2에서 상위 cgroup에 프로세스가 남아 있을 때 subtree controller가 활성화되지 않습니다. 어떤 규칙을 확인하나요?

## 구두 답변
먼저 대상이 일반 domain cgroup인지 threaded subtree인지, 그리고 controller가 부모의 `cgroup.controllers`에 실제로 가용한지 확인합니다. 일반 domain에서 부모가 직접 프로세스를 보유한 상태로 자식 subtree에 같은 resource domain controller를 분배하려 하면 no internal process 규칙 때문에 `cgroup.subtree_control`에 `+cpu` 또는 `+memory`를 쓰는 작업이 거절될 수 있습니다. 점검 순서는 `cgroup.type`, 부모 `cgroup.procs`, `cgroup.controllers`, `cgroup.subtree_control`을 함께 읽는 것입니다. 디렉터리 생성만으로 controller가 켜지거나 child 제한 파일이 생기지는 않습니다.

예를 들어 `parent/cgroup.controllers`가 `cpu memory`, `subtree_control`이 비어 있고 `parent/cgroup.procs`에 manager PID 321이 남아 있다고 하겠습니다. 일반 domain이라면 먼저 그 PID를 정책상 leaf child로 옮길 수 있는지 확인하고, 부모에서 controller를 활성화한 뒤 child의 `cpu.max`·`memory.max`를 설정합니다. 다만 controller가 다른 hierarchy에 붙어 있거나 커널이 지원하지 않으면 PID를 옮겨도 파일이 생기지 않습니다. root cgroup은 기준점으로서 예외적 동작을 보일 수 있어 “프로세스 하나라도 있으면 항상 실패”라고 일반화하지 않습니다.

threaded mode에서는 `cgroup.threads`와 지원되는 threaded controller의 규칙이 별도입니다. 따라서 오류 코드만 보고 no internal process라고 결론내리지 말고, write 전후 파일과 errno를 기록해 활성화 실패·비가용·모드 전이 실패를 구분합니다. 해결이 필요한 운영에서는 프로세스 이동 권한과 controller 활성화 권한도 따로 검토해야 합니다. 이 답변의 PID와 파일 상태는 설명용이며 특정 커널에서 실행한 결과가 아닙니다.

## 득점 포인트
- 가용 controller, 부모의 `subtree_control`, 프로세스 배치를 세 개의 상태로 확인합니다.
- 일반 domain, root 기준점, threaded subtree의 적용 범위를 구별합니다.
- 디렉터리 생성과 controller 활성화, PID 이동의 순서를 실제 파일 관찰로 연결합니다.

## 감점 포인트
- parent에 PID가 있으면 어떤 파일도 절대 쓸 수 없다고 말하면 예외와 controller별 조건을 놓칩니다.
- v1처럼 controller마다 독립 hierarchy를 만든다고 가정하면 v2의 unified 모델을 잘못 적용합니다.
- `memory.max`가 보인다는 사실만으로 제한이 켜졌다고 말하면 `subtree_control` 상태를 누락합니다.

## 더 파고들 거리
- controller 비가용과 no internal process 거절을 `cgroup.controllers`, `cgroup.type`, errno 조합으로 구분합니다.
- threaded subtree에서 thread 이동과 process 이동이 어떤 권한·관측 차이를 갖는지 확인합니다.
