---
id: linux-container-isolation
title: 컨테이너 네임스페이스의 프로세스·네트워크·마운트 격리
topic: 운영체제
summary: >-
  Linux namespace가 보이는 프로세스·네트워크·마운트 이름공간을 나누는 방식과 컨테이너 경계 밖에 남는 커널·장치·권한 공유를
  설명합니다.
questionIds: []
prerequisites:
  - execution-boundaries
  - file-state
related:
  - workload-policy
  - memory-headroom
reviewedAt: '2026-09-19'
---
# 컨테이너 네임스페이스의 프로세스·네트워크·마운트 격리

컨테이너는 별도 커널을 부팅한 가상 머신이 아니라, 같은 Linux 커널이 자원을 보이는 범위를 프로세스 집합별로 나누는 구성입니다. `namespaces(7)`의 핵심 정의는 전역 자원을 namespace 안의 프로세스에 독립 인스턴스처럼 보이게 한다는 것입니다. 따라서 PID, mount tree, network device와 port는 분리할 수 있지만 syscall 구현, 메모리 관리, 장치 드라이버는 호스트 커널에 남습니다. 이 장은 “컨테이너인가”라는 단일 판단 대신 자원별 namespace, 명시적으로 연결한 경로, 별도 인가를 순서대로 추적합니다.

## 자원별 관찰 경계

Linux의 PID namespace는 프로세스 ID 계층과 가시성을 나누고, mount namespace는 프로세스가 보는 mount point 집합을 나눕니다. network namespace는 장치, 주소, routing table, socket port 공간을 분리합니다. user namespace는 UID/GID mapping과 capability의 해석 주체를 바꿉니다. 한 프로세스가 이 모든 namespace를 새로 가진다는 보장은 없으므로 `clone`, `unshare`, `setns` 호출과 런타임 설정을 함께 봐야 합니다.

예를 들어 컨테이너 안에서 PID 7로 보이는 작업이 호스트에서는 PID 4201일 수 있습니다. 컨테이너의 `/proc`를 올바른 PID namespace에 다시 mount하지 않으면 `ps`가 다른 namespace의 목록을 보여 주어 관찰 자체가 틀어집니다. namespace는 “프로세스를 커널에서 지운다”가 아니라 이름과 조회 범위를 바꾼다는 점이 중요합니다.

## PID 계층과 수명

새 PID namespace의 첫 프로세스는 내부 PID 1인 namespace init이 됩니다. 같은 task가 바깥 namespace에서는 별도 PID를 갖습니다. PID 1은 고아 자식을 수용하고 신호를 다루는 특별한 역할을 가지므로 애플리케이션을 바로 PID 1로 실행할 때는 종료 신호와 zombie 회수까지 설계해야 합니다. 더 결정적인 수명 규칙은 `pid_namespaces(7)`에 있습니다. namespace init이 종료되면 커널은 남아 있는 구성원을 `SIGKILL`로 종료하고, 이후 그 namespace에서 `fork`나 `clone`으로 새 프로세스를 만들려는 시도는 `ENOMEM`으로 실패합니다.

설명용 상태를 `host:4200 -> inner:1`, `host:4201 -> inner:7`로 두면 init 종료 전 내부 목록은 `1,7`입니다. 4200이 종료되면 4201도 종료 대상이고, 호스트 supervisor는 두 host PID의 종료와 재시작 정책을 관찰합니다. 이는 Linux에서 실제 측정한 결과가 아니라 man page 규칙을 적용한 trace입니다. namespace의 `/proc/<pid>/ns/pid` fd나 bind mount가 남아 있으면 프로세스가 사라진 뒤에도 namespace 객체가 유지될 수 있으므로 “프로세스 종료=모든 격리 자원 삭제”라고 단정하지 않습니다.

## Mount tree와 rootfs

mount namespace는 mount point의 보이는 트리를 복제·분리합니다. 컨테이너 런타임은 별도 rootfs를 준비하고 `pivot_root` 또는 동등한 절차로 `/`를 바꾸지만, rootfs 내용과 mount namespace는 다른 개념입니다. `/srv/data`를 `/data`에 bind하면 동일 inode가 다른 namespace 경로로 노출될 수 있고, 쓰기 가능 여부와 소유권은 호스트 파일시스템의 mode, ID mapping, LSM에 의해 다시 결정됩니다.

propagation은 하위 mount와 unmount 사건의 전달 규칙입니다. private mount는 사건을 어느 peer에도 자동 전달하지 않습니다. shared peer group은 peer 사이에서 양방향으로 사건을 전파할 수 있고, slave는 master의 사건을 받지만 slave에서 master로 역전파하지 않습니다. 이 규칙은 파일 내용의 `write(2)`를 복제하는 기능이 아닙니다. shared인데도 파일 내용이 호스트에 보이는 이유는 같은 inode를 bind했기 때문이고, mount propagation은 mount tree 사건을 다룹니다.

## Network namespace와 port 공간

두 network namespace에서 각각 `0.0.0.0:8080`을 bind할 수 있는 것은 소켓 충돌 검사가 namespace별 port 공간에서 이뤄지기 때문입니다. 그러나 외부 연결은 별도 문제입니다. loopback을 올리고 주소와 route를 설정한 뒤 veth pair, bridge, routing, NAT 또는 proxy가 있어야 패킷이 들어옵니다. veth 한쪽을 컨테이너, 다른 쪽을 host bridge에 두면 포트 공간은 분리된 채 L2/L3 경로, bridge queue, host firewall과 물리 NIC가 공유됩니다.

컨테이너 IP의 `10.0.0.2:8080`과 호스트 주소 `:8080`은 서로 다른 endpoint일 수 있습니다. 다만 host-port publish는 호스트 namespace의 주소·포트를 예약하므로 두 컨테이너가 같은 host address:port를 동시에 publish할 수 있는지는 NAT/proxy의 예약 정책에 달립니다. 내부 bind 성공은 외부 접근성의 증거가 아니며 `ss`, `ip addr`, `ip route`, bridge member, NAT와 firewall을 각각 확인해야 합니다.

## User namespace와 자원 소유권

`uid_map`이 `0 100000 1`이면 user namespace 안의 UID 0이 호스트에서 UID 100000으로 해석되는 설명용 상태입니다. 내부에서 root로 보이는 프로세스는 자기 user namespace가 소유하거나 관장하는 비user namespace 자원에는 capability를 가질 수 있지만 초기 user namespace가 요구되는 전역 작업까지 자동으로 얻지는 않습니다. 호스트 파일을 bind한 경우 inode owner와 mode를 초기 namespace의 자격으로 비교하므로 내부 UID 0이라는 문자열만으로 읽기·쓰기를 확정할 수 없습니다.

장치는 더 넓은 커널 표면입니다. `/dev`를 노출하지 않으면 device node 획득 경로가 줄지만, 특정 node를 bind하고 device cgroup, driver 검사, LSM을 통과시키면 user mapping과 별도로 장치가 kernel 기능을 노출합니다. 그래서 `CAP_SYS_ADMIN`이나 내부 root를 하나의 전역 열쇠로 해석하지 않습니다.

## 명시적 연결과 방어 설계

격리 목표마다 먼저 관찰 경계를 고정합니다. PID 문제면 host PID와 inner PID를 함께 저장하고, 파일 문제면 mountinfo·uid_map·inode mode를 비교합니다. 네트워크 문제면 listener와 reachability를 분리해 route, veth, bridge, NAT, firewall 순서로 봅니다. escape 저항성은 bind mount, device ioctl, namespace 전환과 커널 취약점 대응을 별도 항목으로 평가합니다.

운영 구성은 필요한 namespace만 만들고 rootfs를 읽기 전용으로 시작하며 host 경로·device·관리 socket을 좁게 노출하는 쪽을 택합니다. user namespace, capability drop, seccomp, LSM과 cgroup은 서로 다른 실패면을 줄입니다. namespace만으로 자원 고갈이나 kernel bug를 제거하지 못하므로 메모리·PID·fd·network queue 한도도 함께 측정합니다.

## 검증 상태와 비용

다음 그림은 자원별 namespace가 별도 경계를 만들지만 veth와 bind가 공유 경로를 다시 만든다는 중간 상태를 보여 줍니다.

```diagram
{"title":"자원별 namespace와 공유 경로","caption":"각 namespace는 관찰 범위를 줄이지만 bind와 veth가 호스트 자원으로 가는 경로를 다시 연결합니다.","rows":[[{"id":"pid","label":"PID namespace","detail":["inner PID·가시성"]}],[{"id":"mount","label":"Mount namespace","detail":["tree·propagation"]}],[{"id":"net","label":"Network namespace","detail":["port·route·device"]}],[{"id":"bridge","label":"호스트 bridge·bind","detail":["공유 inode·패킷 경로"]}]],"edges":[{"from":"pid","to":"mount","label":"자원 축은 별도"},{"from":"mount","to":"net","label":"각각 독립 계약"},{"from":"net","to":"bridge","label":"명시적 연결"}]}
```

그림의 `net -> bridge`는 network namespace가 bridge를 자동으로 복제한다는 뜻이 아니라 veth를 설치했을 때 패킷이 host kernel 경로로 들어간다는 뜻입니다. 이 macOS 작성 환경에서는 Linux namespace를 실제 생성하지 않았습니다. man-pages 본문과 kernel 문서를 읽어 적은 예상 trace이며 대상 kernel, runtime, CNI, LSM, filesystem의 실제 설정으로 재검증해야 합니다. namespace가 늘면 관찰·운영·디버깅 비용과 veth·NAT·rootfs의 메모리·큐 비용이 생기지만, 자원별 실패 원인을 분리할 수 있다는 이점이 있습니다.

## 참고자료

- [namespaces(7)](https://man7.org/linux/man-pages/man7/namespaces.7.html): namespace 종류, `/proc/<pid>/ns`, API와 자원별 개요를 확인했습니다.
- [pid_namespaces(7)](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html): namespace init 종료 시 `SIGKILL`, 후속 생성 실패의 `ENOMEM` 규칙을 확인했습니다.
- [mount_namespaces(7)](https://man7.org/linux/man-pages/man7/mount_namespaces.7.html): shared·slave·private propagation과 `mountinfo` 표식을 확인했습니다.
- [user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html): UID/GID mapping과 자원 소유 user namespace에 따른 capability 범위를 확인했습니다.
