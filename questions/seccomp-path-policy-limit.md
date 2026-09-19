---
id: seccomp-path-policy-limit
title: >-
  openat은 필요하지만 mount와 ptrace는 금지해야 합니다. seccomp가 제한할 수 있는 범위와 파일 경로 정책의 한계를
  설명하세요.
difficulty: 중하
category: 보안
tags:
  - seccomp
  - syscall
  - sandbox
related:
  - agent-sandbox-isolation
---
# openat은 필요하지만 mount와 ptrace는 금지해야 합니다. seccomp가 제한할 수 있는 범위와 파일 경로 정책의 한계를 설명하세요.

## 구두 답변

seccomp filter는 syscall 번호와 `seccomp_data`의 고정 인자를 이용해 `mount`와 `ptrace`를 `ERRNO` 또는 kill action으로 막고 `openat`을 통과시키는 정책을 만들 수 있습니다. 하지만 `openat=ALLOW`는 특정 경로만 허용한다는 뜻이 아닙니다. BPF는 사용자 포인터가 가리키는 문자열을 역참조하지 않으므로 `/safe` 아래만이라는 의미를 syscall 번호 하나로 증명할 수 없습니다. 설명용 순서는 `arch 확인 → mount/ptrace 거부 → openat의 dirfd·flags 일부 검사 → 다른 계층의 파일 정책`입니다. mount capability가 있어도 seccomp `ERRNO(EPERM)`이면 syscall은 실행되지 않습니다. ptrace를 kill action으로 두면 오류 반환 대신 signal/종료 경로가 됩니다. openat이 통과한 뒤에는 symlink, mount 재배치, proc·device fd, 이미 열린 fd, 별도 `openat2` 호출이 남습니다. 따라서 경로 정책은 LSM/Landlock, 사전 열린 안전한 dirfd, fd 전달 설계나 supervisor와 조합해야 합니다. `ioctl`, `socket`, `connect`도 한 번호 아래 command·fd·목적지가 많아 번호-only allowlist가 전체 의미를 제한하지 못합니다. 검증은 정상 파일과 심볼릭 링크, 이미 열린 fd, 금지 mount·ptrace, 다른 arch metadata를 각각 비교하고 seccomp action·errno/signal·실제 syscall 실행 여부와 파일 접근 결과를 분리해 기록합니다. 이 trace는 실제 filter 실행이 아닌 정책 설계 예입니다. 운영 allowlist는 loader·thread·로그 syscall을 관찰한 뒤 좁히며, namespace와 capability가 seccomp를 대신한다고도 말하지 않습니다.

## 득점 포인트

- seccomp가 mount/ptrace action과 openat의 고정 인자를 제한하지만 pointer 경로를 해석하지 못함을 설명합니다.
- openat ALLOW와 파일 경로 허용을 구분하고 LSM/Landlock/fd 설계를 연결합니다.
- arch·다의적 ioctl/socket·이미 열린 fd를 포함한 검증 케이스를 제시합니다.

## 감점 포인트

- openat syscall을 허용하면 /safe 외 경로도 자동으로 차단된다고 말합니다.
- syscall 번호만으로 ioctl·socket의 장치와 목적지를 모두 제한한다고 설명합니다.
- seccomp ALLOW를 최종 파일 인가 성공으로 해석합니다.

## 더 파고들 거리

- 사전 열린 dirfd를 사용하는 설계가 path string 검사보다 어떤 우회면을 줄이는지 설명해 보세요.
- mount가 seccomp에서 허용돼도 capability·LSM·namespace에서 실패할 수 있는 순서를 말해 보세요.
