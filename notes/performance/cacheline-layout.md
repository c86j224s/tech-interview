---
id: cacheline-layout
title: Cache Line 공유·AoS·SoA의 접근 비용
topic: 성능
summary: true/false sharing·읽기 공유·coherence를 구분하고 주소·padding 대조·local aggregation·AoS/SoA의 필드 사용·ID 수명을 설명합니다.
questionIds: [cpu-cache-false-sharing, cache-readonly-sharing-versus-writes, false-sharing-evidence-experiment, performance-cache-locality-layout]
---

# Cache Line 공유·AoS·SoA의 접근 비용

메모리 배치 최적화는 자료구조 이름보다 실제 접근과 쓰기 소유권을 설명하는 일에서 시작합니다. 같은 변수를 함께 쓰는 true sharing, 다른 변수가 같은 cache line을 쓰는 false sharing, 읽기만 공유하는 경우를 분리하고, 배치 변경의 이득을 footprint와 결과 정확성까지 포함해 측정해야 합니다.

## 독립 카운터와 동일 Cache Line의 소유권 이동

코어 A가 `counter[0]`, 코어 B가 `counter[1]`만 쓰더라도 두 주소가 같은 cache line에 있으면, 한 코어가 쓸 때 다른 코어의 line 복사본을 무효화하고 소유권을 다시 가져오는 일이 반복될 수 있습니다. 논리적으로 다른 변수가 coherence 단위인 cache line을 함께 써서 생기는 이 현상을 **false sharing**이라고 합니다.

반대로 같은 counter 하나를 여러 코어가 원자 증가하는 경우는 **true sharing**이므로, 주소가 다른지와 변수 자체를 공유하는지를 나눠 봅니다.

atomic 증가라면 그 메모리 접근 자체는 C++ data race가 아니어도 coherence·직렬화 비용이 있습니다. 비원자 같은 counter 증가는 정확성 문제까지 더해집니다. lock이 없다는 사실이 캐시 경쟁이 없다는 뜻은 아닙니다.

| 접근 | 공유 형태 | 주요 비용 |
| --- | --- | --- |
| 같은 변수 여러 writer | true sharing | 원자·lock·line 이동 |
| 독립 변수 같은 line에 writer | false sharing | 불필요한 line 소유권 이동 |
| 같은 line을 읽기만 | read-only sharing | cache miss·대역폭·NUMA, 쓰기 무효화와 다름 |
| 분리 line·각자 쓰기 | 독립 쓰기 후보 | 더 큰 footprint·최종 합산 |

두 카운터의 논리 값이 같아지는지만 보면 false sharing을 놓칩니다. 같은 작업량에서 주소를 line 경계 밖으로 분리했을 때 wall time·coherence 이벤트가 함께 줄고 결과가 유지되는지 비교해야 하며, 줄지 않으면 miss 원인을 용량·NUMA·배치 불균형으로 계속 열어 둡니다.

## Cache Miss와 false sharing의 원인 구분

`cache miss` 하나가 관측됐다고 false sharing을 확정할 수는 없습니다. 같은 연산량으로 (1) 카운터 쓰기를 없앤 경우, (2) 두 카운터를 실제 cache line 경계 밖으로 분리한 경우, (3) local 합산을 한 경우를 비교하면서 필드 주소·정렬·실제 line 크기·thread placement를 함께 기록합니다. miss가 용량·충돌·첫 접근·원격 NUMA에서 생겼을 가능성도 남기고, hardware counter는 아키텍처가 지원하는 이벤트와 그 의미, 샘플링 오차를 확인해 해석합니다.

```diagram
{"title":"독립 쓰기라도 같은 Coherence 단위일 수 있습니다","caption":"화살표는 쓰기 대상입니다. 두 논리 카운터가 한 line에 있으면 독립 변수 간에도 line 소유권 이동이 생길 수 있습니다.","rows":[[{"id":"a","label":"코어 A · counter[0]"},{"id":"b","label":"코어 B · counter[1]"}],[{"id":"line","label":"같은 cache line","detail":["서로 다른 카운터 포함"]}]],"edges":[{"from":"a","to":"line","label":"독립 변수 쓰기"},{"from":"b","to":"line","label":"독립 변수 쓰기"}]}
```

padding은 자주 쓰는 독립 필드를 line 경계로 분리할 수 있지만 객체 크기·LLC·TLB footprint를 늘립니다. 모든 구조체에 무조건 padding을 넣지 않습니다. C++의 hardware_destructive_interference_size 같은 지원값도 구현·빌드·배포 환경의 계약을 확인하고 ABI 영향을 고려합니다.

## Local 집계의 공유 비용·최신성 교환

worker가 자기 로컬 숫자에 누적하고 일정 주기로 합치면 공유 쓰기를 줄일 수 있습니다. 하지만 집계 시점까지 중앙 통계가 늦고 합산의 동기화·worker 종료·overflow를 관리해야 합니다. 정확한 현재 잔액과 근사 통계는 같은 방식으로 처리할 수 없습니다.

line을 분리해도 NUMA 원격 메모리·memory bandwidth·작업 불균형·true sharing이 남을 수 있습니다. 같은 data placement와 pinning 조건으로 비교하고 바뀐 footprint까지 측정합니다. 최종 처리량·p99·정확성으로 판단합니다.

## AoS·SoA의 필드 접근 묶음

AoS는 `{x,y,health,name,...}` 객체들을 배열에 두고, SoA는 x 배열·y 배열·health 배열처럼 같은 필드를 모읍니다. 위치만 대량 갱신할 때 큰 AoS는 필요 없는 필드를 cache line에 함께 가져올 수 있고 SoA는 연속 데이터·SIMD에 유리할 수 있습니다. 객체 하나의 모든 필드를 사용하는 로직은 AoS의 지역성이 더 자연스러울 수 있습니다.

pointer 배열은 객체 이동을 줄일 수 있지만, 포인터를 따라가는 간접 참조와 흩어진 할당 때문에 prefetch가 어려워지는 비용이 생길 수 있습니다. **AoSoA**는 여러 원소를 작은 묶음으로 나눈 뒤 각 묶음 안에서는 필드별 배열을 쓰는 혼합 구조이지만, 작은 성능 측정(microbenchmark) 하나로 전체 설계를 바꾸지는 않습니다. 실제 필드 사용률·분기·순회·삭제·최대 크기를 같은 입력 조건에서 비교해야 어떤 배치가 맞는지 판단할 수 있습니다.

## 배치 변경과 논리 ID·객체 수명

SoA에서 삭제 후 마지막 원소를 옮기면 모든 필드 배열의 같은 인덱스가 같은 객체를 가리켜야 합니다. ID→index 매핑·generation·외부 핸들 무효화·비동기 참조를 함께 갱신합니다. 성능을 위해 배열만 바꾸고 원래 소유·동시성 규칙을 놓치면 데이터가 섞입니다.

배치별 worker partition도 두 worker가 인접 원소 line을 나눠 쓰는 경계에서 false sharing을 만들 수 있습니다. 작업 단위·chunk 크기·읽기/쓰기 패턴과 데이터 배치를 함께 검토합니다.

선택은 microbenchmark의 단일 평균이 아니라 대표 입력의 결과 일치, throughput, p99, memory footprint를 함께 놓고 합니다. 예를 들어 padding으로 시간이 줄어도 메모리 증가가 캐시 용량을 넘어 전체 입력에서 역전될 수 있으므로, 작은 배열과 실제 규모 배열을 같은 배치·thread placement로 반복해야 합니다.

## 결과 일치와 하드웨어 근거 비교

단일·다중 worker, 같은 line·분리 line, 읽기 전용·쓰기, AoS·SoA를 대표 입력으로 비교합니다. CPU time·wall time·coherence·cache miss·bandwidth·메모리·TLB·전체 지연을 기록합니다. 현재 작업에서는 hardware counter나 false-sharing 성능 실험을 수행하지 않았습니다. 본문은 원인 구분과 대조 설계입니다.
