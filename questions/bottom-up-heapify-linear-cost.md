---
id: "bottom-up-heapify-linear-cost"
title: "배열 전체를 힙으로 만들 때 bottom-up heapify는 왜 반복 삽입보다 낮은 전체 비용을 가질 수 있나요?"
difficulty: "중하"
category: "자료구조"
tags: ["힙","우선순위 큐","정렬","심화 질문"]
related: ["heap-vs-sorted-array","ranking-top-k"]
promotedFrom: {"id":"heap-vs-sorted-array","prompt":"정렬된 입력을 한 번에 힙으로 만드는 heapify가 반복 삽입과 다른 비용을 갖는 이유를 설명해 보세요."}
---

# 배열 전체를 힙으로 만들 때 bottom-up heapify는 왜 반복 삽입보다 낮은 전체 비용을 가질 수 있나요?

## 구두 답변

아래쪽 부모부터 sift-down하면 대부분의 노드는 낮은 높이만 내려갑니다. 높이 h인 노드 수가 대략 n/2^(h+1)이므로 이동량을 합하면 O(n)으로 제한됩니다.

반복 삽입의 O(n log n) 상한과 구분하고 빈·동일값·정렬 입력을 시험합니다. heapify는 전체 정렬이 아니라 부모·자식 부분 순서만 만듭니다.

## 득점 포인트

- 아래쪽 부모부터 sift-down하면 대부분의 노드는 낮은 높이만 내려갑니다. 높이 h인 노드 수가 대략 n/2^(h+1)이므로 이동량을 합하면 O(n)으로 제한됩니다.
- heapify는 전체 정렬이 아니라 부모·자식 부분 순서만 만듭니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 아래쪽 부모부터 sift-down하면 대부분의 노드는 낮은 높이만 내려갑니다.

## 더 파고들 거리

- [기본 상황과 비교: 우선순위가 있는 작업을 계속 추가하면서 가장 작은 값의 작업부터 꺼내려 합니다. 힙과 정렬된 배열의 삽입·조회·삭제 비용을 어떻게 비교하나요?](/tech-interview/questions/heap-vs-sorted-array/)
