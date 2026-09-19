---
id: inode-symlink-follow
title: >-
  심볼릭 링크의 target 경로가 바뀌면 같은 이름을 열어도 다른 inode가 나옵니다. symlink와 hard link의
  traversal·identity 차이는 무엇인가요?
difficulty: 하
category: 운영체제
tags:
  - inode
  - symbolic link
  - symlink
  - 경로
related:
  - security-path-traversal
---
# 심볼릭 링크의 target 경로가 바뀌면 같은 이름을 열어도 다른 inode가 나옵니다. symlink와 hard link의 traversal·identity 차이는 무엇인가요?

## 구두 답변

symlink는 target inode에 alias를 추가하지 않고 target pathname 문자열을 저장하는 별도 filesystem object입니다. `data → v1`이면 data 자체의 link object와 v1 inode가 서로 다르며 v1의 hard-link count를 올리지 않습니다. `open("data")` 같은 일반 pathname lookup은 symlink를 따라가 v1을 찾으므로, data의 binding을 `v2`로 교체한 뒤 새로 open하면 v2 inode를 얻게 됩니다. 반면 hard link는 `a → inode42`처럼 directory entry가 inode를 직접 가리키므로 다른 이름의 target 문자열을 바꿔도 inode identity가 변하지 않습니다. 시간순으로 보면 첫 open 뒤 `FD1 → v1`, symlink 교체 후 새 open은 `FD2 → v2`, FD1은 여전히 v1입니다. 즉 경로 lookup 시점과 open file reference 수명을 분리해야 합니다. `readlink("data")`는 link 객체 안의 문자열을 반환하고 target을 열지 않지만, `open`은 보통 마지막 component를 follow합니다. 모든 pathname API가 같은 follow 정책을 갖는다고 단정할 수 없고, no-follow 옵션과 보안 검사도 확인해야 합니다. 상대 symlink는 link가 있는 directory를 기준으로 해석될 수 있으며 target이 없거나 권한이 없으면 link 생성은 성공했어도 open은 실패할 수 있습니다. release 디렉터리를 symlink로 바꾸는 운영에서는 원자적인 이름 교체와 target bytes의 내구성을 별도 검증합니다. hard link는 같은 filesystem inode를 공유해 mount 경계를 넘지 못하고, symlink는 pathname lookup이 다른 mount로 넘어갈 수 있지만 target 접근 권한을 보장하지 않는다는 차이가 선택 기준입니다.

## 득점 포인트

- symlink object가 target pathname을 저장하고 hard link가 inode를 직접 가리킨다는 identity 차이를 말합니다.
- `FD1→v1`, link 교체, `FD2→v2`라는 open 시점별 상태를 제시합니다.
- readlink의 문자열 조회와 open의 일반적인 follow 동작을 분리합니다.

## 감점 포인트

- symlink가 target inode의 hard-link count를 증가시킨다거나 기존 FD가 새 target으로 이동한다고 말하면 안 됩니다.
- 모든 pathname API가 항상 follow한다고 단정하지 않고 no-follow 의미를 확인합니다.
- symlink 생성 성공을 target 존재·권한·mount 유지의 증거로 해석하지 않습니다.

## 더 파고들 거리

- 상대 경로 기준 directory와 dangling target을 별도 테스트합니다.
- 원자적인 link 이름 교체와 target bytes의 내구성을 서로 다른 검증으로 둡니다.
- 보안 경로 처리에서는 traversal 권한과 no-follow 옵션까지 확인합니다.
