---
id: snapshot-lifetime
title: 깊은 불변 Snapshot·경로 복사·독자 수명
topic: 설계
summary: 읽기 전용 뷰와 깊은 불변을 구분하고 루트 일회 획득·안전 공개·동시 writer CAS·트리 경로 복사·옛 reader 회수와 메모리 상한을 설명합니다.
questionIds: [immutable-data-sharing, persistent-tree-path-copy, immutable-snapshot-reader-retention]
---

# 깊은 불변 Snapshot·경로 복사·독자 수명

불변 snapshot은 단순히 “읽기 전용 타입”을 만드는 일이 아니라, 한 요청이 같은 root를 읽고 writer가 새 버전을 안전하게 공개하며 reader가 끝날 때까지 옛 버전을 회수하지 않는 수명 계약입니다. 값의 깊은 불변과 root 교체 원자성, 메모리 회수는 각각 따로 검증해야 합니다.

## 참조 불변성과 자식 객체의 깊은 불변

final 참조가 가리키는 목록을 다른 코드가 바꾸면 읽는 설정도 바뀝니다. 읽기 전용 view는 그 view를 통한 변경을 막을 뿐 원본 owner의 변경을 막지 않습니다. 생성 시 외부 가변 입력을 방어적으로 복사하고 중첩 map·list·원소의 변경 경로까지 닫아야 같은 snapshot의 값을 안정적으로 읽을 수 있습니다.

작은 설정은 전체 복사가 단순하고 큰 빈번한 변경은 구조적 공유가 유리할 수 있습니다. 공유 노드가 가변이면 이전 snapshot도 같이 오염되므로 복사 범위보다 불변 계약이 먼저입니다.

검증할 상태 추적은 `root.version` 하나로 충분한지부터 확인하는 것입니다. 요청이 root를 한 번 얻은 뒤 `min`과 `max`를 읽으면 두 값의 version이 같아야 하고, writer CAS가 실패하면 요청을 조용히 덮어쓰지 말고 최신 root에서 다시 계산해야 합니다. 이 검사는 원자 참조 교체가 있다는 사실과 논리적 snapshot 일관성을 구분해 줍니다.

## 단일 Root와 관련 필드의 동일 Version

`v1`의 `min=10,max=20`과 `v2`의 `min=30,max=40`은 각각 유효하지만, 한 요청이 `min`을 v2에서 읽고 `max`를 v1에서 읽으면 `30>20`인 혼합 snapshot이 됩니다. 따라서 요청 시작 시 root를 한 번 얻고 그 root가 가리키는 같은 version에서 관련 필드를 모두 읽어야 합니다. 새 root는 모든 필드를 초기화한 뒤 언어가 보장하는 안전 공개 규칙으로 교체합니다.

두 writer가 같은 `v1`에서 서로 다른 필드를 바꾸면, 각자가 만든 root를 차례로 게시하는 동안 앞선 변경이 뒤의 root에서 사라질 수 있습니다. `expected root/version`을 비교해 현재 root일 때만 교체하는 CAS가 실패하면, 최신 root에서 변경을 다시 계산하거나 writer를 직렬화해야 합니다. 참조 교체 자체가 원자적이어도 여러 필드의 의미가 한 version에서 맞는지는 별도로 보장해야 합니다.

## 변경 Leaf까지의 경로 복사와 subtree 공유

root `R`의 왼쪽 `A` 아래 leaf `L`을 바꿀 때는 새 `L′·A′·R′`만 만들고, 오른쪽의 불변 subtree `B`와 바뀌지 않은 형제는 그대로 공유할 수 있습니다. 높이 `h`인 단순 이진 트리에서는 새로 만드는 경로 노드 수가 `O(h)`이지만, 분기 배열을 복사하거나 rebalance하면 그 비용을 따로 계산해야 합니다. 트리가 불균형하면 `h` 자체가 커질 수 있어 경로 복사가 항상 작은 비용이라는 뜻은 아닙니다.

```diagram
{"title":"옛 Root와 새 Root가 불변 하위 트리를 공유합니다","caption":"화살표는 참조입니다. 새 root는 변경 경로를 새로 만들고 B는 변경되지 않는 불변 subtree이므로 두 버전이 함께 참조할 수 있습니다.","rows":[[{"id":"old","label":"옛 root R"},{"id":"new","label":"새 root R′"}],[{"id":"a","label":"옛 경로 A→L"},{"id":"anew","label":"새 경로 A′→L′"}],[{"id":"b","label":"공유하는 불변 subtree B"}]],"edges":[{"from":"old","to":"a","label":"옛 값"},{"from":"new","to":"anew","label":"변경된 값"},{"from":"old","to":"b","label":"동일 노드 공유"},{"from":"new","to":"b","label":"동일 노드 공유"}]}
```

새 root 게시 뒤에도 옛 root에서 L 값은 그대로이고 새 root에서만 L′을 읽어야 합니다. 단순 shallow copy가 가변 leaf를 공유하는 경우와 다릅니다. 외부 DB·여러 파일 commit은 이 메모리 snapshot 교체와 별도 transaction 문제입니다.

## 옛 Version의 reader 수명과 안전한 회수

reader가 `R`을 읽는 동안에는 옛 root를 메모리에서 회수하면 안 됩니다. GC·참조계수·epoch·hazard pointer 중 무엇을 쓰든, 선택한 언어와 자료구조가 정한 보호 시작·종료 및 회수 계약을 따라야 합니다. epoch 방식에서 장기 reader가 quiescent 상태로 돌아오지 않으면 회수가 계속 막힐 수 있으며, 취소 신호만 보낸 채 강제로 free하면 use-after-free가 됩니다.

| 보유 원인 | 줄이는 방법 |
| --- | --- |
| 긴 reader | 최대 수명·취소·실제 완료 확인 |
| 모든 과거 root 보관 | 감사 version 보관 상한·외부 archive |
| 빠른 writer | 갱신 합치기·rate limit·backpressure |
| 느린 회수 | 구현별 retired bytes·grace period 관측 |

독자 수명·동시 reader·retained bytes·보관 root 수를 함께 제한합니다. 상한에 도달하면 새 작업 수락이나 갱신을 제어해야지 사용 중 메모리를 일방 해제하지 않습니다.

재현 연습으로 reader가 옛 root를 붙잡은 채 writer를 빠르게 1,000회 실행하고, reader가 읽은 모든 쌍의 불변식과 retired bytes를 기록합니다. 예상 결과는 reader가 보는 값이 한 version 안에서 일관되고, 보호가 끝나기 전 옛 노드는 회수되지 않으며, reader가 종료된 뒤에만 retained bytes가 줄어드는 것입니다. 상한을 넘으면 새 갱신을 제어하는지까지 확인합니다.

## 읽기 편의와 Snapshot 전체 비용

한 root 일관성·옛 version 보존·동시 writer 충돌·장기 reader·가변 원소 유입을 시험합니다. 전체 복사와 경로 복사의 할당·GC/참조계수·cache locality·보유량·p99를 실제 패턴에서 비교합니다. 이 노트는 수명 설계이며 실제 epoch/hazard 구현의 성능을 실험한 결과는 아닙니다.
