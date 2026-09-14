---
id: "avl-red-black-update-tradeoff"
title: "검색과 갱신이 섞인 트리에서 AVL과 Red-Black Tree를 비교합니다. 균형의 엄격함과 회전 비용을 어떻게 측정하나요?"
difficulty: "중하"
category: "자료구조"
tags: ["BST","균형 트리","검색","심화 질문"]
related: ["bst-balance"]
promotedFrom: {"id":"bst-balance","prompt":"AVL과 Red-Black Tree의 균형 엄격도와 갱신 비용을 비교해 보세요."}
---

# 검색과 갱신이 섞인 트리에서 AVL과 Red-Black Tree를 비교합니다. 균형의 엄격함과 회전 비용을 어떻게 측정하나요?

## 구두 답변

AVL은 높이 차이를 더 엄격히 제한하고 Red-Black은 색·검정 높이 규칙으로 로그 높이를 유지합니다. 검색 비교 횟수와 갱신 회전·재색칠, 메모리 locality를 실제 workload에서 비교해야 합니다.

AVL이 항상 느린 갱신, Red-Black이 항상 빠른 전체 성능이라고 일반화하지 않습니다. 정적 데이터는 정렬 배열이 더 단순할 수 있습니다. 정렬·역정렬·중복 입력과 반복 삭제에서 BST 순서·높이·부모 링크를 확인하고 최대 지연을 측정합니다.

## 득점 포인트

- AVL은 높이 차이를 더 엄격히 제한하고 Red-Black은 색·검정 높이 규칙으로 로그 높이를 유지합니다. 검색 비교 횟수와 갱신 회전·재색칠, 메모리 locality를 실제 workload에서 비교해야 합니다.
- 정렬·역정렬·중복 입력과 반복 삭제에서 BST 순서·높이·부모 링크를 확인하고 최대 지연을 측정합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: AVL은 높이 차이를 더 엄격히 제한하고 Red-Black은 색·검정 높이 규칙으로 로그 높이를 유지합니다.

## 더 파고들 거리

- [기본 상황과 비교: 정렬된 키를 이진 탐색 트리에 차례대로 넣으면 왜 검색이 느려질 수 있나요?](/tech-interview/questions/bst-balance/)
