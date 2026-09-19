---
id: mesi-coherence-consistency
title: MESI 캐시 일관성과 메모리 일관성
topic: 시스템
tags:
  - MESI
  - cache coherence
  - memory consistency
  - cache line
summary: 캐시 라인의 소유·무효화 상태를 관리하는 coherence와 프로그램 관찰 순서를 정하는 memory consistency를 분리합니다.
questionIds: []
prerequisites:
  - cacheline-layout
  - atomic-publication
related:
  - atomic-publication
reviewedAt: '2026-09-19'
---
# MESI 캐시 일관성과 메모리 일관성

멀티코어에서 “메모리를 읽었다”는 말은 한 층의 사실을 가리키지 않습니다. 코어가 가진 캐시 라인이 다른 코어의 복사본과 어떤 관계인지, 그리고 서로 다른 주소의 읽기·쓰기를 프로그램이 어떤 순서로 관찰할 수 있는지는 별도의 계약입니다. 앞의 문제를 **캐시 일관성**(cache coherence), 뒤의 문제를 **메모리 일관성**(memory consistency)이라고 부릅니다. 두 개념을 한데 묶으면 “캐시가 일관되므로 두 플래그의 순서도 보장된다” 같은 잘못된 결론에 도달합니다.

이 장에서는 MESI를 대표적인 상태 모델로 사용합니다. MESI가 모든 CPU의 내부 구현을 그대로 공개하는 표준 상태표라는 뜻은 아닙니다. Intel SDM의 공개 랜딩 페이지는 메모리 순서 관련 참조를 가리키지만, 그 페이지 자체가 특정 제품의 모든 snoop 이벤트와 상태 전이를 규범적으로 열거하지는 않습니다. 따라서 여기서는 M/E/S/I라는 상태의 의미와 전형적인 읽기·쓰기 권한 획득을 설명하고, 실제 이벤트 이름은 대상 마이크로아키텍처의 성능 모니터링 문서로 별도 확인해야 합니다.

## 캐시 라인과 복사본 소유권

캐시 coherence의 단위는 보통 개별 언어 변수보다 **캐시 라인**입니다. `x`와 `y`가 서로 다른 필드라도 같은 라인에 들어가면, 한 코어가 `x`를 쓰는 사건은 `y`만 읽는 코어의 라인 복사본에도 영향을 줄 수 있습니다. 이 때문에 cacheline-layout에서 설명한 false sharing은 자료구조 배치 문제이면서 coherence 소유권 문제입니다.

MESI 상태를 다음처럼 읽으면 됩니다.

| 상태 | 현재 캐시의 의미 | 이 코어의 쓰기 | 다른 코어의 복사본 |
| --- | --- | --- | --- |
| Modified | 이 캐시만 최신이며 메모리와 다를 수 있음 | 바로 쓰기 가능 | 같은 유효 복사본이 없어야 함 |
| Exclusive | 이 캐시만 유효하고 메모리와 일치 | 쓰면서 M으로 전환 가능 | 다른 캐시에 공유 복사본 없음 |
| Shared | 여러 캐시에 읽기 복사본이 있을 수 있고 메모리와 일치하는 모델 | 먼저 독점 권한 필요 | 다른 공유 reader가 존재할 수 있음 |
| Invalid | 이 복사본을 읽을 권한이 없음 | 직접 사용 불가 | 새 라인을 가져와야 함 |

`E`가 있다고 해서 언어 수준에서 자동으로 배타적 객체 소유권이 생기는 것은 아닙니다. 이는 해당 캐시 라인이 현재 다른 캐시와 공유되지 않는다는 하드웨어 상태이지, 포인터를 가진 스레드가 객체를 독점한다는 뜻이 아닙니다. 반대로 `S`라고 해도 여러 코어가 읽는 것 자체가 오류는 아닙니다. 문제는 쓰기를 시작할 때 공유 복사본을 어떻게 정리하느냐입니다.

## 읽기 경로와 상태 전이

초기 상태에서 메모리의 라인 `L`을 코어 A가 읽는다고 합시다. 다른 캐시에 최신 복사본이 없고 메모리에서 라인을 채우면 A는 전형적으로 `E`를 얻을 수 있습니다. A가 읽은 뒤 코어 B도 `L`을 읽으면 A의 `E`는 `S`가 되고 B도 `S`가 됩니다. 이 두 번의 load는 서로의 값을 바꾸지 않으므로 invalidate가 필요하지 않습니다.

이미 A가 `M`인 라인을 B가 읽는 경우에는 더 조심해야 합니다. A의 변경값을 B가 관찰할 수 있도록 소유자나 하위 계층에서 최신 데이터를 제공하고, 두 캐시가 공유 가능한 상태가 되도록 조정합니다. 이 과정의 정확한 버스·디렉터리 메시지 명칭은 구현마다 다를 수 있지만, 핵심 불변식은 “유효한 최신 값이 둘로 갈라져 동시에 존재하지 않는다”입니다.

중간 상태를 표로 쓰면 프로토콜을 추상화해도 추적이 쉬워집니다.

| 시점 | A의 상태 | B의 상태 | 라인 값 | 해석 |
| --- | --- | --- | --- | --- |
| t0 | I | I | 메모리 0 | 캐시에 복사본 없음 |
| t1: A load | E | I | 0 | A만 읽기 권한 |
| t2: B load | S | S | 0 | 읽기 공유 |
| t3: A store 요청 | M 후보 | I 후보 | 1 | B 복사본 무효화가 먼저 필요 |
| t4 | M | I | A의 1 | A가 최신 소유자 |

여기서 t3의 `M 후보`는 store 명령이 소스 코드에 나타났다는 뜻이 아니라, 쓰기 권한 획득이 완료되어야 M이 된다는 설명용 표기입니다. 공유 라인에 쓰려면 A는 다른 공유 복사본을 invalidate하는 요청을 내고, 그 요청이 처리된 뒤 독점적인 쓰기 권한을 얻습니다. 어떤 구현은 읽기와 쓰기를 한 번의 Read For Ownership류 요청으로 결합할 수 있으므로 “항상 정확히 BusUpgr 메시지를 보낸다”고 일반화해서는 안 됩니다.

```diagram
{"title":"공유 읽기에서 쓰기 소유권으로","caption":"S 상태의 두 복사본 중 A가 쓰려면 B의 복사본을 무효화하고 A만 최신 라인을 보유해야 합니다.","rows":[[{"id":"shared","label":"A·B: Shared","detail":["읽기 복사본","같은 값"]}],[{"id":"request","label":"A의 쓰기 권한 요청","detail":["invalidate 전파"]}],[{"id":"owner","label":"A: Modified","detail":["B: Invalid","최신 값 1"]}]],"edges":[{"from":"shared","to":"request","label":"store 시작"},{"from":"request","to":"owner","label":"공유 복사본 무효화"}]}
```

## Store와 snoop 무효화

코어 A가 `S` 상태에서 `x=1`을 수행할 때 B가 가진 라인이 즉시 B의 레지스터에 있는 숫자를 바꾸는 것은 아닙니다. B의 캐시 라인 상태가 `I`가 되고, B가 다음에 그 주소를 load할 때 유효한 복사본이 없다는 사실이 바뀝니다. B의 이전 load 결과가 이미 레지스터나 계산 변수에 복사됐다면 그 값을 하드웨어가 되돌려 고치지 않습니다. coherence는 캐시 복사본의 유효성을 관리하지, 과거에 수행된 명령의 결과를 소급 수정하지 않습니다.

B의 다음 load는 miss 경로를 타고 최신 값을 요청합니다. 최신 값이 A의 `M` 라인에 있다면 A 또는 공유 하위 계층이 데이터를 제공하고, B는 새 복사본을 채웁니다. A가 계속 쓰는 중인지, B가 읽기 공유자가 되는지, write-back 시점이 언제인지는 구현에 따라 달라집니다. 중요한 점은 `I`를 확인한 뒤에도 프로그램이 언제 값을 읽었는지와 어떤 동기화 관계가 있었는지를 별도로 설명해야 한다는 것입니다.

이 구분은 cache miss와 page fault를 나눌 때도 유용합니다. 캐시 miss는 프로세스 주소가 유효한 상태에서 필요한 캐시 라인을 더 아래 계층에서 가져오는 하드웨어 경로입니다. page fault는 페이지 테이블과 접근 권한, 물리 페이지 매핑을 다루는 예외 경로입니다. invalidate 뒤 load가 miss가 됐다고 page fault라고 부를 수 없습니다.

## Coherence와 consistency의 경계

coherence는 한 주소 또는 한 cache line을 시간축으로 보는 계약입니다. 특정 위치에 대한 쓰기들이 서로 무작위로 충돌하지 않고, 코어들이 그 위치의 유효한 값을 관찰할 수 있도록 복사본을 조정합니다. 그러나 `x`와 `y`처럼 서로 다른 위치의 사건을 하나의 전역 순서로 묶어 주는 것은 memory consistency와 언어 메모리 모델의 영역입니다.

대표적인 message-passing 예는 다음과 같습니다.

```cpp
// 초기: data = 0, flag = 0
// Thread A
data = 42;
flag.store(1, std::memory_order_release);

// Thread B
if (flag.load(std::memory_order_acquire) == 1) {
    use(data); // 42를 기대할 수 있는 공개 관계
}
```

A가 `data`를 쓴 뒤 release store를 하고, B가 그 release가 만든 값을 acquire load로 읽는다면 C++ 언어 모델은 앞의 일반 쓰기와 뒤의 일반 읽기를 happens-before로 연결할 수 있습니다. 이것은 coherence가 `data` 라인을 정리했다는 설명보다 강한 언어 수준의 공개 계약입니다. `flag`가 원자라는 이유만으로 relaxed load가 동일한 공개 관계를 만들어 주는 것은 아닙니다.

반대로 두 스레드가 `x`와 `y`에 각각 쓰고 상대 변수를 읽는 store-buffering 모형에서는 각 주소의 coherence가 정상이어도 관찰 순서가 직관과 다를 수 있습니다. 이때 “캐시가 낡았다”로만 진단하지 말고 원자 연산의 memory order, fence, 언어의 data race 여부를 추적해야 합니다. 하드웨어의 허용 순서와 C++ 프로그램이 정의된 실행인지 여부도 같은 질문이 아닙니다.

## 구현 선택과 측정 경계

공유 읽기가 대부분이고 쓰기가 드문 구조라면 읽기 공유를 유지하는 편이 line 이동을 줄일 수 있습니다. 반대로 여러 코어가 같은 line 안의 서로 다른 카운터를 자주 쓰면 padding, 코어별 local aggregation, 작업 분할 변경을 검토합니다. 단, padding은 line 수와 메모리 footprint를 늘리고, local aggregation은 중앙 값의 최신성을 늦추며, 작업 분할 변경은 외부 ID와 인덱스 수명까지 흔들 수 있습니다.

coherence 비용을 확인할 때는 다음처럼 대조합니다.

1. 동일한 입력과 thread placement로 같은 line에 독립 writer를 둡니다.
2. 실제 정렬과 line 경계를 기록한 분리 배치를 비교합니다.
3. writer를 없애거나 코어별 누적 후 합산하여 coherence가 아닌 다른 병목을 분리합니다.
4. wall time, p99, CPU 시간, 지원되는 coherence/cache 이벤트, 메모리 footprint를 함께 기록합니다.
5. 최적화 전후의 결과와 overflow·종료 시 합산을 검증합니다.

단일 miss 카운터가 줄었다고 MESI 전이가 원인이라고 확정할 수 없습니다. 캐시 용량, TLB, NUMA, prefetch, 스케줄러 이동도 바뀌었을 수 있습니다. 실제 CPU에서 이벤트 이름과 의미를 확인하지 못했다면 “invalidate 횟수 감소”가 아니라 “false sharing을 줄이도록 설계한 대조군”이라고 결과를 표현해야 합니다.

## 실패 사례와 검증 절차

첫 번째 실패는 coherence와 원자성을 같은 뜻으로 쓰는 것입니다. 일반 `int`를 여러 스레드가 동시에 쓰면 캐시가 최신 값을 조정하더라도 C++ data race가 사라지지 않습니다. 두 번째 실패는 `M` 상태를 애플리케이션 객체의 논리적 독점권으로 해석하는 것입니다. 다른 코어가 다음 순간 line 권한을 얻을 수 있고, 객체 내부의 여러 필드 불변식은 별도 잠금·원자 공개가 필요합니다.

세 번째 실패는 writer가 store를 실행했으니 모든 코어가 즉시 같은 시각에 새 값을 봤다고 단정하는 것입니다. store buffer, write 권한 획득, fence, acquire 관찰을 각각 표시해야 합니다. 네 번째 실패는 Intel 특정 제품의 이벤트 이름을 모든 x86 또는 모든 ARM의 MESI 구현에 적용하는 것입니다. 프로토콜 계열, 디렉터리 설계, inclusive 여부, 이벤트 의미는 대상 CPU 문서를 기준으로 좁혀야 합니다.

검증용 작은 모델에서는 A와 B의 상태를 수기로 놓고 `load`, `store`, `invalidate`, `refetch`를 한 단계씩 기록합니다. 언어 수준 테스트는 동일한 예제를 relaxed와 release/acquire로 나누고, 결과 한 번이 아니라 정의된 동기화 관계를 검사합니다. 실행을 하지 않은 경우에는 “설명용 상태 추적과 예상 결과”라고 표시해야 하며 특정 CPU에서 문제가 재현되지 않았다는 사실을 보장으로 사용하지 않습니다.

## 참고자료와 범위

- Intel, *Intel 64 and IA-32 Architectures Software Developer’s Manual*, Vol. 3A, version 092로 연결되는 공식 랜딩 페이지. 메모리 순서 참조의 출발점으로 확인했지만, 랜딩 페이지 본문만으로 특정 CPU의 MESI 이벤트 전체를 검증하지 않았습니다.
- 저장소의 `notes/performance/cacheline-layout.md`. false sharing, read-only sharing, padding과 측정 대조군을 비교하는 기존 설명을 바탕으로 하되 MESI 상태 머신과 consistency 층위를 확장했습니다.
- 저장소의 `notes/concurrency/atomic-publication.md`. release/acquire와 객체 수명은 언어·동기화 계약이며 coherence 상태 자체와 다르다는 대조에 사용했습니다.

이 노트에서 “전형적인 MESI 전이”라고 쓴 부분은 상태 의미를 설명하기 위한 모델입니다. 구현별 snoop 메시지, 특정 CPU의 store buffer drain 시점, 실제 PMU 이벤트를 말할 때는 해당 프로세서의 읽을 수 있는 매뉴얼과 측정 결과를 추가로 확인해야 합니다.

### 참고 경로

- [https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)

위 링크는 개념별 참고 경로이며, 본문에서 명시한 확인 범위와 미확인 구현 조건을 함께 적용합니다.
