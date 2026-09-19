---
id: capabilities-lsm-seccomp-diagnosis
title: 일반 파일은 열리지만 raw socket은 EPERM입니다. capability와 DAC·LSM·seccomp를 어떤 증거로 구분하겠습니까?
difficulty: 중하
category: 보안
tags:
  - capability
  - execve
  - least privilege
related:
  - authentication-vs-authorization
---
# 일반 파일은 열리지만 raw socket은 EPERM입니다. capability와 DAC·LSM·seccomp를 어떤 증거로 구분하겠습니까?

## 구두 답변

일반 파일 `open` 성공과 raw socket `EPERM`만으로 `CAP_NET_RAW` 부족을 확정하지 않습니다. 파일 open은 DAC·ACL·파일 관련 capability와 LSM의 결과이고, raw socket은 capability 검사에 더해 seccomp가 `socket`을 먼저 `ERRNO(EPERM)`으로 만들거나 LSM·namespace·device 정책에서 거부될 수 있습니다. 먼저 syscall이 실행됐는지, 실행됐다면 어느 인가 단계에서 거부됐는지를 나눕니다. 설명용 trace에서 같은 TID가 `openat`은 성공하고 `socket(AF_INET,SOCK_RAW,...)`은 -1 EPERM을 반환한다고 하겠습니다. 먼저 `/proc/<pid>/task/<tid>/status`의 `CapEff`에 NET_RAW가 있는지와 P/B에 재획득 경로가 있는지 확인합니다. 동시에 seccomp log/trace가 `ERRNO(EPERM)`을 반환했는지 확인합니다. seccomp에서 ALLOW이고 syscall 실행 흔적이 있다면 capability, LSM audit, target network namespace를 비교합니다. 일반 파일의 mode와 inode를 raw socket에 그대로 적용하지 않으며, `strace` 한 줄은 거부 주체를 알려 주지 않습니다. 진단은 무작정 `CAP_SYS_ADMIN`을 추가하지 않고, 별도 환경에서 최소 NET_RAW만 추가한 대조, filter를 관찰 action으로 바꾼 대조, LSM audit를 각각 수집하는 방식으로 합니다. 이 절차는 실제 실행 성공 결과가 아니라 증거 수집 설계입니다. 최종 판단은 syscall 실행 여부, Cap* 상태, seccomp action, LSM record, namespace를 시간순으로 묶어야 하며 open 성공은 raw socket 가능성의 증거가 아닙니다.

## 득점 포인트

- EPERM 하나를 capability·seccomp·LSM의 단일 원인으로 단정하지 않고 syscall 실행 여부부터 확인합니다.
- CapEff/Prm/Bnd, seccomp action, LSM audit, network namespace를 같은 TID 기준으로 대조합니다.
- 진단용 권한 확대를 CAP_SYS_ADMIN으로 뭉뚱그리지 않고 최소 대조로 설계합니다.

## 감점 포인트

- 일반 파일 open 성공이 raw socket 권한을 증명한다고 말합니다.
- strace의 EPERM만으로 capability 부족을 확정합니다.
- seccomp가 syscall 전에 반환한 EPERM과 커널 raw-socket 검사의 EPERM을 같은 단계로 취급합니다.

## 더 파고들 거리

- seccomp가 ALLOW인데 LSM audit만 거부를 기록할 때 다음에 확인할 namespace·driver 조건을 말해 보세요.
- CapEff에는 NET_RAW가 있지만 CapBnd에서 빠진 상태를 execve 재획득 관점에서 설명해 보세요.
