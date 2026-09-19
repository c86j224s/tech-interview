---
id: mount-propagation-direction
title: >-
  bind mount한 디렉터리에서 하위 mount를 만들었습니다. mount propagation 설정에 따라 호스트에 무엇이 보일 수
  있는지 어떻게 검증하나요?
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
# bind mount한 디렉터리에서 하위 mount를 만들었습니다. mount propagation 설정에 따라 호스트에 무엇이 보일 수 있는지 어떻게 검증하나요?

## 구두 답변

bind mount와 mount propagation은 서로 다른 계약입니다. bind는 경로를 다른 mount namespace에 노출할 뿐이고, 하위 mount·unmount 사건이 호스트로 전달되는지는 부모 mount의 속성이 결정합니다. private이면 사건이 peer로 자동 전달되지 않습니다. shared peer group이면 peer 사이에 사건이 양방향으로 전파될 수 있고, slave는 master에서 받은 사건을 전달하지만 slave에서 master로 되돌려 보내지 않습니다. 이는 mount tree 사건의 방향이지, 같은 inode에 대한 `write(2)`를 막거나 복제하는 규칙은 아닙니다. 설명용으로 호스트 `/srv/data`를 컨테이너 `/data`에 bind하고 `/data/child`에 tmpfs를 만들겠습니다. private이면 child mount는 컨테이너 tree에만 생깁니다. shared peer이면 호스트 대응 peer에도 child mount가 보일 수 있습니다. slave이면 호스트에서 만든 child가 컨테이너에 보일 수 있어도 컨테이너 사건이 호스트로 역전파된다고 말하지 않습니다. 실제 명령 성공 결과가 아닌 상태 trace입니다. 검증은 양쪽 `/proc/<pid>/ns/mnt` 링크를 먼저 저장하고, `/proc/<pid>/mountinfo`에서 mount ID·parent ID와 `shared:`·`master:` 표식을 bind 직후와 child 생성 직후에 비교합니다. 호스트에서 안 보였다는 결과만으로 private라고 단정하지 않고 반대 방향 사건도 시험합니다. rootfs를 분리해도 쓰기 가능한 bind inode는 남으므로 mount propagation과 파일 내용 권한을 별도 체크합니다. 기본값은 runtime 설정에 좌우될 수 있어 `mountinfo`를 최종 증거로 삼겠습니다.

## 득점 포인트

- shared·slave·private의 전파 방향을 mount 사건과 파일 내용 쓰기로 정확히 분리합니다.
- mountinfo의 shared/master 표식과 bind 전후 스냅샷을 사용해 양방향을 검증합니다.
- runtime 기본값을 추정하지 않고 실제 mount tree를 최종 증거로 둡니다.

## 감점 포인트

- bind mount면 하위 mount가 언제나 호스트로 올라간다고 단정합니다.
- slave를 양방향 shared처럼 설명하거나 파일 write 전파와 mount propagation을 같은 현상으로 취급합니다.
- 컨테이너 rootfs가 별도라는 이유로 공유 inode의 쓰기 권한도 사라진다고 말합니다.

## 더 파고들 거리

- shared peer group이 여러 namespace에 걸칠 때 unmount 사건의 관찰 순서를 어떻게 설계하겠습니까?
- user namespace의 mount 권한과 propagation 속성이 모두 허용되지 않을 때 실패 원인을 어떤 로그로 나누겠습니까?
