---
id: alg-flow-residual-reverse
title: 최대 유량에서 residual reverse edge가 없으면 초기 경로 선택을 나중에 수정할 수 없는 이유는 무엇인가요?
difficulty: 하
category: 알고리즘
tags:
  - max flow
  - residual graph
  - reverse edge
related:
  - graph-representation
---
# 최대 유량에서 residual reverse edge가 없으면 초기 경로 선택을 나중에 수정할 수 없는 이유는 무엇인가요?

## 구두 답변

첫 증가 경로에 보낸 flow가 이후의 더 좋은 경로와 충돌할 수 있기 때문입니다. residual reverse edge는 “원래 그래프에 반대 방향 도로가 있다”는 뜻이 아니라, 이미 보낸 flow를 일부 취소해 그 용량을 다른 경로로 재배치할 수 있다는 뜻입니다. 순방향 잔여량은 `capacity-flow`, 역방향 잔여량은 `flow`로 유지합니다.

구체적으로 용량이 모두 1인 `s→u`, `s→v`, `u→v`, `u→t`, `v→t`를 보겠습니다. 첫 경로를 `s-u-v-t`로 선택하면 `s→u`, `u→v`, `v→t`가 포화되고 flow 값은 1입니다. 두 번째 단위는 `s→v`로 들어갈 수 있지만 `v→t`는 막혀 있습니다. residual에는 방금 사용한 `u→v`를 취소하는 `v→u`가 용량 1로 생기므로 `s-v→reverse(u-v)→u-t`를 따라갈 수 있습니다. 이 경로를 1만큼 반영하면 `u→v` flow는 1에서 0으로 줄고, `s→v`와 `u→t`는 1이 됩니다. 최종 원래 간선 기준 flow는 `s-u-t`와 `s-v-t` 두 경로, 값 2입니다. 역간선은 출력 도로가 아니라 첫 배치를 되돌리는 residual 선택입니다.

구현에서는 forward와 reverse residual edge를 서로 가리키게 하며, 증가량 `d`에 대해 forward의 cap은 `d`만큼 줄이고 reverse의 cap은 `d`만큼 늘립니다. 역간선을 최종 네트워크의 실제 도로로 출력하면 안 되지만, BFS·DFS 탐색에서는 반드시 고려해야 합니다. 원래 양방향 간선과 residual reverse edge가 동시에 존재할 수 있으므로 edge identity를 섞지 않는 것도 중요합니다.

## 득점 포인트

- reverse residual을 flow 취소·재배치 선택으로 설명한다.
- `forward = capacity-flow`, `reverse = flow` 갱신을 말한다.
- 탐색에는 포함하지만 원래 결과 간선으로 출력하지 않는 경계를 구분한다.

## 감점 포인트

- 역잔여 간선을 입력에 존재하는 실제 도로라고 설명한다.
- 증가 때 forward만 줄이고 reverse를 늘리지 않는다.
- 역간선을 빼도 임의의 경로 선택이 항상 최적이라고 말한다.

## 더 파고들 거리

- 원래 입력에 `u→v`와 `v→u`가 모두 있을 때 residual edge 객체를 어떻게 식별하고 출력할지 설명해 보세요.
- flow를 직접 저장하는 구현과 residual capacity만 저장하는 구현에서 최종 원래 간선 flow를 복원하는 방법을 비교해 보세요.
