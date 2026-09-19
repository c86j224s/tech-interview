---
id: inode-link-semantics
title: 파일시스템 inode·hard link·symbolic link
topic: 운영체제
summary: 디렉터리 이름과 inode를 분리하고 hard link·symbolic link·unlink·열린 파일 수명의 차이를 설명합니다.
questionIds: []
prerequisites:
  - file-state
  - execution-boundaries
related:
  - file-state
  - file-publication
reviewedAt: '2026-09-19'
---
# 파일시스템 inode·hard link·symbolic link

경로명은 파일의 정체성 자체가 아니라 directory entry가 inode를 찾기 위한 이름입니다. inode에는 파일 유형·권한·소유자·크기·link count 같은 metadata가 있고, 여러 directory entry가 하나의 inode를 가리킬 수 있습니다. hard link는 그 alias를 직접 추가하지만 symbolic link는 target pathname을 저장하는 별도 객체입니다. 이 차이를 잡아야 unlink 뒤 열린 FD, symlink 교체, 다른 filesystem의 `EXDEV`를 한 모델로 설명할 수 있습니다.

## pathname과 dentry

`/srv/data/a`를 여는 동안 커널은 각 구성 요소를 directory entry로 조회합니다. Linux VFS에서 dentry는 pathname lookup 결과를 캐시하는 객체이고 inode는 filesystem entity를 나타냅니다. 따라서 “파일명과 inode가 같다”고 말하면 이름 binding과 object identity가 섞입니다. dentry cache가 있다고 해서 모든 pathname lookup이 영구적으로 같은 결과를 준다는 뜻도 아닙니다.

directory에 `a`, `b`가 있고 둘 다 inode 42를 가리키면 두 이름이 같은 data와 inode metadata를 공유합니다. 확인할 때 `stat`의 device와 inode를 함께 봅니다. inode 번호만 다른 mount까지 가로질러 전역 유일하다고 해석하지 않습니다.

## hard link와 link count

hard link 생성은 같은 filesystem namespace에 inode 42를 가리키는 directory entry를 하나 더 붙이는 연산입니다. `a`의 link count가 1일 때 `link("a", "b")`가 성공하면 count가 2가 되고, `unlink("a")` 뒤에도 `b`로 동일한 data를 읽습니다. 파일 내용을 복사한 것이 아니라 하나의 inode에 이름을 추가한 것이므로 한 이름으로 metadata를 바꾸면 공유 object에 영향을 줍니다.

마지막 directory entry를 제거해 count가 0이 되어도 열린 file reference가 남으면 data를 곧바로 회수하지 않을 수 있습니다. open file object가 inode와 dentry에 대한 참조를 유지하기 때문입니다. 실제 reclaim 시점은 filesystem과 다른 참조에 의존하므로 “이름이 사라짐”과 “data가 회수됨”을 같은 사건으로 말하지 않습니다.

```diagram
{"title":"이름 제거와 inode 수명은 분리됩니다","caption":"두 dentry가 하나의 inode를 가리킵니다. unlink는 이름 binding을 줄이지만 열린 참조가 남으면 data 접근이 계속될 수 있습니다.","rows":[[{"id":"namea","label":"dentry a"},{"id":"nameb","label":"dentry b"}],[{"id":"ino","label":"inode 42","detail":["data · metadata · link count"]}],[{"id":"openref","label":"open file reference","detail":["경로 제거 뒤에도 보유"]}]],"edges":[{"from":"namea","to":"ino","label":"alias"},{"from":"nameb","to":"ino","label":"alias"},{"from":"ino","to":"openref","label":"open 보유"}]}
```

## symbolic link과 traversal

symlink는 target inode에 alias를 추가하지 않고 target pathname 문자열을 담는 별도 filesystem object입니다. `data -> v1`이면 data link 객체와 v1 inode가 다릅니다. `open("data")`는 일반적으로 symlink를 따라 target을 다시 lookup하므로 현재 binding이 결과를 정합니다. Linux VFS는 이 traversal을 filesystem의 `get_link` 경로로 설명합니다.

`readlink("data")`는 link 객체의 문자열을 읽고, `open("data")`는 보통 target을 follow합니다. 마지막 component를 follow하지 않는 API와 보안 옵션도 있으므로 모든 pathname API가 같은 규칙이라고 단정하지 않습니다. symlink의 생성 성공도 target 존재·권한을 보장하지 않으며 dangling link와 permission failure를 따로 처리합니다.

## 이름 교체와 열린 FD

`data -> v1`을 `data -> v2`로 교체하면 link object의 directory binding이 바뀝니다. 이미 `open("data")`를 성공한 FD는 lookup 당시 얻은 대상에 대한 reference를 사용하므로 이후 새 open이 v2를 얻어도 기존 FD가 소급해 이동하지 않습니다. 반대로 교체 뒤 새 open은 v2를 선택합니다. 이 차이가 path, dentry, inode, open file object의 수명을 나눕니다.

rename의 원자적 이름 변경은 독자가 중간 이름을 보지 않게 하는 성질이지 target bytes와 directory 내구를 동시에 확정하는 연산이 아닙니다. 여러 파일을 한 세트로 공개해야 하면 버전 디렉터리와 manifest를 사용해 집합의 일관성과 내구를 별도 설계합니다.

## unlink와 log rotation

reader가 `open("log")`으로 inode 42를 잡은 뒤 다른 프로세스가 `unlink("log")`하면 새 lookup에서는 log가 없지만 기존 FD는 남은 data를 읽을 수 있습니다. 새 `log`를 만들면 새 FD는 새 inode를 얻고 옛 writer는 자동으로 이동하지 않습니다. 그래서 로그 회전 뒤 삭제된 열린 파일이 디스크 공간을 계속 차지할 수 있습니다.

설명용 상태는 `a,b,FD -> inode 42`에서 `unlink(a)` 후 `b,FD`, 다시 `unlink(b)` 후 `FD`만 남는 순서입니다. link count는 directory name reference를 반영하고 open reference는 다른 수명 축입니다. 모든 내부 counter의 정확한 값과 reclaim 시점은 특정 Linux filesystem 관찰로 확인해야 합니다.

## filesystem 경계와 EXDEV

hard link는 현재 filesystem의 directory entry가 같은 filesystem inode를 직접 가리켜야 하므로 다른 mounted filesystem 경계를 넘을 수 없습니다. Linux `link(2)`는 underlying filesystem이 같더라도 separate mounts 사이 link를 거부할 수 있으므로, “다른 mount이면 반드시 다른 superblock”이라고 좁혀 말하지 않습니다. `EXDEV`는 mount 경계와 filesystem identity를 함께 확인해야 하는 오류입니다. 내용이 같은 파일을 복사하면 새 inode가 생길 뿐 identity를 공유하지 않습니다.

symlink는 pathname을 저장하므로 target lookup이 다른 mount로 넘어갈 수 있습니다. 하지만 symlink 생성이 target 접근 성공을 보장하지는 않습니다. 상대 경로 기준 directory, dangling target, mount 해제, 권한을 별도 판단합니다.

## 검증과 범위

작은 Linux 실험에서는 hard link 전후 `stat`의 device·inode·link count를 비교하고, symlink에 `readlink`와 `open`을 각각 적용합니다. 기존 FD를 유지한 채 이름을 제거한 뒤 기존 read와 새 path open을 비교하면 namespace removal과 open reference가 분리됩니다. 서로 다른 mount에서 hard link와 symlink를 시도해 identity와 pathname의 차이도 확인할 수 있습니다.

이 문서에서는 실험을 실행하지 않았습니다. 근거는 Linux `inode(7)`과 Linux VFS 문서이며, VFS는 구현 인터페이스이지 모든 POSIX 환경의 내부 객체 수명을 규정하는 문서가 아닙니다. 기존 `file-state`가 FD·mmap·rename 내구를 다루는 것과 겹치지 않도록 이 장은 pathname-to-inode binding과 link identity를 중심으로 합니다.


## 관찰 가능한 상태와 참조

작은 상태표로 보면 이름과 객체가 분리됩니다. 처음에는 `a -> inode42`, `b -> inode42`, `link_count=2`, `FD -> inode42`입니다. `unlink(a)` 뒤에는 `b -> inode42`, `link_count=1`, `FD -> inode42`가 남습니다. 이어서 `unlink(b)`를 실행하면 pathname entry는 0개가 되지만 FD reference가 유지되어 reader는 같은 열린 객체를 계속 사용할 수 있습니다. 새로 `open("b")`하는 시도는 실패하고, 같은 이름을 새로 `create`하면 그것은 다른 inode가 됩니다. `stat`에서 device와 inode를 함께 기록해야 하며, inode 번호만으로 서로 다른 mount의 identity를 비교하면 안 됩니다.

## 구현 선택과 실패 비용

hard link는 내용 복사 없이 하나의 inode에 alias를 추가하므로 동일 파일의 metadata와 쓰기를 공유해야 할 때 유리합니다. 반면 원본 이름만 지우는 cleanup이 충분하다고 오해하면 삭제된 열린 로그가 디스크를 계속 점유합니다. symlink는 release 디렉터리나 다른 mount를 가리키는 배포 방식에 유연하지만, 상대 경로 기준과 dangling target, 권한·경로 traversal을 별도 검증해야 합니다. `readlink`와 `open`을 섞은 테스트는 link 문자열과 target 접근을 구분해 기록해야 합니다. 이 장의 VFS 설명은 Linux 구현 인터페이스에 근거하며, POSIX가 모든 내부 dentry와 reclaim 시점을 동일하게 노출한다고 확장하지 않습니다.

### 참고 경로

- [https://man7.org/linux/man-pages/man7/inode.7.html](https://man7.org/linux/man-pages/man7/inode.7.html)
- [https://www.kernel.org/doc/html/latest/filesystems/vfs.html](https://www.kernel.org/doc/html/latest/filesystems/vfs.html)

위 링크는 개념별 참고 경로이며, 본문에서 명시한 확인 범위와 미확인 구현 조건을 함께 적용합니다.
