---
id: safe-reclamation
title: Lock-free 노드의 ABA와 안전한 회수
topic: 동시성
summary: 링크 제거·주소 재사용·역참조를 분리하고 hazard 게시 재검사·epoch 지연·진행 보장의 범위를 설명합니다.
questionIds: [lock-free-aba-reclamation, hazard-pointer-publish-recheck, epoch-stalled-reader-memory, wait-free-lock-free-progress]
---

# Lock-free 노드의 ABA와 안전한 회수

## CAS 성공은 메모리가 살아 있다는 증거가 아닙니다

스택 top의 주소 A를 읽은 스레드가 멈춘 사이 다른 스레드가 A를 제거·해제하고 같은 주소에 새 노드를 만들 수 있습니다. 첫 스레드는 주소가 같다는 이유로 CAS에 성공해도 객체의 정체성과 연결은 달라졌을 수 있습니다. 값이 A에서 다른 값으로 갔다가 A로 돌아오는 **ABA**입니다.

더 빠른 문제도 있습니다. CAS를 하기 전에 이미 해제된 A의 next를 읽으면 그 순간 use-after-free입니다. 주소·세대를 함께 CAS하는 태그는 논리 재사용을 감지할 수 있지만 이미 끝난 메모리 수명을 연장하지 않습니다.

## 제거와 회수 사이에 보호 단계를 둡니다

```diagram
{"title":"리스트에서 빠진 노드도 독자가 사용할 수 있습니다","caption":"화살표는 노드 수명의 단계입니다. unlink는 새 조회 경로에서 제거하는 일이고 reclaim은 이전 독자가 더 이상 쓰지 않는 것을 확인한 뒤 수행합니다.","rows":[[{"id":"linked","label":"자료구조에 연결됨"}],[{"id":"retired","label":"unlink 후 retired","detail":["옛 독자의 참조 가능"]}],[{"id":"safe","label":"보호 독자 없음 확인"}],[{"id":"free","label":"메모리 회수·재사용"}]],"edges":[{"from":"linked","to":"retired","label":"CAS로 링크 변경"},{"from":"retired","to":"safe","label":"회수 프로토콜"},{"from":"safe","to":"free","label":"안전한 종결"}]}
```

retired 목록에 넣기만 해도 안전한 것은 아닙니다. 어떤 독자가 어떤 참조를 가질 수 있는지 확인하는 회수 프로토콜이 필요합니다. 디버그 순회나 통계 조회도 같은 보호를 따라야 합니다.

## Hazard pointer는 게시한 뒤 원본을 다시 봅니다

독자가 top을 읽고 hazard 슬롯에 게시하기 전에 writer가 그 노드를 회수할 수 있습니다. 따라서 읽은 포인터를 즉시 역참조하지 않고 보호 게시 후 현재 링크가 같은지 다시 검사합니다.

```text
repeat:
    candidate = load_root_using_library_contract()
    publish_hazard(candidate)
    current = reload_root_using_library_contract()
until candidate == current
# 검증된 회수 알고리즘의 순서·재사용 전제 아래에서만 역참조
use_protected_node(candidate)
clear_hazard()
```

이것은 메모리 순서를 생략한 교육용 단계이며 그대로 복사할 lock-free 구현이 아닙니다. 게시 store·원본 재읽기·reclaimer의 scan 사이 순서와 주소 재사용 조건은 검증된 라이브러리의 계약을 따라야 합니다. candidate가 달라졌으면 그 포인터의 내용을 읽지 않고 다시 시작합니다.

hazard는 unlink를 막는 것이 아니라 보호된 노드의 reclaim을 늦춥니다. 여러 노드를 동시에 참조하면 필요한 슬롯 수와 이동 중 보호 순서를 관리해야 합니다. 포인터 태그가 유한하면 wrap 가능성도 고려합니다.

## Epoch는 오래된 독자가 빠져나오길 기다립니다

epoch 기반 회수는 독자가 읽기 구간에 들어갔음을 표시하고, 제거된 노드를 볼 수 있는 이전 구간 독자들이 모두 끝난 뒤 회수합니다. 매 노드 hazard 게시 비용을 줄일 수 있지만 오래 멈춘 독자 하나가 많은 retired 메모리를 붙잡을 수 있습니다.

| 방식 | 독자 비용 | 회수 지연 요인 |
| --- | --- | --- |
| Hazard pointer | 참조별 게시·재검사 | 보호 슬롯·scan 비용 |
| Epoch/RCU 계열 | 읽기 구간 등록·종료 | 오래 머무는 독자·grace period |
| 일반 잠금 | 획득·경합 | 긴 임계 구역·대기 |

정확한 RCU·epoch 변형은 서로 다르므로 같은 구현이라고 보지 않습니다. 독자를 시간 초과시켰다고 실제 실행이 종료되기 전 노드를 강제 free할 수 없습니다. 읽기 구간을 짧게 하고 그 안에서 무기한 I/O를 하지 않도록 설계하며, retired bytes와 가장 오래된 독자를 관찰합니다.

## 메모리 상한과 진행성을 함께 봅니다

회수가 멈췄는데 writer가 계속 새 노드를 만들면 메모리가 무한히 증가할 수 있습니다. 새 작업 수락·갱신을 제한하거나 회수 방식·읽기 분할을 바꿀 수 있지만 그 선택이 전체 API의 진행 보장을 바꿀 수 있습니다. 안전성을 위해 대기한다면 그것을 숨기고 전체 함수가 언제나 lock-free라고 주장하지 않습니다.

Lock-free는 시스템 전체의 어떤 연산이 계속 완료되는 진행 성질이지 모든 스레드가 제한된 단계 안에 끝난다는 뜻은 아닙니다. Wait-free는 개별 연산의 단계 상한을 더 강하게 요구합니다. 둘 다 OS가 스레드를 언제 스케줄할지 포함한 벽시계 deadline 보장은 아닙니다. 할당기·회수·로그·콜백이 blocking이면 핵심 CAS 루프의 성질과 전체 API의 성질이 달라집니다.

## 회수 오류는 주소 재사용과 정지를 넣어 찾습니다

독자를 포인터 읽기 직후·hazard 게시 직후·검사 직후 멈추고 writer가 제거·재사용하도록 시험합니다. epoch 독자를 오래 유지한 채 갱신 부하를 주어 retired 메모리와 원본 처리량을 관찰합니다. ASan·TSan·모델 검사 등 도구는 도움되지만 테스트 통과가 모든 메모리 모델 실행의 증명은 아닙니다.

성능 목표를 일반 잠금 구조가 만족한다면 직접 회수 프로토콜을 증명하는 비용을 피하는 것이 합리적일 수 있습니다. CAS 성공률이 아니라 안전한 수명·최악 지연·메모리와 개별 기아까지 비교해야 합니다.
