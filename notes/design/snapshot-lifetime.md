---
id: snapshot-lifetime
title: 깊은 불변 Snapshot·경로 복사·독자 수명
topic: 설계
summary: 읽기 전용 뷰와 깊은 불변을 구분하고 루트 일회 획득·안전 공개·동시 writer CAS·트리 경로 복사·옛 reader 회수와 메모리 상한을 설명합니다.
questionIds: [immutable-data-sharing, persistent-tree-path-copy, immutable-snapshot-reader-retention]
---

# 깊은 불변 Snapshot·경로 복사·독자 수명

## 참조를 바꿀 수 없다고 자식 객체도 불변은 아닙니다

final 참조가 가리키는 목록을 다른 코드가 바꾸면 읽는 설정도 바뀝니다. 읽기 전용 view는 그 view를 통한 변경을 막을 뿐 원본 owner의 변경을 막지 않습니다. 생성 시 외부 가변 입력을 방어적으로 복사하고 중첩 map·list·원소의 변경 경로까지 닫아야 같은 snapshot의 값을 안정적으로 읽을 수 있습니다.

작은 설정은 전체 복사가 단순하고 큰 빈번한 변경은 구조적 공유가 유리할 수 있습니다. 공유 노드가 가변이면 이전 snapshot도 같이 오염되므로 복사 범위보다 불변 계약이 먼저입니다.

## 관련 필드는 한 번 얻은 Root에서 읽습니다

v1의 min=10,max=20과 v2의 min=30,max=40은 각각 유효합니다. min을 v2에서, max를 v1에서 읽으면 30>20의 혼합이 생깁니다. 요청이 root를 한 번 얻고 관련 필드를 같은 version에서 읽어야 합니다. 새 root는 완전히 초기화한 뒤 언어의 안전 공개 규칙에 따라 교체합니다.

두 writer가 같은 v1에서 다른 필드를 바꾸면 마지막 root 게시가 앞선 변경을 잃을 수 있습니다. expected root/version CAS 실패 시 최신 root에서 변경을 재계산하거나 writer를 직렬화합니다. 참조 교체의 원자성과 여러 필드의 의미 일관성을 구분합니다.

## 바뀐 Leaf까지의 경로만 복사합니다

root R의 왼쪽 A 아래 leaf L을 바꾸면 새 L′·A′·R′을 만들고 오른쪽 불변 subtree B와 바뀌지 않은 형제는 공유할 수 있습니다. 높이 h의 단순 이진 트리에서는 경로 노드 수가 O(h)지만 분기 배열 복사·rebalance가 있으면 실제 비용을 따로 계산합니다. 불균형 트리는 h가 커질 수 있습니다.

```diagram
{"title":"옛 Root와 새 Root가 불변 하위 트리를 공유합니다","caption":"화살표는 참조입니다. 새 root는 변경 경로를 새로 만들고 B는 변경되지 않는 불변 subtree이므로 두 버전이 함께 참조할 수 있습니다.","rows":[[{"id":"old","label":"옛 root R"},{"id":"new","label":"새 root R′"}],[{"id":"a","label":"옛 경로 A→L"},{"id":"anew","label":"새 경로 A′→L′"}],[{"id":"b","label":"공유하는 불변 subtree B"}]],"edges":[{"from":"old","to":"a","label":"옛 값"},{"from":"new","to":"anew","label":"변경된 값"},{"from":"old","to":"b","label":"동일 노드 공유"},{"from":"new","to":"b","label":"동일 노드 공유"}]}
```

새 root 게시 뒤에도 옛 root에서 L 값은 그대로이고 새 root에서만 L′을 읽어야 합니다. 단순 shallow copy가 가변 leaf를 공유하는 경우와 다릅니다. 외부 DB·여러 파일 commit은 이 메모리 snapshot 교체와 별도 transaction 문제입니다.

## 옛 Version은 오래됐다는 이유로 강제 해제할 수 없습니다

살아 있는 reader가 R을 읽는 동안 메모리를 유지해야 합니다. GC·참조계수·epoch·hazard pointer 등 선택한 언어/자료구조의 실제 보호·회수 계약을 따릅니다. epoch에서 장기 reader가 quiescent 상태로 돌아오지 않으면 회수가 막힐 수 있습니다. 취소 신호만 보내고 강제로 free하면 use-after-free가 생깁니다.

| 보유 원인 | 줄이는 방법 |
| --- | --- |
| 긴 reader | 최대 수명·취소·실제 완료 확인 |
| 모든 과거 root 보관 | 감사 version 보관 상한·외부 archive |
| 빠른 writer | 갱신 합치기·rate limit·backpressure |
| 느린 회수 | 구현별 retired bytes·grace period 관측 |

독자 수명·동시 reader·retained bytes·보관 root 수를 함께 제한합니다. 상한에 도달하면 새 작업 수락이나 갱신을 제어해야지 사용 중 메모리를 일방 해제하지 않습니다.

## 읽기 편의와 전체 비용을 같이 비교합니다

한 root 일관성·옛 version 보존·동시 writer 충돌·장기 reader·가변 원소 유입을 시험합니다. 전체 복사와 경로 복사의 할당·GC/참조계수·cache locality·보유량·p99를 실제 패턴에서 비교합니다. 이 노트는 수명 설계이며 실제 epoch/hazard 구현의 성능을 실험한 결과는 아닙니다.
