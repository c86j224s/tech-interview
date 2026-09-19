---
id: linux-seccomp-boundary
title: seccomp syscall 필터의 실행 경계
topic: 보안
summary: >-
  seccomp-BPF가 syscall 번호·인자에 따라 허용·거부·추적 동작을 선택하는 방식과 namespace·capability를
  대신하지 못하는 이유를 설명합니다.
questionIds: []
prerequisites:
  - execution-boundaries
  - workload-policy
related: []
reviewedAt: '2026-09-19'
---
# seccomp syscall 필터의 실행 경계

seccomp-BPF는 프로세스가 커널에 진입하는 syscall 표면을 줄이는 장치입니다. 필터는 `seccomp_data`의 architecture, syscall 번호, 레지스터 인자를 읽고 `ALLOW`, `ERRNO`, `TRAP`, `KILL`, `TRACE`, `USER_NOTIF` 같은 action을 선택합니다. 반면 경로 문자열, fd가 가리키는 inode, 장치 driver의 의미와 정보 흐름은 자동으로 판정하지 않습니다. 따라서 seccomp는 namespace, capability, DAC, LSM, Landlock, cgroup과 결합하는 실행 경계이지 완전한 sandbox라는 이름표가 아닙니다.

## 필터 입력과 설치 조건

BPF는 사용자 포인터를 역참조할 수 없습니다. `openat`의 `dirfd`나 `flags` 같은 고정 인자는 비교할 수 있지만 포인터가 가리키는 `/safe/file` 문자열이나 구조체 내용을 직접 읽지는 못합니다. 이 제약은 필터가 사용자 메모리를 읽는 동안 값이 바뀌는 문제를 줄이는 대신, path policy를 syscall 번호만으로 만들 수 없게 합니다.

필터 설치는 `PR_SET_NO_NEW_PRIVS`를 먼저 설정하거나 필요한 `CAP_SYS_ADMIN`을 가진 경우에 가능하다는 kernel 문서 계약을 따릅니다. 필터가 `fork`·`clone`과 `execve`를 거쳐 상속되더라도 모든 thread가 동시에 같은 filter를 얻는다는 뜻은 아닙니다. 설치 시점, ABI, 자식 상속, multi-thread 동기화를 별도 상태로 기록합니다.

## Action 우선순위와 결과

여러 filter가 쌓이면 반환 action의 precedence가 적용됩니다. `KILL_PROCESS`와 `KILL_THREAD`는 syscall을 실행하지 않고 종료시키고, `TRAP`은 `SIGSYS`, `ERRNO`는 지정 errno, `LOG`는 기록 후 실행, `ALLOW`는 통과 경로입니다. 같은 precedence에서 data가 충돌할 때는 최신 filter의 data가 선택될 수 있으므로 “뒤에서 allow를 추가하면 앞의 거부를 되돌린다”라고 이해하지 않습니다.

설명용 trace로 `openat=ALLOW`, `mount=ERRNO(EPERM)`, `ptrace=KILL_PROCESS`를 둡니다. mount에 capability가 있어도 seccomp action이 syscall을 실행 전에 거부합니다. ptrace는 일반적인 오류 반환이 아니라 kill 경로입니다. openat은 filter를 통과하지만 어떤 path와 fd를 열 수 있는지는 다른 통제 계층의 문제입니다. 이 결과는 실제 BPF 실행이 아닌 action 우선순위 계산입니다.

## ABI와 다의적 인자

syscall 번호는 architecture별로 다를 수 있고, 한 ABI의 번호가 다른 호출 규약과 겹칠 수 있습니다. `seccomp_data.arch`를 먼저 확인하지 않으면 번호만 맞는 잘못된 ABI를 통과시킬 수 있습니다. allowlist는 대상 architecture와 libc/runtime이 사용하는 ABI를 명시해야 합니다.

`ioctl`은 하나의 번호 아래 request command, fd의 실제 장치, 포인터 구조체가 서로 다른 driver 효과를 만듭니다. `socket`·`connect`도 번호만으로 protocol·목적지·주소를 모두 제한하지 못합니다. `read` 역시 fd가 일반 파일인지 proc인지 device인지에 따라 정보 노출이 달라집니다. 따라서 syscall allow는 fd 획득 경로와 대상 자원을 함께 검토하는 입력 정책의 한 단계일 뿐입니다.

## Thread filter와 TSYNC

filter는 thread 단위입니다. 한 thread만 `mount=ERRNO`를 설치하면 다른 thread는 여전히 mount를 시도할 수 있습니다. `SECCOMP_FILTER_FLAG_TSYNC`는 현재 thread의 filter chain을 다른 thread에도 적용하려 하지만 기존 chain과 결합할 수 없는 thread가 있으면 실패할 수 있습니다. `seccomp(2)`의 계약에 따라 성공 여부와 반환된 호환되지 않는 TID 또는 `ESRCH`를 기록하고, 실패 시 새 filter가 전체에 설치됐다고 가정하지 않습니다.

동기화 성공은 “미래 모든 thread가 영구히 같은 상태”라는 뜻도 아닙니다. 새 thread는 생성 시 부모 filter를 상속하므로 생성 시점과 부모 chain을 추적하고, 이미 존재하는 thread의 chain과 조합 가능성을 별도로 검사합니다. 초기화에 필요한 `clone`, `prctl`, loader, 로그 syscall을 너무 일찍 막으면 정책 코드가 자기 자신을 종료시킬 수 있어 관찰용 `LOG` 단계가 필요합니다.

## User notification과 supervisor

`SECCOMP_RET_USER_NOTIF`는 syscall을 자동 승인하지 않고 listener fd를 통해 userspace supervisor가 판단하게 합니다. supervisor는 notification ID와 syscall data를 읽고 응답하거나 `NOTIF_ADDFD`로 tracee에 fd를 전달할 수 있습니다. listener 하나에 fork한 여러 task의 요청이 올 수 있고, ID·tracee 생존·fd 대상·정책 버전을 검증하지 않으면 잘못된 자원을 전달할 수 있습니다.

요청이 valid response를 기다린 채 pending이면 supervisor 장애 시간만큼 지연이 늘 수 있지만, 항상 그렇지는 않습니다. tracee exit, signal에 의한 interruption, higher-precedence action, listener 부재의 `ENOSYS` 등은 다른 결과를 만들 수 있습니다. 따라서 “2초 멈춤이면 모든 호출이 정확히 2초 지연”이라고 단정하지 않고, pending 상태가 유지되는 경우라는 조건을 붙입니다. 포인터 내용이 필요하면 tracee 메모리를 복사한 뒤 판단해 TOCTOU를 줄이고, 재시도·취소·멱등성을 request ID로 관리합니다.

## 보완 계층과 경로 한계

namespace는 보이는 mount·network·PID 범위를 줄이고, capability는 privileged operation의 권한 단위를 줄이며, LSM과 DAC는 대상 자원과 경로를 검사합니다. `mount` syscall을 seccomp에서 ALLOW해도 `CAP_SYS_ADMIN`, 대상 mount namespace, filesystem, LSM에서 다시 실패할 수 있습니다. 반대로 capability가 있어도 seccomp `ERRNO`로 실행 전에 막힙니다. 이 교집합이 오류 진단 순서를 정합니다.

`openat` allow만으로 `/safe` 밖을 막을 수 있다는 주장은 성립하지 않습니다. 이미 열린 fd, symlink, mount 재배치, `/proc`, device fd, `openat2`의 별도 호출을 고려해야 합니다. 경로 의미가 핵심이면 사전 열린 dirfd·파일 디스크립터 설계, LSM/Landlock, 별도 supervisor를 선택하고, seccomp는 ABI와 syscall 표면을 줄이는 역할로 좁힙니다.

## 정책 검증과 비용

정상 초기화, steady-state, 종료·로그 단계의 syscall 집합을 구분해 allowlist를 만듭니다. 검증 표에는 정상 `openat`, 금지 `mount`·`ptrace`, 다른 arch, 잘못된 `ioctl` fd, thread 추가, filter 중첩, supervisor 중단과 tracee 종료를 넣고 syscall 실행 여부, action, errno/signal, 다음 상태를 기록합니다. 이 macOS 환경에서는 Linux filter를 설치하지 않았으므로 아래 그림과 계산은 문서 기반 예상 trace입니다.

```diagram
{"title":"syscall에서 자원 검사까지","caption":"seccomp action은 syscall 진입을 줄이지만 실제 자원 인가는 이후 계층에서 계속됩니다.","rows":[[{"id":"call","label":"syscall 요청","detail":["arch·번호·인자"]}],[{"id":"filter","label":"seccomp-BPF","detail":["allow·errno·kill·notify"]}],[{"id":"authorize","label":"커널 인가","detail":["capability·DAC·LSM"]}],[{"id":"target","label":"대상 자원","detail":["path·fd·device·netns"]}]],"edges":[{"from":"call","to":"filter","label":"입력 평가"},{"from":"filter","to":"authorize","label":"실행 또는 차단"},{"from":"authorize","to":"target","label":"자원별 검사"}]}
```

filter chain이 많으면 syscall 진입마다 BPF 평가 비용과 정책 관리 비용이 커집니다. 너무 좁은 목록은 loader·thread·update·로그를 깨고, 넓은 목록은 kernel surface를 남깁니다. USER_NOTIF는 supervisor CPU, queue, 장애복구와 tracee latency를 추가합니다. 정확한 action·flag·structure 지원 여부는 대상 kernel headers와 release를 고정해 Linux에서 실행 검증해야 합니다.

## 참고자료

- [Seccomp BPF](https://www.kernel.org/doc/html/latest/userspace-api/seccomp_filter.html): filter 입력, 설치 조건, action precedence, architecture와 USER_NOTIF 계약을 확인했습니다.
- [seccomp(2)](https://man7.org/linux/man-pages/man2/seccomp.2.html): TSYNC 성공·실패 반환과 thread 적용 범위를 확인했습니다.
- [capabilities(7)](https://man7.org/linux/man-pages/man7/capabilities.7.html): seccomp와 capability가 별도 인가 축임을 확인했습니다.
