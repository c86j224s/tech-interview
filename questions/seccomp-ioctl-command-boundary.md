---
id: seccomp-ioctl-command-boundary
title: syscall 번호만 검사하는 seccomp filter에서 ioctl을 허용하면 어떤 세부 효과가 남나요?
difficulty: 중하
category: 보안
tags:
  - seccomp
  - syscall
  - sandbox
related:
  - agent-sandbox-isolation
---
# syscall 번호만 검사하는 seccomp filter에서 ioctl을 허용하면 어떤 세부 효과가 남나요?

## 구두 답변

`ioctl`을 syscall 번호만으로 허용하면 그 번호 아래의 request command, fd가 가리키는 실제 장치, 포인터 구조체가 만드는 효과가 모두 남습니다. seccomp BPF는 레지스터에 전달된 fd와 request의 일부를 비교할 수 있어도 pointer가 가리키는 구조체를 직접 역참조하지 못합니다. 따라서 “안전한 tty command만 허용” 같은 정책은 번호-only allowlist로 표현할 수 없습니다. 설명용으로 `ioctl(fd1, REQUEST_A, ptr)`와 `ioctl(fd2, REQUEST_B, ptr)`가 같은 syscall 번호를 가진다고 하겠습니다. 번호-only filter는 둘 다 ALLOW하지만 fd1이 일반 파일이고 fd2가 device라면 kernel의 file operation과 driver가 처리하는 명령은 전혀 다릅니다. REQUEST_B가 장치 상태 변경, 메모리 매핑 또는 다른 kernel surface를 열 수 있는지는 driver 계약과 capability·LSM·device cgroup에 달립니다. 이 예는 특정 장치에서 실행한 결과가 아니라 같은 진입점의 다의성을 보이는 구조적 상태입니다. 진단은 architecture, fd 획득 경로와 inode/device, request 값, 반환 errno, seccomp action, capability와 LSM/device audit를 같이 수집합니다. `CAP_SYS_ADMIN`이나 `CAP_SYS_RAWIO`가 있다고 모든 ioctl이 안전해지는 것도 아니며 seccomp ALLOW가 driver 인가를 우회하지도 않습니다. 선택지는 command·fd 유형을 좁히는 filter, 사전에 열린 안전한 descriptor만 전달하는 helper, 장치 전용 broker입니다. 검증에는 정상 read command, 상태 변경 command, 잘못된 fd, 다른 namespace fd, 포인터 구조체 경계 오류를 넣고 syscall 진입 가능성과 장치 효과를 분리합니다. 실제 driver 동작은 target kernel과 device로 재검증해야 하며, 번호-only 성공은 “ioctl 진입점에 도달했다”는 증거로만 기록하겠습니다.

## 득점 포인트

- ioctl 번호와 request·fd·pointer 구조체가 만드는 driver 효과를 분리합니다.
- seccomp 인자 검사 한계와 capability·LSM·device cgroup의 후속 인가를 연결합니다.
- 번호-only ALLOW를 device 효과의 안전성 증거로 과장하지 않고 helper/descriptor 대안을 제시합니다.

## 감점 포인트

- ioctl syscall 번호가 같으므로 모든 command 효과도 같다고 말합니다.
- pointer 구조체를 seccomp BPF가 안전하게 읽어 path/command 전체를 검증한다고 설명합니다.
- CAP_SYS_RAWIO만 추가하면 장치 동작의 모든 위험이 없어졌다고 단정합니다.

## 더 파고들 거리

- 같은 request라도 fd가 다른 device일 때 어떤 inode·driver 증거를 먼저 수집하겠습니까?
- ioctl을 helper로 분리할 때 helper의 capability와 fd 전달 범위를 어떻게 최소화하겠습니까?
