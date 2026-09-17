---
id: reference-counting-foundations
title: 객체 참조 카운팅과 소유권
topic: 동시성
summary: strong·weak 소유 그래프와 shared·intrusive 구현을 따라가며 순환 참조, 마지막 해제, 객체 회수의 경계를 설명합니다.
questionIds: []
prerequisites: [programming-language-foundations]
related: [atomic-publication, safe-reclamation, arc-ownership, java-resource-reachability]
reviewedAt: '2026-09-17'
---

# 객체 참조 카운팅과 소유권

## 수명 문제의 출발점

힙 객체는 이름이 아니라 참조 경로로 사용됩니다. 어떤 작업이 객체의 주소를 들고 있다는 사실만으로는 그 주소가 가리키는 저장 공간이 계속 유효하다고 말할 수 없습니다. 마지막 소유자가 사라지는 순간을 정하고, 그 뒤에는 누구도 객체를 읽지 않는다는 규칙이 필요합니다.

참조 카운팅은 객체를 소유하는 참조의 수를 세어 마지막 소유 참조가 사라질 때 정리 작업을 시작하는 방식입니다. 여기서 카운트는 대상 객체의 모든 필드 접근을 보호하는 잠금이 아니며, 객체가 공유 상태를 안전하게 변경한다는 뜻도 아닙니다.

이 장에서 `strong`은 대상의 생존을 유지하는 소유 참조, `weak`는 생존을 연장하지 않는 관찰 참조로 부르겠습니다. 소유권을 나타내지 않고 잠시 사용하는 `borrowed` 참조도 구분합니다. borrowed 참조는 그것을 빌려준 strong 참조가 살아 있는 구간 안에서만 유효합니다.

## 소유 그래프의 기본 단위

객체를 노드로, 참조를 방향 있는 선으로 그리면 수명을 숫자보다 먼저 이해할 수 있습니다. strong 선은 대상이 살아 있어야 한다는 책임을 추가하고, weak 선은 대상이 없어질 수 있음을 허용합니다. 외부 요청·작업 큐·타이머도 객체를 잡고 있다면 그래프의 노드로 기록해야 합니다.

```diagram
{"title":"소유와 관찰의 그래프","caption":"strong 선은 대상의 생존을 연장하고 weak 선은 관찰만 합니다. borrowed 사용은 이를 빌려준 strong 소유자의 구간 안에서만 허용됩니다.","rows":[[{"id":"service","label":"서비스","detail":["작업을 강하게 보유"]}],[{"id":"task","label":"작업","detail":["실제 종료까지 생존"]}],[{"id":"callback","label":"완료 관찰자","detail":["화면은 weak로 관찰"]},{"id":"screen","label":"화면","detail":["없으면 표시 생략"]}]],"edges":[{"from":"service","to":"task","label":"strong 소유"},{"from":"task","to":"callback","label":"완료까지 보유"},{"from":"callback","to":"screen","label":"weak 관찰"}]}
```

예를 들어 화면이 서비스를 strong으로 보유하고 서비스가 작업을 strong으로 보유한다고 합시다. 작업의 완료 관찰자가 화면을 weak로만 가리키면 화면이 닫혀도 작업은 계속됩니다. 작업이 종료되면 서비스의 작업 슬롯과 완료 관찰자를 제거하고, 그때 마지막 strong이 사라지는지 확인합니다.

반대로 작업이 완료 관찰자 안에서 화면을 strong으로 캡처하면 `화면 → 서비스 → 작업 → 관찰자 → 화면` 고리가 생길 수 있습니다. 화면 계층에서 화면을 제거해도 고리 안의 strong 선이 남으므로 참조 카운팅만으로는 이 고리를 자동으로 끊을 수 없습니다.

## Strong과 Weak의 상태 전이

교육용 상태 모델에서는 대상 객체와 소유 카운트, 관찰 카운트를 따로 적습니다. 구현마다 내부 레이아웃과 카운트 초기값은 다를 수 있으므로 아래 표는 표준 라이브러리의 숨은 구조를 복사한 것이 아니라 수명 관계를 추적하기 위한 모델입니다.

| 상태 | strong 수 | weak 관찰 | 읽기 가능성 | 다음 책임 |
| --- | ---: | ---: | --- | --- |
| 생성 직후 | 1 | 0 | 소유자만 가능 | 소유 참조 복사 또는 이동 |
| 소유자 복사 | 2 이상 | 0 이상 | 각 strong 구간에서 가능 | 각 소유자가 한 번 release |
| 마지막 strong 직전 | 1 | 0 이상 | 마지막 owner 구간에서 가능 | deleter 또는 disposal 시작 |
| strong 소멸 뒤 | 0 | 0 이상 | 대상 사용 불가 | weak는 관찰 실패만 허용 |
| weak까지 소멸 | 0 | 0 | 대상·관리 상태 모두 회수 가능 | control state 해제 |

strong 수가 0이 되었다는 표현은 모든 참조 카운팅 구현에서 같은 소멸 함수가 즉시 실행된다는 뜻으로 확대하지 않습니다. 일반적인 shared ownership에서는 마지막 owning reference가 deleter 또는 disposal을 시작하는 조건으로 설명하고, 실제 destructor 호출·외부 자원 정리·저장 공간 반환은 런타임과 deleter의 계약으로 확인해야 합니다. Python C API도 마지막 strong reference 뒤 type deallocation function이 호출될 수 있고 그 과정에서 임의의 코드가 실행될 수 있다고 설명하므로, 마지막 감소를 단순한 숫자 갱신으로 취급하지 않습니다. 따라서 마지막 release의 실행자와 cleanup의 재진입·blocking 가능성도 수명 설계에 포함합니다.

weak 관찰자가 대상의 존재를 먼저 묻고 나중에 raw pointer를 사용하면 검사와 사용 사이에 마지막 strong이 사라질 수 있습니다. 따라서 weak를 strong으로 승격하는 연산이 제공된다면 그 연산이 성공한 뒤 얻은 임시 strong의 사용 구간에서만 접근해야 합니다. `expired` 같은 관찰 결과만으로 이후 사용의 안전성을 만들 수는 없습니다. 임시 strong을 확보할 수 없는 weak 관찰은 “없음”이라는 결과를 반환하는 경로로 끝내야 합니다.

## Shared와 Intrusive의 구조 차이

shared 방식은 대상 객체와 소유 관리 상태를 별도의 control block으로 연결하는 모델입니다. control block에는 strong·weak 상태, deleter, 할당 관련 정보가 있을 수 있지만 이 배치와 카운트 표현은 표준이 보장하는 공개 레이아웃이 아닙니다. weak 참조가 대상 객체보다 오래 남을 수 있는 이유도 이 관리 상태를 별도로 유지할 수 있기 때문입니다.

intrusive 방식은 대상 객체 내부에 참조 카운트를 넣고 포인터 형식의 복사·해제 연산이 그 카운트를 조작하는 모델입니다. 객체 레이아웃이 소유 관리와 결합되므로 메모리 배치와 hook 구현 책임이 호출자 쪽으로 더 많이 이동합니다. Boost의 `intrusive_ptr` 문서는 embedded count와 `intrusive_ptr_add_ref`·`intrusive_ptr_release` hook을 설명하지만, 모든 intrusive 구현의 weak 정책이나 메모리 순서를 정해 주지는 않습니다.

| 선택 | 관리 상태 위치 | 장점 | 설계 부담 |
| --- | --- | --- | --- |
| 단일 소유 | 소유자와 객체 관계에 직접 표현 | 수명과 해제가 단순함 | 공유가 필요하면 전달 규칙 추가 |
| shared ownership | 외부 control block 모델 | 여러 작업이 같은 수명을 유지 | control block 비용·마지막 해제 위치 |
| intrusive ownership | 객체 내부 카운트 모델 | 별도 관리 객체를 줄일 여지 | 객체 수정·hook·ABI 결합 |
| weak 관찰 | 관리 상태의 관찰 경로 | 순환의 역방향을 끊음 | 승격 실패 처리와 관찰 부재 처리 |

소유자가 한 명뿐인데 shared를 선택하면 수명 책임이 흐려질 수 있습니다. 반대로 작업 여러 개가 실제로 같은 버퍼의 생존을 책임져야 한다면 단순 raw pointer 전달보다 명시적인 shared 소유가 설명하기 쉽습니다. 성능을 이유로 intrusive를 택할 때도 count 증감, overflow, 회수, 객체 필드 동기화를 별도 계약으로 적어야 합니다.

## 순환 참조와 회수 경계

순환 참조는 카운트가 틀린 것이 아니라 그래프의 외부 도달성이 끊겨도 내부 strong 선이 남는 현상입니다. 부모가 자식을 strong으로 소유하고 자식이 부모를 strong으로 소유하면 외부 root가 사라진 뒤에도 두 노드의 카운트가 각각 1일 수 있습니다.

해결 방법은 그래프의 강한 방향을 순환 없는 구조로 제한하거나, 역방향을 weak로 두거나, 명시적인 `close`로 관계를 끊거나, 별도의 cycle collector를 사용하는 것입니다. 어떤 방법을 고를지는 작업이 끝났다는 의미와 객체가 더는 관찰될 수 없다는 의미가 같은지에 달려 있습니다.

`unlinked`와 `freed`도 서로 다른 상태입니다. 자료구조에서 링크를 끊었다는 것은 새 조회 경로에서 노드를 찾지 못하게 했다는 뜻이지, 이전 독자가 사용하는 일이 끝났다는 뜻은 아닙니다. strong 소유가 남아 있다면 객체는 계속 살아 있을 수 있고, strong이 없더라도 hazard·epoch 같은 회수 규칙이 없으면 저장 공간을 곧바로 재사용할 수 없습니다.

```diagram
{"title":"참조 카운트와 회수의 경계","caption":"마지막 strong 소멸은 대상 정리의 시작점이고, weak 관리 상태와 이전 독자 보호는 별도의 회수 조건입니다.","rows":[[{"id":"owned","label":"strong 소유 중","detail":["대상 사용 가능"]}],[{"id":"disposed","label":"대상 정리 시작","detail":["새 strong 불가"]},{"id":"observed","label":"weak 관찰 중","detail":["승격 실패 가능"]}],[{"id":"retired","label":"자료구조에서 분리","detail":["옛 독자 가능"]}],[{"id":"reclaimed","label":"저장 공간 회수","detail":["모든 보호 종료"]}]],"edges":[{"from":"owned","to":"disposed","label":"마지막 strong release"},{"from":"disposed","to":"observed","label":"관리 상태만 잔존 가능"},{"from":"observed","to":"reclaimed","label":"weak 소멸"},{"from":"retired","to":"reclaimed","label":"회수 조건 충족"}]}
```

## 작업 수명과 결과 수명

결제·파일 저장처럼 화면이 사라져도 끝나야 하는 작업은 화면을 작업의 유일한 strong owner로 두지 않습니다. 서비스, 작업 관리자, 내구 큐 중 하나가 실제 작업과 버퍼의 수명을 보유하고, 화면은 weak 관찰자로 결과를 표시할 수 있을 때만 표시합니다.

반대로 화면 갱신처럼 화면이 없으면 의미가 없는 작업은 weak 관찰이 실패해도 정상적인 종료 결과일 수 있습니다. 이 경우에도 네트워크 요청이나 타이머가 버퍼를 참조한다면 화면의 weak 여부만 보고 버퍼를 해제하면 안 됩니다. 실제 I/O가 끝나는 시점과 메모리를 반환하는 시점을 기록해야 합니다.

다음 순서로 한 작업을 추적하면 숫자와 의미를 함께 확인할 수 있습니다.

1. 서비스가 작업을 등록하며 strong=1을 만든다.
2. 완료 관찰자가 작업 핸들을 복사해 strong=2가 된다.
3. 화면이 닫히면서 관찰자의 weak 승격은 실패할 수 있지만 작업 strong은 유지된다.
4. 실제 저장과 네트워크 종료가 끝난 뒤 관찰자와 서비스 슬롯이 각각 release된다.
5. 마지막 strong release가 disposal을 시작하고, 남은 weak가 있으면 관리 상태만 유지한다.
6. 마지막 weak가 사라지고 이전 독자 보호도 끝난 뒤 관리 상태나 저장 공간을 회수한다.

## 필드 동기화와 운영 관찰

참조 카운트가 원자적이어도 `balance`, 연결 목록, 작업 상태 같은 대상 필드의 복합 불변식은 보호되지 않습니다. 필드가 바뀐다면 mutex, 직렬 실행자, 원자 snapshot 또는 깊은 불변 객체 중 하나를 선택해야 합니다. 하나의 카운터가 보호하는 범위를 문서에서 객체 수명과 객체 내용으로 나누어 적습니다.

운영에서는 객체 ID, strong·weak 보유자, 작업 종료 시각, disposal 시작·종료 시각, 마지막 관찰자, 외부 효과 확정 여부를 함께 기록합니다. 화면을 열고 닫는 동안 deinit 횟수가 한 번인지 보는 것만으로는 실제 결제가 완료되었다는 증거가 되지 않습니다.

순환만 남긴 경우, weak 관찰자가 먼저 사라지는 경우, 마지막 strong release가 다른 실행자에서 일어나는 경우, disposal 중 재진입하는 경우를 별도로 재현합니다. ASan·TSan 같은 도구는 보조 증거이지, 그래프의 논리적 cycle 해소나 외부 효과의 정확성을 자동으로 증명하지 않습니다.

## 참고 자료와 검증 범위

- C++ Working Draft `util.smartptr.atomic`, <https://eel.is/c++draft/util.smartptr.atomic>, 2026-09-17 확인. fetch가 식별한 snapshot은 `c7015b485cc3db8efaa9dfb9ff0809c5394a4ed1`이며 발행 ISO 판본과 최신성은 확인하지 않았습니다. atomic 소유 연산과 count·소멸 순서의 근거로만 사용했습니다.
- C++ Working Draft `util.smartptr.weak`, <https://eel.is/c++draft/util.smartptr.weak>, 2026-09-17 확인. `weak_ptr::lock`의 원자적 조건부 승격과 `expired`의 한계를 사용했으며, control block 레이아웃 근거로 사용하지 않았습니다. 발행 판본은 확인하지 않았습니다.
- Boost.SmartPtr `intrusive_ptr`, <https://www.boost.org/doc/libs/release/libs/smart_ptr/doc/html/smart_ptr.html#intrusive_ptr>, 2026-09-17 확인. release 문서의 revision log가 Boost 1.90.0까지 보였지만 해당 페이지의 정확한 release pin은 확인하지 않았습니다. embedded count와 사용자 hook 설명에만 사용했습니다.
- Python 3.14 Reference Counting C API, <https://docs.python.org/3.14/c-api/refcounting.html>, Python 3.14.7 documentation, 2026-09-17 확인. 마지막 strong reference 뒤 deallocation과 arbitrary code 가능성에 사용했으며 free-threaded 확장 호환성·실제 성능은 검증하지 않았습니다.
- Swift ARC 문서, <https://docs.swift.org/swift-book/documentation/the-swift-programming-language/automaticreferencecounting/>, 2026-09-17 확인. strong·weak·순환 참조 계약을 사용했으며 정확한 Swift release number는 페이지에서 확인하지 않았습니다.
- 이 장의 본문과 상태표는 교육용 모델로 작성했으며 참조 카운트 구현이나 경쟁 테스트를 실행하지 않았습니다. 특정 control block 배치, intrusive weak 정책, 성능 수치는 확정하지 않았습니다.
