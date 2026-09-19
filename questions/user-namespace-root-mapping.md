---
id: user-namespace-root-mapping
title: >-
  컨테이너 UID 0이 호스트 root와 같지 않을 수 있는 이유를 user namespace와 device·bind mount 조건으로
  설명하세요.
difficulty: 중하
category: 운영체제
tags:
  - namespace
  - PID
  - mount
  - network
related:
  - process-vs-thread
---
# 컨테이너 UID 0이 호스트 root와 같지 않을 수 있는 이유를 user namespace와 device·bind mount 조건으로 설명하세요.

## 구두 답변

컨테이너의 UID 0은 그 user namespace 안에서의 숫자 0일 뿐, 초기 user namespace의 root UID 0과 같은 주체라는 뜻이 아닙니다. 예를 들어 `uid_map`이 `0 100000 1`이면 내부 0이 호스트에서는 100000으로 매핑됩니다. 내부 capability도 대상 자원의 owner user namespace와 함께 해석되므로, 자기 mount/network namespace를 관리할 수 있다고 host 전역 자원까지 바꿀 수는 없습니다. bind mount 사례에서 `/data`가 호스트 `/srv/data`를 가리키고 파일 owner가 host UID 1000, mode가 `0600`이라면 내부 root라는 표시만으로 읽기 성공을 예측할 수 없습니다. 실제 결과는 매핑된 자격, DAC/ACL, LSM, mount 옵션과 capability를 함께 적용해야 합니다. 반대로 매핑된 UID에 쓰기 권한이 있고 쓰기 가능한 bind를 노출하면 user namespace가 있어도 host inode 변경 위험은 남습니다. device는 더 강한 경계입니다. `/dev`를 노출하지 않으면 node 획득 경로가 줄지만 특정 device node를 bind하고 device cgroup과 driver 검사를 통과시키면 커널 기능이 노출될 수 있습니다. 초기 user namespace가 요구하는 장치 작업, LSM, seccomp도 별도입니다. 진단은 내부 `id -u`, `uid_map`, `gid_map`, `CapEff`와 host `stat`, mount option, device 목록을 함께 기록합니다. 이 수치는 설명용 mapping이며 macOS에서 Linux 접근을 실행한 결과가 아닙니다. 결론은 “UID 0=host root”도 “user namespace=모든 host access 차단”도 아니며, mapping·owner namespace·bind/device 노출·커널 정책의 교집합입니다.

## 득점 포인트

- uid_map의 내부·외부 ID와 대상 inode의 DAC를 연결해 root 표기의 한계를 설명합니다.
- capability가 대상 user namespace 소유권에 종속되고 device 노출이 별도 커널 표면임을 구분합니다.
- id_map·CapEff·stat·mount/device 정책을 한 번에 확인하는 진단 증거를 제시합니다.

## 감점 포인트

- namespace 내부 UID 0을 초기 namespace root와 동일시합니다.
- ID mapping만 있으면 bind mount 파일이나 장치에 어떤 접근도 불가능하다고 단정합니다.
- CAP_NET_ADMIN 또는 CAP_SYS_ADMIN 하나로 초기 user namespace의 전역 자원을 얻는다고 말합니다.

## 더 파고들 거리

- host 파일 owner가 매핑된 UID와 일치하지만 LSM이 거부할 때 원인을 어떻게 좁히겠습니까?
- device node를 노출하지 않고도 남는 kernel attack surface와 cgroup devices의 역할을 비교해 보세요.
