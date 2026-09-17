---
id: concurrent-ownership
title: 동시 참조 획득과 안전한 회수
topic: 동시성
summary: 유효한 소유 참조의 원자 증감과 raw pointer 승격을 분리하고 hazard·epoch 회수와 lock-free 진행성의 실제 경계를 설명합니다.
questionIds: []
prerequisites: [reference-counting-foundations, synchronization-foundations]
related: [cpp-shared-ownership, condition-variables, cancellation, deadlock]
reviewedAt: '2026-09-17'
---

# 동시 참조 획득과 안전한 회수

## 동시 수명 문제의 두 층위

동시 소유권에는 서로 다른 두 문제가 있습니다. 첫째는 이미 유효한 소유 참조를 복사하거나 놓을 때 카운트를 안전하게 바꾸는 일입니다. 둘째는 아직 소유하지 않은 raw pointer를 읽은 뒤 새 strong 소유로 승격하려는 순간 객체가 사라지지 않게 하는 일입니다.

첫 번째 문제를 해결하는 원자 카운트만으로 두 번째 문제를 해결할 수 없습니다. raw pointer를 읽고 카운트를 증가시키기 전에 다른 스레드가 마지막 strong을 해제하면, 증가 연산 자체가 이미 수명이 끝난 관리 상태를 읽게 됩니다. 카운트가 원자라는 말과 그 카운트를 읽을 저장 공간이 살아 있다는 말은 별개입니다.

또한 객체를 안전하게 살려 둔 뒤에도 객체 필드의 복합 불변식은 별도 동기화가 필요합니다. 수명 보호, 데이터 공개, 자료구조 링크 변경을 하나의 “원자 연산”으로 뭉뚱그리지 않고 각 경계를 증명합니다.

## 유효한 strong 복사의 조건

이미 strong 소유자인 A가 같은 소유권을 B에게 넘기는 경우를 생각합니다. A가 유효한 소유 구간 안에서 B를 만들고, B가 확정된 뒤 A를 놓는 순서라면 count의 증가·감소는 관리 상태의 수명 안에서 수행됩니다. 이때도 증가 연산의 메모리 순서와 대상 필드 공개는 별도 계약입니다.

일부 검증된 참조 카운트 구현은 이미 소유권이 확보된 증가에 relaxed, 감소에 release, 마지막 감소에서 acquire fence 또는 동등한 경계를 사용합니다. 그러나 이 조합을 모든 intrusive·shared 구현의 보편 정답으로 복사해서는 안 됩니다. deleter, control block, 객체 공개, 회수 방식이 함께 증명되어야 합니다.

C++ Working Draft의 relaxed 설명은 해당 연산이 메모리 순서를 만들지 않는다고 합니다. 따라서 relaxed 증가가 새 객체 데이터를 공개하거나 다른 스레드의 필드 변경을 보호한다고 말할 수 없습니다. 공개는 release/acquire나 잠금 같은 별도 관계로 설계합니다.

## Raw Pointer 승격 경쟁

raw pointer를 보유한 reader와 마지막 owner를 놓는 remover의 순서를 숫자로 적으면 문제가 선명해집니다.

| 시점 | reader | remover | 객체 상태 |
| --- | --- | --- | --- |
| T1 | root에서 A 주소 읽음 | 대기 | strong=1, A 사용 가능 |
| T2 | 아직 count 증가 전 | 마지막 strong release | disposal 시작 또는 완료 |
| T3 | A의 count 증가 시도 | 관리 상태 해제 | 증가 대상 저장 공간이 무효일 수 있음 |
| T4 | A dereference | 새 객체가 같은 주소 사용 가능 | UAF 또는 잘못된 세대 |

reader가 T1에서 A를 읽었다는 사실은 A의 생존권을 예약하지 않습니다. `expired()`를 먼저 검사하고 raw pointer를 저장해도 검사 뒤 마지막 release가 올 수 있습니다. weak 참조가 이미 관리 상태와 연결되어 있다면 `lock()`처럼 성공 여부와 strong 확보를 하나의 원자적 조건부 연산으로 처리하는 API를 사용합니다.

raw pointer만 제공하는 lock-free 자료구조에서는 hazard pointer, epoch 구간, 잠금 또는 그에 준하는 보호 규칙으로 먼저 사용 의사를 등록하고 원본을 재검사해야 합니다. 현재 확인 자료에는 이를 그대로 복사할 수 있는 완성 구현이나 특정 라이브러리의 protected-load API가 없으므로, 아래 코드는 교육용 의사코드입니다.

## Unlink와 Reclaim의 분리

자료구조에서 노드를 unlink하는 것은 새 탐색이 그 노드로 들어가지 않게 링크를 바꾸는 일입니다. reclaim은 이미 포인터를 읽은 모든 독자가 사용을 끝내 저장 공간을 free하거나 재사용해도 되는 상태로 만드는 일입니다. 이 두 순간을 합치면 CAS 성공 뒤 이전 독자의 역참조가 use-after-free가 될 수 있습니다.

```diagram
{"title":"제거와 회수의 분리","caption":"unlink는 논리적 도달 경로를 끊고, reclaim은 이전 독자의 보호가 끝난 뒤에만 저장 공간을 회수합니다.","rows":[[{"id":"linked","label":"연결 상태","detail":["새 독자가 접근 가능"]}],[{"id":"unlinked","label":"분리 상태","detail":["retired 목록에 보관"]}],[{"id":"protected","label":"독자 보호 확인","detail":["hazard·epoch·lock 종료"]}],[{"id":"free","label":"회수·재사용","detail":["이전 참조 불가"]}]],"edges":[{"from":"linked","to":"unlinked","label":"링크 변경"},{"from":"unlinked","to":"protected","label":"회수 스캔"},{"from":"protected","to":"free","label":"안전 조건 충족"}]}
```

ABA는 A를 읽은 사이 A가 제거되고 다른 값으로 바뀌었다가 같은 주소 A로 돌아와 비교·교환이 성공하는 현상입니다. 주소와 세대를 함께 비교하면 일부 논리 재사용을 감지할 수 있지만, CAS 전에 이미 해제된 노드의 `next`를 읽는 문제를 고치지는 않습니다. 세대 태그와 메모리 수명 보호는 서로 대체재가 아닙니다.

## hazard pointer의 보호 절차

Hazard pointer는 각 reader가 곧 사용할 노드 주소를 보호 슬롯에 게시하고, 회수기가 그 슬롯에 나타난 노드를 free하지 않도록 하는 방식입니다. reader가 root를 읽은 직후 게시하기 전에 writer가 회수할 수 있으므로, 게시한 뒤 root를 다시 읽어 같은 후보인지 확인합니다.

```text
의사코드입니다. memory order, thread registration, scan, allocator 재사용은 검증된 구현 계약이 필요합니다.
repeat:
    candidate = load_root_using_verified_contract()
    if candidate == null:
        return empty
    publish_hazard(candidate)
    current = reload_root_using_verified_contract()
    if candidate == current:
        break
    clear_hazard()
use_protected_node(candidate)
clear_hazard()
```

후보가 달라졌으면 후보의 필드를 읽지 않고 hazard를 지운 뒤 다시 시작합니다. 여러 노드의 `next`를 따라가야 하면 슬롯 수와 게시 순서를 함께 관리해야 합니다. hazard는 unlink를 막기보다 보호된 노드의 reclaim을 늦추므로, retired 바이트와 회수 스캔 비용을 운영 지표로 둡니다.

이 의사코드는 교육용 상태 순서를 보여 줄 뿐 컴파일 가능한 lock-free 구현이 아닙니다. 게시 store, root 재읽기, 회수기 scan, 메모리 재사용 사이의 순서가 빠지면 같은 모양의 코드도 안전하지 않습니다. 특정 플랫폼의 라이브러리 계약이나 검증된 구현 없이 직접 복사하지 않습니다.

## epoch와 오래된 독자

epoch 방식은 reader가 읽기 구간에 들어갔음을 등록하고, 그 구간이 시작되기 전의 retired 노드를 볼 수 있는 독자들이 모두 끝난 뒤 회수하는 모델입니다. 매 포인터마다 hazard를 게시하는 비용을 줄일 수 있지만 오래 멈춘 reader 하나가 많은 retired 메모리를 붙잡을 수 있습니다.

| 방식 | 보호 단위 | 비용과 실패 양상 |
| --- | --- | --- |
| strong ownership | 개별 객체 생존 | 참조 전달·마지막 release·순환 |
| hazard pointer | 개별 포인터 | 슬롯 게시·재검사·scan |
| epoch 계열 | 읽기 구간 | 오래된 reader가 회수 지연 |
| 일반 mutex | 임계 구역 | 경합·교착·긴 대기 |

정확한 epoch와 RCU 변형은 서로 같은 구현이 아닙니다. reader가 오래 멈췄다는 이유로 실제 실행이 끝나지 않은 노드를 강제로 free할 수 없습니다. 읽기 구간 안에서 무기한 I/O를 하지 않도록 경계를 줄이고, `oldest_reader`, `retired_bytes`, `reclaim_latency`를 함께 수집합니다.

## lock-free 진행성의 범위

C++의 lock-free 계약은 특정 atomic 함수 실행에서 막히지 않은 실행 스레드가 계속 진행하면 연산이 완료되는 성질을 가리킵니다. 이는 모든 호출자가 제한된 단계 안에 끝난다는 뜻이 아니며, OS 스케줄링에 따른 벽시계 deadline도 아닙니다. 확인한 표준 초안 발췌에서는 wait-free의 정확한 보장 문장을 확보하지 못했으므로 이 장에서 특정 C++ 표준 문구로 확정하지 않습니다.

핵심 CAS loop가 lock-free여도 전체 API에 malloc, free, deleter, 로그, callback, epoch 등록이 들어가면 그 부분에서 막힐 수 있습니다. 회수기가 메모리 상한을 지키려고 대기하거나 allocator가 경합하면 “자료구조의 갱신 loop는 lock-free”와 “API 호출 전체가 lock-free”는 다른 주장입니다.

따라서 선택 기준은 CAS 성공률 하나가 아닙니다. 일반 mutex가 목표 p99를 만족하는지 먼저 비교하고, lock-free가 필요하다면 최장 독자, retired 메모리, 재시작 횟수, 회수 지연, allocator 대기, 개별 reader의 기아를 함께 측정합니다. 측정하지 않은 구현 정의 속성은 운영 보장으로 적지 않습니다.

## Treiber stack의 수명 시나리오

Treiber stack의 top이 A이고 A의 next가 B라고 하겠습니다. T1은 top=A를 읽고 멈춥니다. T2는 A를 pop해 retired에 넣고 B를 pop한 뒤, allocator가 같은 주소를 새 노드 C에 재사용했다고 가정합니다.

T1이 hazard 게시 전에 A의 next를 읽으면 이미 회수된 저장 공간을 읽는 UAF입니다. 주소만 비교하는 CAS를 수행하면 top이 `A(old) → B → A(new)`으로 돌아온 뒤 T1의 CAS가 성공할 수 있어 ABA입니다. 태그를 붙여도 T1이 A의 내용을 읽는 수명 문제는 남습니다.

보호 프로토콜을 적용한 예상 순서는 다음과 같습니다.

1. T1이 root 후보 A를 읽지만 아직 역참조하지 않는다.
2. T1이 hazard 슬롯에 A를 게시한다.
3. T1이 root를 다시 읽어 후보가 여전히 A인지 확인한다.
4. 불일치하면 A의 필드를 읽지 않고 재시작한다.
5. 일치하면 보호된 A의 next를 읽고 CAS를 시도한다.
6. 사용이 끝난 뒤 hazard를 지우고, 회수기는 슬롯을 다시 확인한 뒤 retired A를 회수한다.

여기서 2~3단계의 원자성·가시성, 회수기의 scan 시점, 주소 재사용 금지는 구현마다 증명해야 합니다. 이 장의 상태 순서는 그 증명을 대신하지 않습니다.

## 경쟁 상태의 진단 순서

재현 시험에서는 reader를 root 읽기 직후, hazard 게시 직후, root 재검사 직후에 멈춥니다. 그 사이 writer가 unlink·retire·주소 재사용을 수행하게 하고, reader가 어떤 보호 없이 필드를 읽었는지, 재검사 실패 뒤 재시작했는지 기록합니다.

weak 승격 시험에서는 마지막 strong release와 `lock()`을 동시에 걸어 한쪽만 strong을 얻고 다른 쪽은 실패하는지 확인합니다. 성공한 strong의 사용 구간이 끝나기 전에 disposal이 실행되지 않아야 하며, 실패한 쪽이 죽은 control block을 되살리려 하지 않아야 합니다.

종료 시험에서는 회수기 자체가 멈추거나 오래된 reader가 남는 경우를 넣습니다. 메모리 상한이 넘으면 새 작업 수락을 제한할지, 일반 잠금으로 후퇴할지, reader 구간을 분할할지 정책을 정합니다. 강제 free로 숫자를 맞추는 것은 수명 증명이 아닙니다.

ASan·TSan·모델 검사기는 UAF와 일부 경쟁을 발견하는 데 도움을 줄 수 있지만, 도구가 통과한 실행만으로 모든 메모리 순서와 allocator 계약을 증명하지 않습니다. 이 문서에서는 별도 구현이나 경쟁 시험을 실행하지 않았습니다.

## 선택의 운영 경계

공유 작업이 객체의 생존을 실제로 책임지는 동안에는 strong ownership이 가장 직접적인 설명이 될 수 있습니다. 자료구조에서 링크만 빠르게 바꾸고 독자의 보호 구간을 짧게 유지해야 한다면 hazard·epoch 같은 회수 프로토콜을 검토합니다. 단순히 포인터 증가를 빠르게 만들기 위해 raw promotion을 허용하면 가장 어려운 수명 경쟁을 API 사용자에게 떠넘깁니다.

운영 문서에는 “언제 unlink되는가”, “언제 새 독자가 접근할 수 없는가”, “언제 이전 독자가 모두 끝났다고 판단하는가”, “누가 free와 deleter를 실행하는가”를 각각 적습니다. 마지막 질문에 callback이나 외부 자원 정리가 포함되면 그 실행자가 blocking할 수 있다는 사실도 진행성 판정에 포함합니다.

## 참고 자료와 검증 범위

- C++ Working Draft `atomics.order`, <https://eel.is/c++draft/atomics.order>, 2026-09-17 확인. fetch가 식별한 snapshot은 `c7015b485cc3db8efaa9dfb9ff0809c5394a4ed1`이며 발행 ISO 판본·최신성은 확인하지 않았습니다. relaxed에 memory ordering이 없고 release sequence와 acquire 관계가 있다는 설명에 사용했습니다.
- C++ Working Draft `intro.progress`, <https://eel.is/c++draft/intro.progress>, 2026-09-17 확인. 같은 snapshot 식별 정보를 확인했으며 lock-free 진행성 설명에 사용했습니다. 제공된 발췌에는 wait-free 정의가 없어 정확한 표준 계약으로 쓰지 않았습니다.
- C++ Working Draft `util.smartptr.weak`, <https://eel.is/c++draft/util.smartptr.weak>, 2026-09-17 확인. `weak_ptr::lock`의 원자적 승격과 `expired` 검사 한계를 사용했습니다. 발행 판본과 최신성은 확인하지 않았습니다.
- C++ Working Draft `util.smartptr.atomic`, <https://eel.is/c++draft/util.smartptr.atomic>, 2026-09-17 확인. atomic shared/weak ownership 연산의 draft 근거로만 사용했으며, 구 URL `util.smartptr.shared.atomic`은 제거 안내와 404 결과였으므로 사용하지 않았습니다. lock-free 여부가 implementation-defined인 세부는 대상 라이브러리에서 측정하지 않았습니다.
- 기존 `safe-reclamation` 노트의 hazard·epoch 상태 모델을 교육용 설명의 출발점으로 사용했습니다. 해당 모델은 특정 구현의 memory-order proof, thread registration, allocator 비차단성 증거가 아닙니다.
- 이 장의 의사코드와 Treiber stack 시나리오는 실제 컴파일·부하·경쟁 시험을 실행한 결과가 아닙니다. hazard·epoch를 그대로 복사할 수 있는 플랫폼 API로 제시하지 않았으며, 대상 라이브러리와 allocator 계약을 추가 검증해야 합니다.
