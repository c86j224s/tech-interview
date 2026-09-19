---
id: exec-environment-descriptors
title: exec 환경과 디스크립터 상속
topic: 운영체제
summary: exec가 프로세스 이미지를 교체하면서 어떤 신호 상태·환경·파일 디스크립터가 남는지와 FD_CLOEXEC 경계를 설명합니다.
questionIds: []
prerequisites:
  - execution-boundaries
  - file-state
related:
  - file-state
  - atomic-file-publication
reviewedAt: '2026-09-19'
---
# exec 환경과 디스크립터 상속

`fork`와 `exec`를 같은 “프로그램 실행”으로 부르면 프로세스 경계가 흐려집니다. `fork`는 새 PID와 기존 image의 복제본을 만들지만, `execve`는 호출 process의 code·data·heap·stack을 새 executable image로 교체합니다. 성공해도 PID는 유지되며 caller가 준비한 `argv`와 `envp`가 새 image의 시작 인자로 구성됩니다. 반면 open file descriptor와 signal 상태는 각각의 상속 계약을 따르므로, “exec는 모두 초기화한다”거나 “모두 보존한다”고 요약할 수 없습니다.

## Image와 PID

launcher PID 4100이 다음 상태라고 하겠습니다.

```text
argv = ["worker", "--port", "8080"]
envp = ["PATH=/usr/bin", "CONFIG=/etc/app/config"]
fd 3 = listening socket
fd 7 = secret temporary file, no close-on-exec
execve("/usr/local/bin/worker", argv, envp)
```

성공하면 PID 4100은 그대로지만 old code와 전역 객체, heap pointer, stack frame은 새 image의 것으로 바뀝니다. launcher가 `malloc`한 객체가 worker heap 객체로 이어지는 것이 아니며, 기존 함수 주소를 새 프로그램이 호출할 수도 없습니다. `execve`가 실패하면 기존 image와 PID가 계속 살아 있으므로 실패 반환 시점의 `errno`, 임시 환경 배열, 열린 자원을 별도로 처리해야 합니다.

새 initial thread는 새 image의 entry point에서 시작합니다. 멀티스레드 process라면 호출 thread 외의 thread가 성공한 exec에서 종료되므로, old userspace lock을 다른 thread가 풀어 줄 것이라는 전제는 성립하지 않습니다.

## argv와 envp

`execve` caller가 포인터 배열과 널 종료 문자열을 준비합니다. kernel이 launcher의 모든 환경을 몰래 복사하는 것이 아니라, 호출자가 전달한 `envp`가 새 image의 초기 환경이 됩니다. `execvp`처럼 PATH 탐색을 추가하는 wrapper와 low-level `execve`의 경로 책임도 구분합니다.

환경은 편리한 문자열 설정 집합이지만 비밀 저장소는 아닙니다. 새 image와 하위 library·진단 도구가 읽을 수 있고, 대상 OS와 권한에 따라 process 관찰·로그·덤프 경로에 노출될 수 있습니다. 따라서 `PATH`, `CONFIG`, `LISTEN_FD=3`만 넘기는 새 배열을 만들고, token이나 password는 별도 파일·IPC 경계를 검토합니다. key allowlist뿐 아니라 값 형식, 길이, 회전, 로그 redaction을 계약으로 기록합니다.

## Descriptor 상속

process의 FD 번호는 kernel의 open file description을 가리키는 descriptor-table entry입니다. 성공한 exec에서 `FD_CLOEXEC`가 설정된 entry는 닫히고, 설정되지 않은 open FD는 새 image에서 남을 수 있습니다. listener를 worker에 전달하는 것은 의도된 상속이지만, secret file·임시 pipe·관리 socket까지 남으면 launcher의 권한 경계가 worker로 확장됩니다.

`close(fd)`와 close-on-exec는 다른 연산입니다. 전자는 현재 descriptor reference를 제거하고, 후자는 성공한 exec 시점에 해당 번호를 닫을 예약입니다. `dup`으로 같은 open file description을 참조하는 다른 번호가 있으면 하나를 닫아도 나머지는 남습니다. 번호 3이라는 사실만으로 socket 종류·접근 모드·peer 수명·상속 목적이 검증되는 것도 아닙니다.

```diagram
{"title":"exec 후 남는 경계","caption":"exec는 PID를 바꾸지 않고 image를 바꿉니다. argv/envp는 caller가 구성하고, FD와 signal 상태는 각각의 보존·초기화 규칙을 따릅니다.","rows":[[{"id":"old","label":"기존 image","detail":["code · heap · stack","여러 thread"]}],[{"id":"call","label":"execve 성공","detail":["PID 유지","argv/envp 전달"]}],[{"id":"new","label":"새 image","detail":["초기 thread","새 주소 공간"]},{"id":"fd","label":"상속 FD","detail":["CLOEXEC 없으면 유지","번호·객체 검사"]},{"id":"sig","label":"Signal 상태","detail":["caught reset","mask/pending 상속"]}]],"edges":[{"from":"old","to":"call","label":"image replacement"},{"from":"call","to":"new","label":"새 entry point"},{"from":"call","to":"fd","label":"descriptor table 규칙"},{"from":"call","to":"sig","label":"POSIX/Linux 규칙"}]}
```

## CLOEXEC race

다음 순서는 멀티스레드에서 안전하지 않을 수 있습니다.

```text
fd = open(path, flags)
# 다른 thread가 이 사이에 exec할 수 있음
fcntl(fd, F_SETFD, FD_CLOEXEC)
```

`open`이 반환된 뒤 `fcntl`이 실행되기 전 다른 thread가 exec하면, FD는 아직 inheritable 상태입니다. Linux `open(2)`가 설명하는 `O_CLOEXEC`는 생성 시점에 flag를 함께 설정하므로 이 경쟁 창을 없앱니다. socket·pipe·accept 계열에도 대상 플랫폼이 제공하는 생성 시 close-on-exec API를 우선합니다. 정말 전달할 listener만 pass-FD로 바꿀 때는 exec 직렬화 또는 별도 descriptor 전달 계약을 두어, “전체를 inheritable로 열기”라는 넓은 창을 만들지 않습니다.

## Signal 상태

성공한 exec 뒤 caught signal disposition은 새 image의 함수 주소로 이어질 수 없어 `SIG_DFL`로 재설정됩니다. POSIX와 Linux 문서에서 ignored disposition은 유지되는 범주로 구분하며, Linux에는 SIGCHLD 관련 예외가 있습니다. calling thread의 signal mask와 pending signals는 POSIX `exec` 규칙에 따라 새 initial thread에 상속됩니다. alternate signal stack은 XSI/Linux 범위에서 폐기됩니다.

예를 들어 exec 전 SIGUSR1 handler 설치, SIGPIPE ignore, SIGTERM block을 설정했다면 개념적 결과는 다음과 같습니다.

| 상태 | 성공한 exec 뒤 |
| --- | --- |
| SIGUSR1 caught handler | `SIG_DFL`로 reset |
| SIGPIPE ignored | Linux/POSIX 규칙의 ignore 보존, SIGCHLD 예외 확인 |
| SIGTERM mask | calling thread의 mask를 새 initial thread가 상속 |
| pending signal | calling thread/process pending 규칙에 따라 새 시작 상태에 상속 |
| alternate stack | XSI/Linux 계약에서 폐기 |

새 image는 이 상태를 의도했는지 확인하고, 필요하면 시작 초기에 mask와 disposition을 다시 설정해야 합니다. “handler가 사라졌으니 mask도 사라졌다”는 추론은 틀립니다.

## Multithread exec

T2가 userspace mutex를 잡고 로그를 작성하는 동안 T1이 exec를 호출한다고 하겠습니다. exec가 성공하면 T2는 종료되고 T1의 새 initial thread만 새 image에서 시작합니다. old heap의 mutex를 새 image가 정상적인 상호 배제 객체로 이어받는다고 볼 수 없으며, T2의 destructor·unlock을 기대할 수도 없습니다. inherited socket, shared memory, file description처럼 kernel 또는 외부에 남는 자원은 userspace lock과 별도 계약입니다.

fork 후 exec 관용구에서는 fork와 exec 사이에 arbitrary library call을 넣지 않는 이유도 여기에 있습니다. 멀티스레드 부모에서 복제된 child는 호출 thread 외의 lock 보유 상태가 중간일 수 있으므로, child의 제한된 경로는 async-signal-safe 범위로 좁힙니다.

## Allowlist launcher

환경과 descriptor를 각각 검증하는 launcher는 다음 순서를 가집니다.

1. 필요한 key만으로 새 `envp` 배열을 만들고 secret key를 제외합니다.
2. 모든 신규 FD를 생성 시 CLOEXEC로 열고, 전달할 listener의 번호·종류·권한을 기록합니다.
3. exec 경쟁을 직렬화한 뒤 pass-FD만 의도적으로 상속 가능 상태로 바꿉니다.
4. worker 시작 시 argv/env와 FD 3의 실제 객체를 확인하고, 금지된 FD·환경 key를 관찰합니다.

아래는 설명용 pseudocode이며 실행하지 않았습니다.

```text
env = allowlist_env(PATH, CONFIG, LISTEN_FD=3)
listener = create_listener_with_cloexec_contract()
mark_only_listener_for_child(listener)
execve(worker, argv, env)
```

예상 결과는 worker가 허용된 listener만 보유하고 secret file·임시 pipe를 보지 않는 것입니다. `/proc/self/fd` 열거는 Linux 진단에는 쓸 수 있지만 portable 표준 계약으로 일반화하지 않습니다. descriptor 0·1·2와 set-ID 실행의 특수 동작도 대상 OS 문서에서 별도로 확인합니다.

## 실패 검증

정상 exec, 존재하지 않는 경로로 실패하는 exec, FD 하나만 전달하는 exec, 다른 thread가 동시에 open·exec하는 위험 경로를 나누어 시험합니다. 성공 후에는 PID, argv/envp, FD 목록, signal disposition, mask/pending, thread 수, listener 연결 수명을 관찰합니다. 실패 시 old image가 남아 있으므로 errno 처리와 임시 자원 정리가 수행되는지 확인합니다.

## 비용과 참고 자료

CLOEXEC 기본값과 명시적 pass-FD는 초기 코드와 감사 항목을 늘리지만, open/fcntl race와 신규 FD 누락을 줄입니다. 환경 allowlist도 값 회전과 타입 검증 비용이 있지만 비밀 노출면을 줄입니다. exec 자체는 외부 DB 변경을 rollback하지 않으므로, 성공·실패 이후의 supervisor handoff를 별도 상태로 설계합니다.

- Linux `execve(2)`: https://man7.org/linux/man-pages/man2/execve.2.html — image/PID, argv/envp, FD_CLOEXEC, signal disposition, alternate stack, other-thread 종료를 확인했습니다.
- POSIX.1-2024 `exec` functions: https://pubs.opengroup.org/onlinepubs/9799919799/functions/exec.html — close-on-exec, open file description, calling-thread mask·pending inheritance, multithread exec를 확인했습니다.
- Linux `open(2)`: https://man7.org/linux/man-pages/man2/open.2.html — `O_CLOEXEC` 생성 시점 의미와 open/fcntl 경쟁을 확인했습니다.
- 저장소의 file-state·execution-boundaries 장 — descriptor table과 image 경계를 연결하되, 이 글은 exec 상속 계약에 범위를 둡니다.
