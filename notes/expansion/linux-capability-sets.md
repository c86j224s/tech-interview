---
id: linux-capability-sets
title: Linux capabilities의 권한 분할과 실행 전파
topic: 보안
summary: >-
  root 하나로 묶인 권한을 capability set·user namespace·execve 전파 규칙으로 분해하고, capability가
  곧 대상 자원 인가 전체를 뜻하지 않는 경계를 설명합니다.
questionIds: []
prerequisites:
  - execution-boundaries
  - authentication
related:
  - workload-policy
  - tls-trust
reviewedAt: '2026-09-19'
---
# Linux capabilities의 권한 분할과 실행 전파

Linux capability는 전통적인 superuser 권한을 독립 단위로 나눈 per-thread 속성입니다. `CAP_NET_RAW`가 있다는 말은 raw socket 같은 해당 권한 검사에 참여할 입력이 있다는 뜻이지, 파일·장치·LSM·seccomp 검사를 모두 통과한다는 뜻이 아닙니다. 특히 실행 파일을 바꾸면 현재 `effective`만으로 다음 상태를 예측할 수 없습니다. permitted, inheritable, ambient, bounding과 file capability를 함께 계산해야 합니다.

## Thread capability set

`permitted(P)`는 해당 thread가 `effective(E)`로 올릴 수 있는 상한이고, `effective`는 현재 커널 권한 검사에 쓰이는 집합입니다. `inheritable(I)`는 execve를 건너갈 후보, `ambient(A)`는 비특권 실행 파일에 capability를 전달하는 경로입니다. `bounding(B)`는 file permitted set에서 execve로 새 permitted capability가 생길 수 있는 상한입니다. 모두 thread 단위라서 `/proc/<pid>/status`만 보고 멀티스레드 전체를 추론하지 않고 `/proc/<pid>/task/<tid>/status`를 비교해야 합니다.

fork는 부모 set을 복사하지만 이후 부모와 자식의 변화는 독립적입니다. 따라서 부모가 `CapEff`만 내렸는지 `CapPrm`, `CapInh`, `CapAmb`, `CapBnd`까지 내렸는지 기록해야 재실행 가능성을 판단할 수 있습니다. “root를 내렸다” 같은 문장은 어느 set을 뜻하는지 모호합니다.

## Execve 계산 입력

`capabilities(7)`의 실행 전후 계산은 file inheritable `F(I)`, file permitted `F(P)`, file effective bit와 현재 set을 결합합니다. 핵심을 계산 순서로 쓰면 다음과 같습니다.

```text
P'(A) = privileged_file ? 0 : P(A)
P'(P) = (P(I) & F(I)) | (F(P) & P(B)) | P'(A)
P'(E) = F(effective) ? P'(P) : P'(A)
P'(I) = P(I), P'(B) = P(B)
```

설명용 수치로 실행 전 `I={NET_RAW}`, `B={NET_RAW,CHOWN}`, `A=∅`, `E=∅`, 파일 `F(I)={NET_RAW}`, `F(P)={CHOWN}`, effective bit=1을 놓습니다. 첫 교집합은 NET_RAW, 두 번째는 CHOWN이므로 실행 후 `P'={NET_RAW,CHOWN}`, `E'={NET_RAW,CHOWN}`입니다. B에서 CHOWN을 제거하면 두 번째 교집합이 비어 `P'=E'={NET_RAW}`가 됩니다. 이 trace는 수식 검산용 예상값이며 macOS에서 Linux execve를 수행한 결과가 아닙니다.

현재 effective가 비어도 permitted와 file capability가 맞물리면 다음 실행에서 effective가 생길 수 있습니다. 반대로 file effective bit가 꺼진 파일은 새 permitted가 있어도 자동으로 effective가 되지 않습니다. 실행 파일이 set-user-ID 또는 file capability를 가진 privileged file이면 ambient가 지워지는 조건도 별도 적용합니다.

## File capability와 파일시스템

파일 capability는 `security.capability` extended attribute에 저장되며 `getcap` 출력과 실행 직후의 `CapEff`는 서로 다른 시점의 정보입니다. 파일시스템이 xattr과 capability revision을 지원해야 하고 `nosuid`, mount 방식, LSM, user namespace가 적용을 막을 수 있습니다. namespaced file capability는 어떤 user namespace root에 귀속됐는지도 기록하므로, 이미지 빌드 중 `setcap`이 성공했다는 사실만으로 런타임 권한을 확정할 수 없습니다.

파일 capability를 쓰는 권한과 실행 때 부여되는 권한을 분리해야 합니다. 공유 bind mount에 capability xattr을 변경하면 호스트 inode의 실행 의미가 바뀔 수 있고, 컨테이너 내부 UID 0도 호스트 inode owner와 동일하지 않을 수 있습니다. 따라서 artifact의 xattr, mount option, ID mapping과 실행 파일의 interpreter 경로를 함께 provenance로 남깁니다.

## Bounding과 ambient 경계

`PR_CAPBSET_DROP`으로 bounding set에서 capability를 제거하면 fork한 자식과 이후 execve에서도 그 상한이 줄고, 일반적인 방법으로 되돌릴 수 없습니다. 현재 effective를 0으로 만드는 것은 permitted나 file capability 경로를 남길 수 있지만 bounding drop은 `F(P) & B` 경로를 닫습니다. 다만 bounding이 모든 capability 전달 경로를 똑같이 “삭제”한다고 말하면 안 되며, 실제 file-permitted 계산식을 적용해야 합니다.

ambient capability는 permitted와 inheritable에 동시에 있어야 유지됩니다. 둘 중 하나를 drop하면 ambient도 내려가며, privileged file을 실행하면 ambient가 지워집니다. 따라서 부모가 ambient를 가진 상태에서 fork한 자식이 비특권 파일을 실행하는 경우와 file capability 파일을 실행하는 경우의 trace가 다릅니다. 이 경계가 질문에서 말하는 재획득과 단순 상속을 가르는 지점입니다.

## User namespace와 대상 자원

capability는 전역 숫자 티켓이 아닙니다. user namespace 안의 capability는 그 namespace가 소유하거나 관장하는 자원의 권한 검사에 사용됩니다. 내부 root가 자신의 mount namespace에서 mount할 수 있어도 초기 user namespace가 요구하는 커널 모듈, 전역 시간, 일부 device 작업까지 자동으로 할 수 없습니다. network 작업에서도 `CAP_NET_ADMIN`을 가진 프로세스가 자기 network namespace의 route를 바꿀 수 있다는 사실은 host network namespace route 권한을 의미하지 않습니다.

대상 namespace의 owner user namespace, `setns` 권한, device node와 cgroup devices, LSM을 함께 기록해야 합니다. capability가 effective에 있다고 해서 bind mount의 DAC나 driver 내부 검사까지 우회하지 않으며, seccomp가 `socket`이나 `ioctl`을 먼저 거부할 수도 있습니다.

## 진단과 구현 선택

일반 파일 open은 성공하지만 raw socket이 `EPERM`인 상태라면 `CapEff`만 확인하지 않습니다. 같은 thread의 `CapInh`, `CapPrm`, `CapEff`, `CapBnd`, `CapAmb`, 실행 파일 xattr, mount option, user/network namespace, seccomp log, LSM audit를 시간순으로 맞춥니다. seccomp `ERRNO(EPERM)`이면 kernel raw-socket 검사 전에 종료됐을 수 있고, seccomp ALLOW와 syscall 실행 흔적이 있으면 capability·LSM·namespace를 다음 후보로 봅니다.

정책 구현에서는 file capability보다 시작 시 최소 capability를 부여하는 방식이 artifact 추적에 단순한지 비교합니다. drop 순서는 loader, thread 생성, 로그와 종료 경로가 필요한 시점 뒤로 조정하되, 불필요한 권한은 가능한 앞에서 끊습니다. `CAP_SYS_ADMIN`은 범위가 넓으므로 “일단 추가해 보기”를 진단 방법으로 삼지 않습니다.

## 검증 상태와 비용

다음은 파일 속성과 thread set을 execve 계산으로 모으는 흐름입니다.

```diagram
{"title":"capability set과 execve","caption":"실행 파일 교체는 현재 effective 하나가 아니라 thread set과 file capability의 결합으로 새 권한을 만듭니다.","rows":[[{"id":"thread","label":"실행 전 thread","detail":["P·E·I·A·B"]}],[{"id":"filecap","label":"파일 속성","detail":["F(P)·F(I)·effective"]}],[{"id":"formula","label":"execve 계산","detail":["교집합·상한·ambient"]}],[{"id":"result","label":"실행 후 thread","detail":["P′·E′·I′·A′·B′"]}]],"edges":[{"from":"thread","to":"filecap","label":"두 입력 수집"},{"from":"filecap","to":"formula","label":"파일 bit 적용"},{"from":"formula","to":"result","label":"새 set 산출"}]}
```

이 문서의 수치 trace는 `NET_RAW`, `CHOWN` 집합 연산으로 작은 Python 계산을 재확인할 수 있지만 Linux capability 변경 자체는 실행하지 않았습니다. 대상 kernel, man-pages와 filesystem의 capability revision, LSM, runtime drop 순서를 고정한 Linux 테스트가 필요합니다. set을 세분화하면 최소 권한을 설명하기 좋지만 xattr과 이미지 provenance, 멀티스레드 관찰, 재실행 경로를 관리하는 비용이 늘어납니다.

## 참고자료

- [capabilities(7)](https://man7.org/linux/man-pages/man7/capabilities.7.html): set 역할, execve 계산, file capability, bounding·ambient 규칙을 확인했습니다.
- [user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html): capability의 대상 자원 owner와 UID/GID mapping을 확인했습니다.
- [namespaces(7)](https://man7.org/linux/man-pages/man7/namespaces.7.html): namespace별 관찰 범위를 비교했습니다.
