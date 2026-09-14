---
id: heap
title: 이진 힙과 우선순위 큐
topic: 자료구조
summary: 부분 순서, push·pop·heapify, 동점·갱신·취소 정책을 실제 배열 표현으로 익힙니다.
questionIds: [heap-vs-sorted-array, ranking-top-k, ranking-global-topk, priority-queue-starvation, timing-wheel-vs-heap]
---

# 이진 힙과 우선순위 큐

## 힙은 전체 정렬이 아닙니다

최소 힙은 각 부모 값이 자식 값보다 크지 않다는 부분 순서를 유지합니다. 루트가 최솟값이라는 것은 알 수 있지만 형제나 서로 다른 부분 트리의 전체 순서는 알 수 없습니다. 배열 `[1,4,2,8,5,3]`은 최소 힙일 수 있지만 정렬 배열은 아닙니다.

0-based 배열에서 부모는 `(i-1)//2`, 왼쪽 자식은 `2*i+1`, 오른쪽은 `2*i+2`입니다. 실제 구현은 i=0과 배열 끝의 범위를 먼저 확인합니다.

## 삽입과 추출

```text
push(value):
    append value
    i = last index
    while i > 0 and a[i] < a[parent(i)]:
        swap(a[i], a[parent(i)])
        i = parent(i)

pop_min():
    if empty: return empty-result
    result = a[0]
    move last element to root and shorten array
    sift_down(root):
        choose the smaller valid child
        if parent <= child: stop
        swap and continue from child
    return result
```

삽입은 아래에서 위로, 추출은 마지막 원소를 루트로 옮긴 뒤 아래로 불변식을 복구합니다. 두 동작은 트리 높이만큼 이동해 O(log n)이며 루트 조회는 O(1)입니다. 배열 자체가 확장되면 한 삽입에 O(n) 재할당이 추가될 수 있어 개별 지연과 상환 비용을 구분합니다.

## 전체 배열의 heapify

이미 n개 값이 있으면 마지막 부모부터 sift-down합니다. 높은 노드는 적고 대부분의 노드는 아래에 있어 적은 거리만 이동합니다. 높이별 노드 수를 합치면 전체 O(n)입니다. 각 값을 순서대로 push하는 O(n log n) 상한의 구성과 다른 방법입니다.

## 우선순위 변경과 취소

힙 안의 객체 필드를 직접 바꾸면 배열 위치는 그대로라 불변식이 깨질 수 있습니다.

- **위치 맵**: 작업 ID→배열 인덱스를 관리하고 이동마다 맵을 갱신합니다. 수정·삭제 후 위나 아래로 복구합니다.
- **지연 삭제**: 새 버전 항목을 넣고 옛 항목은 pop할 때 버립니다. 구현이 단순할 수 있지만 무효 항목의 메모리·pop 지연과 재구축이 필요합니다.

같은 우선순위의 FIFO가 필요하면 `(priority, insertionSequence)`를 비교합니다. 순번의 overflow·재시작·ID 재사용을 설계해야 하며, 높은 우선순위가 계속 들어오는 기아는 이 보조 키만으로 해결되지 않습니다.

## 어디에 사용하나

상위 K명을 유지할 때 크기 K 최소 힙의 루트는 현재 K위 후보입니다. 더 좋은 값이 오면 교체합니다. 하지만 K 밖 값을 버린 상태에서 기존 K위 점수가 내려가면 새 후보를 알 수 없습니다. 동적 순위 전체에는 원본 재스캔이나 정렬 인덱스가 필요합니다.

타이머는 가장 이른 만료를 루트로 관리할 수 있습니다. 만료 항목을 찾는 것과 callback 실행은 별도 단계이며 취소와 실행의 경쟁은 상태 머신으로 보호해야 합니다.

## 연습

모든 연산 뒤 부모≤자식 조건과 원소 수·다중집합을 검사합니다. push·pop을 섞은 무작위 연산열을 정렬 목록 기준과 비교합니다. 동일 우선순위, 중간 취소, version 재사용, 배열 확장, 무효 항목 폭증을 포함합니다.
