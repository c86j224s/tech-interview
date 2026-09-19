---
id: alg-bellman-overflow-sentinel
title: Bellman-Ford에서 INF에 음수 가중치를 더하면 어떤 오류가 생기며 어떻게 막나요?
difficulty: 중하
category: 알고리즘
tags:
  - Bellman-Ford
  - overflow
  - sentinel
related:
  - algorithm-dijkstra-negative-edge
---
# Bellman-Ford에서 INF에 음수 가중치를 더하면 어떤 오류가 생기며 어떻게 막나요?

## 구두 답변

`INF`는 실제 거리 값이 아니라 도달하지 않았다는 표식이므로, `dist[u] == INF`인 상태에서 가중치를 더하면 안 됩니다. `INF=MAX_INT64`에서 `INF+(-5)`는 범위 안의 `MAX_INT64-5`이지만 sentinel 오염으로 거짓 경로를 만듭니다. 실제 overflow는 `MAX_INT64+5` 또는 `MIN_INT64-5` 같은 유한 덧셈입니다.

완화 순서는 먼저 도달성 검사, 다음 유한 값의 checked addition, 마지막으로 비교·대입이어야 합니다. `dist[u] != INF`인지 확인하고 `checked_add(dist[u], w)`가 성공할 때만 후보를 만듭니다. 유한 거리끼리 더하는 경우에도 양의 overflow나 음의 underflow가 가능하므로 넓은 타입이나 checked 연산을 사용합니다.

음수 cycle로 값이 계속 내려가는 상태도 실제 최소 정수값으로 저장하지 않는 편이 좋습니다. n번째 라운드 갱신을 별도 seed로 기록해 `NEGATIVE_CYCLE_REACHABLE` 같은 상태로 표현하면 유한한 큰 음수와 무한 하강을 구분할 수 있습니다. overflow는 입력 범위 오류이고 negative cycle은 그래프 의미의 결과이므로 같은 실패 코드로 섞지 않겠습니다.

수치를 분리해 테스트해야 합니다. `INF=MAX_INT64`에서 -5를 더한 `MAX_INT64-5`는 표현 범위 안이지만 sentinel 오염이며, `MAX_INT64+5`는 양의 overflow입니다. 반대로 `MIN_INT64-5`는 음의 underflow입니다. 구현 순서는 `dist[u] != INF` 확인, `checked_add`, 후보 비교의 세 단계여야 하며, overflow 반환을 wraparound 숫자로 바꾸면 안 됩니다. n번째 pass에서 계속 내려가는 negative cycle은 수치 overflow가 아니라 그래프 의미상 유한 최단값이 없는 상태이므로 별도 seed와 도달성 탐색으로 표현합니다. 작은 테스트에서 세 상태를 각각 확인하면 두 오류를 섞지 않았음을 검증할 수 있습니다.

## 득점 포인트

- `INF`를 산술에 참여시키지 않고 reachability를 먼저 검사한다고 답합니다.
- signed overflow·wraparound가 거짓으로 싼 경로를 만들 수 있는 구체 상황을 듭니다.
- 유한 값 덧셈에도 checked arithmetic가 필요하다고 설명합니다.
- overflow와 negative-cycle 상태를 별도 결과로 구분합니다.

## 감점 포인트

- `INF`를 충분히 큰 숫자로만 두면 항상 안전하다고 합니다.
- 음수 가중치가 있을 때만 overflow가 생긴다고 단정합니다.
- wraparound한 값을 정상 거리로 비교합니다.
- `-INF`를 실제 정수 최솟값으로 계속 더해 cycle 상태를 표현합니다.

## 더 파고들 거리

- 언어의 signed overflow 동작이 정의되지 않았거나 panic인 경우 거리 타입과 오류 계약을 어떻게 설계할까요?
- path reconstruction에서 `INF`, finite, negative-cycle 상태를 parent 배열과 어떻게 함께 검증할까요?
