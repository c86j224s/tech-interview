---
id: inode-unlink-open-fd
title: >-
  파일 이름을 unlink한 뒤 이미 열어 둔 FD로 계속 읽을 수 있습니다. directory entry, inode, open file
  object의 수명을 어떻게 나누나요?
difficulty: 하
category: 운영체제
tags:
  - inode
  - unlink
  - open FD
  - dentry
related:
  - os-file-descriptor-sharing
---
# 파일 이름을 unlink한 뒤 이미 열어 둔 FD로 계속 읽을 수 있습니다. directory entry, inode, open file object의 수명을 어떻게 나누나요?

## 구두 답변

`unlink`는 pathname namespace에서 directory entry binding을 제거하는 연산이지 이미 열린 FD를 닫는 연산이 아닙니다. 예를 들어 reader가 `open("log")`하여 `FD1 → inode42`를 얻은 뒤 writer가 `unlink("log")`하면 새 `open("log")`는 실패하지만 FD1은 열린 file reference를 통해 inode42의 data를 계속 읽거나, 권한 범위 안에서 쓸 수 있습니다. link count는 directory name reference의 축입니다. 이름이 하나뿐이었다면 unlink 뒤 count가 0이 되지만, FD나 filesystem이 보유한 다른 reference가 남으면 inode와 data가 곧바로 회수된다고 말할 수 없습니다. 이후 같은 경로에 새 log를 만들면 `log → inode57`처럼 새 binding이 생기고, FD1은 자동으로 inode57로 이동하지 않습니다. 따라서 로그 회전에서 옛 writer를 닫지 않으면 삭제된 열린 inode가 계속 디스크 공간을 점유하고, 새 독자는 새 파일을 읽는 두 상태가 동시에 생깁니다. 관찰할 때는 unlink 전후 `stat`의 inode와 device, 새 pathname open 결과, 기존 FD의 read 결과를 각각 기록해야 합니다. path가 사라졌다는 사실만으로 FD가 EOF가 되거나 자동 close되었다고 판단하면 안 되며, EOF는 현재 file offset과 size의 결과로 따로 해석해야 합니다. Linux VFS는 open file object가 dentry/inode reference를 유지하는 구현 설명을 제공하지만, 모든 POSIX 내부 reclaim 시점을 동일하게 보장하는 규범으로 확장하지 않습니다. dup/fork로 FD가 더 복제된 경우에는 마지막 descriptor와 open-file reference가 사라지는 시점까지 수명 계산도 이어집니다.

## 득점 포인트

- unlink의 namespace 제거와 open file reference의 수명을 `log → inode42`, `FD1 → inode42` 상태로 나눕니다.
- 새 pathname open과 기존 FD read가 서로 다른 결과를 낼 수 있는 로그 회전 사례를 제시합니다.
- link count 0과 inode reclaim을 분리해 마지막 reference 조건을 설명합니다.

## 감점 포인트

- 경로가 사라지는 순간 FD가 자동 close되거나 기존 writer가 새 파일로 이동한다고 말하면 안 됩니다.
- EOF와 unlink를 동일시하지 말고 현재 offset·size의 결과로 따로 해석합니다.
- 모든 POSIX 구현의 내부 reclaim 시점을 같은 숫자와 순서로 단정하지 않습니다.

## 더 파고들 거리

- deleted-open inode가 디스크를 계속 점유하는지를 FD와 filesystem 관찰로 확인합니다.
- dup/fork가 open-file reference를 늘리는 경우 마지막 reference까지 수명 추적을 확장합니다.
- VFS 구현 설명과 portability 계약을 답변에서 구분합니다.
