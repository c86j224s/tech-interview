---
id: cgroupv2-delegated-subtree
title: 하위 팀에 cgroup subtree를 위임할 때 상위 제한을 바꾸거나 다른 프로세스를 옮기지 못하게 하려면 무엇을 검증하나요?
difficulty: 중하
category: 운영체제
tags:
  - cgroup
  - hierarchy
  - controller
related:
  - cgroup-file-anon-memory-pressure
---
# 하위 팀에 cgroup subtree를 위임할 때 상위 제한을 바꾸거나 다른 프로세스를 옮기지 못하게 하려면 무엇을 검증하나요?

## 구두 답변
delegation은 팀이 자기 subtree의 일부 파일과 child를 관리하게 하는 권한이지, parent의 예산이나 전체 process ownership을 넘기는 일이 아닙니다. 먼저 delegated directory와 허용된 interface 파일의 owner/group, 팀 credential, cgroup namespace에서 보이는 정규화 경로를 고정합니다. 팀 credential로 자기 child의 `cpu.max`·`memory.max`를 낮추거나 workload PID를 자기 subtree의 `cgroup.procs`에 넣는 허용 테스트를 하고, 실제 parent의 `memory.max`, `cpu.max`, `cgroup.subtree_control`, `cgroup.procs`에 쓰는 거부 테스트를 각각 기록합니다.

경로 문자열 `team/../parent/memory.max`를 기준으로 보호를 확인하면 VFS 정규화와 namespace에 의존하므로 재현 가능한 경계 검증이 아닙니다. 대신 namespace에서 보이는 실제 parent 파일의 절대·정규화 경로를 열어 write 시 errno를 기록해야 합니다. 다른 팀 PID를 자기 `cgroup.procs`에 쓰는 시도도 별도로 확인합니다. child에 parent hard limit보다 큰 값을 쓰는 일이 파일상 허용되더라도 ancestor 예산을 완화하지 못하므로 “상위 제한 우회”가 성공한 것으로 판정하지 않습니다.

또한 parent의 `memory.min`·`memory.low`, pressure, controller 활성화와 cleanup 책임은 자동 위임되지 않습니다. `cgroup.events`의 `populated=0`은 process가 빠졌다는 신호일 뿐 volume·network·외부 리소스 정리가 끝났다는 증거가 아닙니다. 실제 systemd·container manager가 설치한 소유권과 namespace 정책은 호스트마다 달라 이 환경에서는 위 테스트를 실행하지 않았습니다. 문서 모델과 실제 errno·파일 변화를 함께 보아야 합니다.

## 득점 포인트
- 허용 child 조작과 금지 parent·PID 조작을 서로 다른 negative test로 설계합니다.
- 실제 상위 cgroup 경로와 errno를 확인해 경로 오류와 권한 거절을 구분합니다.
- 파일 소유권, credential, namespace, ancestor 예산을 하나의 격리 보증으로 과장하지 않습니다.

## 감점 포인트
- subtree 디렉터리 mode만 바꾸면 다른 PID와 parent 정책까지 자동 격리된다고 말하면 안 됩니다.
- child에 더 큰 limit을 쓰면 parent quota가 증가한다고 해석하면 계층 예산을 거꾸로 읽습니다.
- `populated=0`을 애플리케이션·volume cleanup 완료로 판정하면 관측 범위를 넘습니다.

## 더 파고들 거리
- cgroup namespace가 parent 경로를 어떻게 보이게 하는지와 VFS 권한 검사를 함께 재현합니다.
- 위임 종료 때 process 이동, child 삭제, 외부 리소스 cleanup을 어떤 순서와 감사 로그로 묶을지 정합니다.
