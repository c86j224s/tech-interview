---
id: inode-hardlink-count
title: >-
  두 이름이 같은 파일 내용을 가리킵니다. hard link가 같은 inode를 공유한다는 사실과 link count·unlink 결과를
  어떻게 확인하나요?
difficulty: 하
category: 운영체제
tags:
  - inode
  - hard link
  - link count
  - unlink
related:
  - os-file-descriptor-sharing
---
# 두 이름이 같은 파일 내용을 가리킵니다. hard link가 같은 inode를 공유한다는 사실과 link count·unlink 결과를 어떻게 확인하나요?

## 구두 답변

hard link는 파일 내용을 복사하는 것이 아니라 같은 filesystem의 inode를 가리키는 directory entry를 하나 더 만드는 연산입니다. 처음 `a → inode42`, link count 1인 상태에서 `link("a", "b")`가 성공하면 `b → inode42`가 추가되고 count는 2가 됩니다. 두 이름으로 같은 data와 inode metadata를 보므로 `a`로 mode나 size를 바꾸면 `b`를 통해 보는 object에도 반영됩니다. 이어서 `unlink("a")`를 실행하면 pathname namespace에서 a binding만 제거되어 `b → inode42`, count 1이 남습니다. 이미 `open("a")`로 얻은 FD가 있다면 이 FD는 열린 file reference를 통해 inode와 data를 계속 사용할 수 있습니다. 마지막 이름 b까지 unlink하면 directory entry count는 0이지만 FD가 남아 있는 동안 즉시 reclaim된다고 단정할 수 없습니다. 새로 같은 이름을 create하면 새 inode가 생기므로 옛 FD나 b의 대상이 새 파일로 바뀌지도 않습니다. 확인은 `stat`으로 a와 b의 device, inode, link count를 비교하고, unlink 전후에 열린 FD로 read한 결과와 새 pathname lookup 결과를 나눠 기록하는 방식이 좋습니다. inode 번호만 전역 유일하다고 해석하지 말고 device와 filesystem 경계를 함께 봅니다. log rotation에서는 옛 writer의 FD가 삭제된 inode를 계속 붙잡아 공간을 차지할 수 있으므로 이름 삭제 성공을 공간 회수 성공으로 보고하면 안 됩니다. 세부 reclaim 시점은 Linux filesystem 구현과 남은 reference 범위로 한정해 말합니다.

## 득점 포인트

- directory entry와 inode identity를 나누고 `a,b → inode42` 및 link count 2 상태를 제시합니다.
- unlink가 이름 하나만 제거해 다른 link와 열린 FD를 즉시 없애지 않는다는 수명 차이를 설명합니다.
- stat의 device·inode·link count를 함께 관찰해 mount 범위까지 확인합니다.

## 감점 포인트

- hard link를 내용 복사로 설명하거나 파일명 삭제가 열린 FD를 즉시 닫는다고 말하면 안 됩니다.
- inode 번호만 전역 유일하다고 가정하면 다른 mount의 object identity를 오판합니다.
- 마지막 pathname 제거와 실제 reclaim 시점을 하나의 사건으로 단정하지 않습니다.

## 더 파고들 거리

- 로그 회전에서 삭제된 열린 inode가 공간을 점유할 수 있다는 운영 비용을 설명합니다.
- 새 이름에 create한 파일은 새 inode이므로 옛 FD의 대상이 바뀌지 않는지 확인합니다.
- Linux reference 수명 설명과 POSIX 공통 보장 범위를 구분합니다.
