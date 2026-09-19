---
id: inode-hardlink-cross-device
title: >-
  hard link 생성이 EXDEV로 실패하지만 symbolic link는 됩니다. hard link가 filesystem 경계를 넘을 수
  없는 이유를 inode와 dentry 관점에서 설명해 보세요?
difficulty: 하
category: 운영체제
tags:
  - hard link
  - EXDEV
  - filesystem
  - inode
related:
  - os-file-descriptor-sharing
---
# hard link 생성이 EXDEV로 실패하지만 symbolic link는 됩니다. hard link가 filesystem 경계를 넘을 수 없는 이유를 inode와 dentry 관점에서 설명해 보세요?

## 구두 답변

hard link는 source inode의 내용을 복사하는 대신 새 directory entry가 같은 filesystem inode를 직접 가리키도록 만드는 연산입니다. 그래서 대상 inode와 새 이름을 관리하는 mounted filesystem 경계를 넘어 link를 만들 수 없고 Linux `link()`는 보통 `EXDEV`를 반환합니다. 주의할 점은 “서로 다른 mount = 반드시 서로 다른 superblock”이라고 말하면 너무 좁다는 것입니다. `link(2)`는 underlying filesystem이 같아도 separate mounts 사이의 link를 거부할 수 있으므로, 원인은 superblock 차이 하나가 아니라 mounted filesystem 경계와 link 정책의 조합으로 설명해야 합니다. `/a/file`과 `/b/file`에서 link 시도가 실패한 뒤 `symlink("/a/file", "/b/ref")`가 성공할 수 있는 이유는 symlink가 inode를 직접 소유하지 않고 target pathname을 저장하기 때문입니다. 이후 `/b/ref`를 열 때 pathname lookup이 `/a` 쪽 mount로 넘어가 target inode를 찾습니다. 그러나 symlink 생성 성공은 target 존재·read 권한·현재 mount 유지까지 보장하지 않습니다. dangling target, traversal 권한, unmount 상태를 open 시점에 다시 검사해야 합니다. “내용이 같으니 hard link도 가능하다”는 추론도 틀립니다. `cp`로 복사하면 새 inode가 생기고 두 파일의 이후 write가 분리됩니다. 검증은 source와 destination의 device·inode를 확인하고, 실제 Linux 환경에서 별도 mount와 같은 underlying filesystem의 separate mount를 각각 시험하는 방식입니다. 이 환경에는 Linux mount 실험을 실행할 수 없으므로 `EXDEV` 결과를 측정했다고 주장하지 않고 `link(2)` 문서의 범위로 한정합니다.

## 득점 포인트

- hard link가 같은 filesystem inode에 dentry를 추가하는 연산이라 mounted filesystem 경계를 넘지 못한다고 설명합니다.
- 별도 mount가 반드시 다른 superblock이라는 과장을 피하고 Linux link(2)의 separate-mount EXDEV도 언급합니다.
- symlink의 pathname 저장과 target 접근 성공 여부를 분리합니다.

## 감점 포인트

- 내용이 같으면 다른 filesystem에도 hard link를 만들 수 있다고 하거나 symlink가 target 권한을 보장한다고 말하면 안 됩니다.
- `EXDEV`를 superblock 차이 하나로만 설명해 same-underlying-filesystem separate mount 사례를 놓치지 않습니다.
- hard link를 파일 내용 복사로 표현하면 이후 write와 inode identity를 잘못 설명하게 됩니다.

## 더 파고들 거리

- device·inode 관찰과 실제 mount 경계 테스트를 함께 계획합니다.
- Linux 실험을 하지 못한 경우 link 성공·실패를 측정했다고 주장하지 않습니다.
- target unmount·dangling path·traversal permission을 symlink open의 별도 실패 조건으로 기록합니다.
