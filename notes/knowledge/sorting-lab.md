---
id: sorting-lab
title: 비교 정렬 다섯 가지의 계약과 추적
topic: 알고리즘
summary: 병합·힙·삽입·선택·버블 정렬을 같은 비교 계약과 trace로 구현하고 안정성·다중집합·최악 입력을 실행 가능한 테스트로 구분합니다.
questionIds: []
prerequisites: [sorting-foundations, algorithm-strategies]
related: [sort-stability, heap]
reviewedAt: '2026-09-18'
---

# 비교 정렬 다섯 가지의 계약과 추적

## 학습 목표

이 노트의 목적은 정렬 알고리즘 이름을 암기하는 데 있지 않습니다. 먼저 결과의 계약을 고정하고, 같은 비교자와 같은 입력에서 병합 정렬·힙 정렬·삽입 정렬·선택 정렬·버블 정렬의 상태 전이를 추적한 뒤, 결과 순서·입력 다중집합·동점 순서·비용을 서로 다른 검증 항목으로 확인하는 데 있습니다.

실습 코드는 [정렬 알고리즘 실습 코드](https://github.com/c86j224s/tech-interview/tree/main/examples/knowledge/sorting-lab/)의 `sorting_lab.py`에 있습니다.

## 기본 모델

정렬 입력을 유한 수열 `A[0..n)`으로 둡니다. 비교자 `cmp(a,b)`는 `a`가 `b`보다 작으면 음수, 같으면 0, 크면 양수를 반환한다고 정의합니다. 결과 `B`가 정렬됐다는 조건은 모든 인접 쌍에 `cmp(B[i], B[i+1]) <= 0`인 것입니다. 그러나 이 조건만으로는 원소를 잃거나 복제한 결과를 잡을 수 없으므로 `Counter(A) == Counter(B)`라는 다중집합 보존 조건을 함께 검사합니다.

비교자는 알고리즘 바깥의 계약입니다. strict weak ordering에서는 자기 자신보다 작지 않고, 앞섬 관계가 비대칭이며, 앞섬 관계가 추이적이어야 하고, 비교상 동등함(incomparability)의 묶음도 추이적이어야 합니다. 서로 다른 두 원소를 모두 순위로 구분해야 할 때는 `(key, input_order)` 같은 보조 키를 넣어 total order를 별도로 정의합니다. 안정 정렬은 비교상 동등한 원소의 입력 상대 순서를 보존하는 성질이지, total order를 자동으로 만들어 주는 성질이 아닙니다.

Python 문서도 `list.sort()`와 `sorted()`가 stable이라고 명시하고, 같은 key를 가진 여러 레코드의 원래 순서를 보존한다고 설명합니다. 또한 key 함수는 입력 레코드마다 한 번 호출된다고 설명하지만, 이 lab은 그 표준 라이브러리의 내부 실행을 재현하지 않고 자체 비교 정렬을 검사합니다. 비교자가 비추이적이면 안정성이나 시간복잡도 주장을 붙이기 전에 입력 계약을 거절해야 합니다.

```diagram
{"title":"결과 계약에서 알고리즘 상태로","caption":"정렬 결과는 순서 하나가 아니라 순서·다중집합·동점 정책을 함께 만족해야 합니다.","rows":[[{"id":"input","label":"입력과 비교자","detail":["키·동점 의미","strict weak ordering"]}],[{"id":"state","label":"알고리즘 불변식","detail":["prefix·heap·두 절반","trace 이벤트"]}],[{"id":"result","label":"결과 계약","detail":["정렬·다중집합","안정성은 별도"]}]],"edges":[{"from":"input","to":"state","label":"계약에 맞춰 전이"},{"from":"state","to":"result","label":"불변식 종료"}]}
```

## 알고리즘별 불변식

### 삽입 정렬

삽입 정렬은 각 반복 시작 시 `[0, i)`가 정렬되어 있다는 불변식을 유지합니다. `A[i]`를 꺼내 왼쪽에서 자신보다 큰 값만 오른쪽으로 밀고 빈 자리에 넣습니다. `cmp(left, value) > 0`일 때만 이동하므로 동등한 키를 건너뛰지 않아 안정성이 유지됩니다. 이미 정렬된 입력에서는 각 새 원소가 한 번의 비교로 제자리를 확인하지만, 역순 입력에서는 앞의 거의 모든 원소를 밀어야 합니다.

### 선택 정렬

선택 정렬은 반복 시작 시 `[0, start)`의 각 위치가 최종적으로 확정됐다고 봅니다. `[start, n)`에서 최솟값의 위치만 기억하고 마지막에 한 번 교환합니다. 비교 횟수는 입력 상태와 무관하게 대략 제곱으로 늘지만, 교환 횟수는 줄일 수 있습니다. 일반적인 교환은 같은 키 레코드의 순서를 뒤집을 수 있으므로 안정성이 필요한 결과에는 그대로 선택하지 않습니다.

### 버블 정렬

버블 정렬은 한 pass의 인접 비교에서 역순 쌍만 교환하여 큰 값 하나를 suffix 끝으로 밀어냅니다. 같은 값은 교환하지 않고, pass에 변경이 없으면 종료합니다. 따라서 이 구현은 안정적이며 이미 정렬된 입력을 빠르게 끝낼 수 있지만, 역순 입력의 비교·이동량은 `O(n²)`입니다. 조기 종료가 최악 상한을 바꾸지는 않습니다.

### 병합 정렬

병합 정렬은 두 절반이 각각 정렬됐다는 전제로 시작합니다. 두 앞 원소 중 작은 쪽을 결과에 붙이면 결과 prefix가 정렬됩니다. `cmp(left[i], right[j]) <= 0`일 때 왼쪽을 먼저 붙이는 한, 두 절반에서 온 동등 키의 순서를 보존합니다. 이 구현은 구간별 출력 list를 사용하므로 추가 공간과 쓰기 비용이 들어갑니다. 시간 상한은 `O(n log n)`이고, 안정성은 병합 시 tie 규칙이 보장할 때만 성립합니다.

### 힙 정렬

힙 정렬은 배열 prefix를 max heap으로 만든 뒤 루트 최댓값을 끝 위치와 교환하고 줄어든 heap을 sift-down합니다. heapify 뒤에는 heap 구간의 루트가 최댓값이고, extraction 반복 뒤에는 `[end, n)`이 최종 오름차순 suffix라는 불변식이 있습니다. 제자리 수준의 공간으로 `O(n log n)` 최악 시간 상한을 얻을 수 있지만, 루트 교환 때문에 일반 구현은 안정적이지 않습니다.

## worked trace

입력 `[5, 1, 4, 2]`를 오름차순으로 넣으면 trace의 의미는 다음과 같습니다. 실제 코드의 `--trace`는 이벤트마다 전체 배열을 출력하므로, 설명의 축약 표와 실행 출력은 같은 상태 전이를 가리킵니다.

| 알고리즘 | 상태 전이 | 핵심 불변식 |
| --- | --- | --- |
| 삽입 | `[5]` → `[1,5]` → `[1,4,5]` → `[1,2,4,5]` | 왼쪽 prefix 정렬 |
| 선택 | 최솟값 1 교환 → 2 교환 → 4 확정 | 앞쪽 위치 최종 확정 |
| 버블 | `[1,4,2,5]` → `[1,2,4,5]` | pass 뒤 최댓값 suffix |
| 병합 | `[5]`,`[1]` 병합 → `[4]`,`[2]` 병합 → 두 정렬 절반 병합 | 두 절반 앞 원소 선택 |
| 힙 | max heap 구성 → 5,4,2,1을 suffix에 확정 | heap prefix와 sorted suffix |

이 표는 다섯 알고리즘이 매 순간 같은 배열을 만든다는 뜻이 아닙니다. trace의 목적은 “현재 어느 영역을 믿을 수 있는가”를 드러내는 것입니다. 삽입의 prefix와 선택의 확정 위치를 혼동하면 구현은 결과가 맞는 일부 입력에서도 경계 갱신을 잘못할 수 있습니다.

## 코드 walkthrough

`Stats`는 비교 횟수와 배열 쓰기 횟수를 분리해 저장합니다. 시간 측정만 하면 비교자 내부의 긴 문자열 처리와 이동 비용을 구분하지 못하기 때문에, 모든 알고리즘은 `CountingComparator`와 stats를 통해 같은 관찰 지점을 사용합니다. `TraceStep`은 이벤트 이름·배열 snapshot·불변식 설명을 보관해 mutable list의 나중 변경이 과거 trace를 덮지 않게 합니다.

`insertion_sort`는 현재 값보다 큰 prefix 원소만 오른쪽으로 이동합니다. `selection_sort`는 최솟값 index를 갱신한 뒤 pass마다 한 번 교환합니다. `bubble_sort`는 비교자가 양수일 때만 인접 교환하고 `changed`가 false면 종료합니다. 세 구현은 모두 입력 iterable을 새 list로 복사하므로 호출자 입력을 직접 바꾸지 않는 lab 계약을 가집니다.

`merge_sort`의 재귀 함수는 반열린 구간 `[lo, hi)`를 사용합니다. 길이가 1 이하이면 종료하고, 중간점으로 나눈 뒤 두 절반을 재귀 정렬합니다. 병합 중 왼쪽 비교가 작거나 같으면 왼쪽을 선택하는 한 줄이 안정성의 핵심입니다. `heap_sort`는 마지막 내부 노드부터 sift-down해 max heap을 만들고, 루트와 끝을 바꾼 뒤 줄어든 heap만 다시 sift-down합니다.

`assert_result`는 인접 순서와 `Counter`를 각각 검사합니다. 안정성 검사는 `(key, original_index)` 레코드를 만들어 key만 비교한 결과가 Python 기준 정렬과 같은지 확인합니다. 선택·힙 정렬에는 안정성을 요구하지 않고 동일 key의 순서가 달라져도 다중집합과 비감소 순서만 검사합니다. 이는 “불안정할 수 있다”와 “원소를 잃어도 된다”를 구분하는 계약입니다.

`validate_order`는 주어진 유한 표본에 대해 자기 비교, 비대칭, 앞섬 추이성, 동등함 추이성을 검사하고 `require_total=True`일 때 서로 다른 원소의 동률도 거절합니다. 순환 비교자 `0<1<2<0`를 failure injection으로 넣으면 `ComparatorError`가 발생해야 합니다. 이 검사는 표본에 대한 진단이지 무한한 값 영역에 대한 형식 증명은 아닙니다.

## 실행 절차

저장소 루트에서 다음 명령을 실행합니다.

```bash
python3 examples/knowledge/sorting-lab/sorting_lab.py --test
python3 examples/knowledge/sorting-lab/sorting_lab.py --trace merge --input 5,1,4,2
python3 examples/knowledge/sorting-lab/sorting_lab.py --failure-demo
python3 examples/knowledge/sorting-lab/sorting_lab.py --benchmark insertion --sizes 16,64,128 --repeats 3
```

`--test`는 빈 입력과 길이 4까지의 값 조합을 포함한 exhaustive 계약 검사를 수행하고, 다섯 알고리즘의 결과를 Python `sorted` 기준과 대조합니다. 중복 레코드 안정성, strict weak ordering 진단, trace 최종 상태, 역순 worst-case shape와 거의 정렬된 삽입 정렬도 검사합니다. `--benchmark`는 대표 worst-case shape를 측정하는 도구이며, 숫자는 실행한 호스트에서만 유효합니다. 큰 크기를 입력하면 `O(n²)` 알고리즘의 실행 시간이 급격히 늘 수 있으므로 작은 경계부터 시작합니다.

## 실패 진단

### 결과 순서 오류

먼저 `assert_result`의 인접 비교 실패인지 다중집합 실패인지 구분합니다. 인접 비교가 실패하면 merge의 양쪽 index 증가, heap의 child 선택과 sift-down 경계, insertion의 이동 조건을 확인합니다. 다중집합이 실패하면 swap 범위, merge에서 남은 tail append, 원본 list 복사와 slice 대입을 확인합니다. 정렬된 것처럼 보이는 출력만으로 원소 보존을 추론하지 않습니다.

### 동점 순서 오류

동일 key 레코드에 입력 index를 붙여 어느 단계에서 순서가 달라졌는지 trace를 비교합니다. insertion은 `>`가 `<` 또는 `>=`로 바뀌었는지, bubble은 `>`가 `>=`로 바뀌었는지, merge는 `<=`가 `<`로 바뀌었는지 확인합니다. selection과 heap은 안정성을 요구하는 테스트에 넣지 않고, 필요하면 total-order 보조 키를 비교자에 포함합니다.

### 비교자 오류

`--failure-demo`가 통과하지 않으면 validator 자체 또는 cycle comparator를 먼저 확인합니다. 실제 비교자가 NaN, 예외를 던지는 객체, locale 규칙, mutable key를 포함한다면 유한 샘플을 업무 입력에서 추출해 별도 검증해야 합니다. stable sort를 선택해도 비추이 비교자의 모순을 복구할 수 없습니다.

### 성능 이상

역순 입력은 삽입·선택·버블의 제곱형 동작을 드러내고, 병합·힙의 로그형 상한과 대조할 기준을 줍니다. 그러나 wall-clock만으로 알고리즘 우열을 고정하지 않습니다. `comparisons`와 `writes`를 함께 보고, 비교자에 문자열 정규화·I/O·할당이 들어갔는지 확인합니다. benchmark 결과를 문서의 사전 숫자로 복사하지 않고 같은 Python 빌드와 workload에서 다시 측정합니다.

### trace가 멈추거나 메모리가 커지는 경우

trace는 매 단계 전체 배열 snapshot을 보관하므로 교육용 작은 입력에 한정해야 합니다. 큰 입력에서 trace를 켜면 출력과 메모리가 알고리즘 비용보다 커질 수 있습니다. 재귀 병합 정렬은 slice와 output list를 사용하므로 입력 크기·재귀 깊이·메모리 상한을 제품 계약으로 다시 정해야 합니다. 이 lab은 자원 무제한 실행을 보장하지 않습니다.

## 실행 범위

실행 가능한 범위는 Python 표준 라이브러리 기반의 다섯 비교 정렬, 유한 sample comparator 진단, 안정성·다중집합·trace 검증, 작은 exhaustive 입력, 역순 benchmark harness입니다. `Counter`를 사용하므로 hashable 값이 lab 입력 계약이며, 예제 레코드는 tuple입니다.

실행하지 않은 범위는 Python 표준 라이브러리 내부 sort 구현 분석, C/C++ 표준 라이브러리의 stability 계약, 병렬·외부·분산 정렬, 디스크 부족과 중단 복구, NUMA·cache counter, 운영 SLA, locale/Unicode collation, NaN 전체 정책입니다. 따라서 이 lab의 PASS를 특정 서비스 workload의 성능 승인이나 모든 정렬 기능의 공식 검증으로 확대하지 않습니다.

2026-09-18 macOS 27 arm64, Python 3.9.6에서 저장소 코드의 7개 테스트를 통과했습니다. trace가 없는 실행은 단계별 배열 복사를 만들지 않으며, benchmark 결과는 해당 실행 환경의 관찰이지 일반적인 속도 순위가 아닙니다.

## 참고 자료

- [Python Sorting Techniques](https://docs.python.org/3/howto/sorting.html) — 2026-09-18 확인. “Sorts are guaranteed to be stable.”, “when multiple records have the same key, their original order is preserved.” Python `list.sort()`·`sorted()`의 안정성 계약과 key 함수 설명에 적용되지만, 이 lab의 자체 알고리즘 구현이나 성능을 보장하지 않습니다.
- [기본 정렬 알고리즘과 선택](/tech-interview/notes/sorting-foundations/) — 결과 계약, 기본 정렬 상태, 병합·퀵소트·키 기반 정렬과 외부 정렬 경계.
- [점수로 정렬한 뒤 동점자의 기존 순서를 유지하려 합니다](/tech-interview/questions/sorting-stability/) — 안정성·결정적 보조 키·비교자 일관성의 기존 질문.
- [알고리즘 설계 전략과 증명](/tech-interview/notes/algorithm-strategies/) — 불변식, 종료, 다중집합, 복잡도와 반례 검증.

정렬 상태의 표와 trace는 알고리즘 불변식을 설명하기 위한 사례이며, benchmark 수치는 실행 전에는 알 수 없는 값입니다. 출처가 보장하는 Python library 안정성과 이 lab이 직접 검사하는 source-code 속성을 혼동하지 않습니다.
