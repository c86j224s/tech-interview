---
id: capabilities-bounding-ambient-reacquire
title: >-
  부모가 capability를 drop한 뒤 자식이 file capability 실행 파일을 실행합니다. bounding set과
  ambient set은 어떤 재획득 경계를 만들까요?
difficulty: 중하
category: 보안
tags:
  - capability
  - execve
  - least privilege
related:
  - authentication-vs-authorization
---
# 부모가 capability를 drop한 뒤 자식이 file capability 실행 파일을 실행합니다. bounding set과 ambient set은 어떤 재획득 경계를 만들까요?

## 구두 답변

bounding set은 execve로 file permitted capability가 새 permitted에 들어오는 상한이고, ambient set은 비특권 실행 파일을 통과시키는 전달 경로입니다. 부모가 `CAP_NET_RAW`를 bounding에서 제거하면 fork한 자식도 그 B를 복사하므로 file capability가 NET_RAW를 선언해도 `F(P)&B`에서 잘립니다. 이 drop은 현재 effective를 0으로 만드는 것보다 재획득 경로를 강하게 닫고 되돌릴 수 없습니다. 반대로 ambient는 permitted와 inheritable에 모두 있어야 유지되며, privileged file을 실행하면 지워집니다. 설명용 상태를 부모/자식 `B={CHOWN}`, `A=I=P={CHOWN}`으로 두고 `F(P)={NET_RAW,CHOWN}` 파일을 실행하면 `F(P)&B={CHOWN}`이고 ambient CHOWN도 입력이므로 새 permitted/effective는 file effective bit 조건에 따라 CHOWN을 포함합니다. NET_RAW는 bounding에서 잘려 들어오지 않습니다. 이는 실제 Linux 실행이 아닌 집합 연산 trace입니다. 부모가 E만 drop했으면 P/I/A에 남은 경로가 자식 execve에 영향을 줄 수 있지만, P에서 drop하면 일반 capset으로 되돌릴 수 없고 B까지 drop하면 file-permitted 경로도 차단됩니다. privileged file 또는 set-user-ID 파일은 ambient를 0으로 만들기 때문에 비특권 파일 trace와 다릅니다. 검증은 fork 직후와 exec 직후 각 TID의 `CapPrm`, `CapEff`, `CapInh`, `CapAmb`, `CapBnd`를 저장하고 capability 없는 파일과 xattr 파일을 비교합니다. `nosuid`, user namespace root ID, LSM도 함께 봅니다. early drop은 안전성을 높이지만 loader와 thread 생성에 필요한 권한을 먼저 확인해야 합니다.

## 득점 포인트

- bounding drop이 file-permitted 경로의 상한을 줄이고 fork 자식에 상속됨을 계산합니다.
- ambient의 P/I 동시 조건과 privileged file에서의 소거를 비특권 파일과 비교합니다.
- E·P·B drop의 재획득 차이를 fork/exec 전후 Cap* trace로 검증합니다.

## 감점 포인트

- ambient를 어떤 실행 파일에도 영구 전달되는 권한으로 설명합니다.
- B에서 제거한 capability가 file xattr만 있으면 다시 생긴다고 말합니다.
- E만 내린 것과 B를 내린 것을 같은 비가역 경계로 취급합니다.

## 더 파고들 거리

- ambient capability가 P나 I에서 먼저 제거될 때 다음 execve 식의 어느 항이 사라지는지 계산해 보세요.
- set-user-ID와 file capability가 함께 있는 파일에서 ambient와 P'를 어떤 순서로 확인하겠습니까?
