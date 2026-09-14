---
id: "introsort-depth-fallback"
title: "introsort가 재귀 깊이 한도에서 heapsort로 전환합니다. 최악 시간과 stack 상한은 어떻게 연결되나요?"
difficulty: "중하"
category: "알고리즘"
tags: ["퀵 정렬","피벗","최악 복잡도","심화 질문"]
related: ["quicksort-worst-case","sorting-stability"]
promotedFrom: {"id":"quicksort-worst-case","prompt":"introsort가 재귀 깊이를 기준으로 힙 정렬로 바꾸는 이유를 설명해 보세요."}
---

# introsort가 재귀 깊이 한도에서 heapsort로 전환합니다. 최악 시간과 stack 상한은 어떻게 연결되나요?

## 구두 답변

분할이 계속 불균형하면 깊이가 커지는 것을 신호로 heapsort로 전환해 최악 O(n log n)을 확보하는 접근입니다. 작은 구간 처리와 stack 관리의 계약도 따로 봅니다.

깊이 제한만 넣고 나머지를 버리면 정렬이 아닙니다. 작은 구간 재귀·큰 구간 반복은 stack을 줄일 수 있지만 시간 최악을 단독 해결하지 않습니다. 정렬·역순·동일값에서 비교·깊이·결과를 검사합니다.

## 득점 포인트

- 분할이 계속 불균형하면 깊이가 커지는 것을 신호로 heapsort로 전환해 최악 O(n log n)을 확보하는 접근입니다. 작은 구간 처리와 stack 관리의 계약도 따로 봅니다.
- 정렬·역순·동일값에서 비교·깊이·결과를 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 분할이 계속 불균형하면 깊이가 커지는 것을 신호로 heapsort로 전환해 최악 O(n log n)을 확보하는 접근입니다.

## 더 파고들 거리

- [기본 상황과 비교: 퀵 정렬로 무작위 데이터는 빠르게 처리했지만 정렬된 입력에서는 급격히 느려집니다. 피벗과 분할이 어떤 영향을 주며 최악의 경우를 어떻게 줄이나요?](/tech-interview/questions/quicksort-worst-case/)
