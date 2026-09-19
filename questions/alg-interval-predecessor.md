---
id: alg-interval-predecessor
title: 가중 구간 스케줄링에서 p(j)를 구할 때 왜 시작 시간이 아니라 이전 구간의 종료 시간으로 이진 탐색하나요?
difficulty: 하
category: 알고리즘
tags:
  - weighted interval scheduling
  - predecessor
  - binary search
related:
  - dp-greedy-divide-conquer
---
# 가중 구간 스케줄링에서 p(j)를 구할 때 왜 시작 시간이 아니라 이전 구간의 종료 시간으로 이진 탐색하나요?

## 구두 답변

이전 작업이 현재 작업 `j`와 겹치지 않는 조건은 이전 작업의 `finish`가 현재 작업의 `start` 이하인지로 표현되기 때문입니다. finish 오름차순으로 정렬한 배열에서 `finish[i] ≤ start[j]`를 만족하는 가장 큰 i를 찾으면 j와 함께 선택할 수 있는 가장 뒤의 prefix, 즉 `p(j)`가 됩니다. 이전 작업의 시작 시간을 비교하면 그 작업이 아직 끝났는지를 판정할 수 없습니다.

예를 들어 `(1,3,5)`, `(2,5,6)`, `(4,6,5)`가 있으면 세 번째 작업의 start는 4입니다. finish 배열 `[3,5,6]`에서 `≤4`인 마지막 값은 3이므로 `p(3)=1`입니다. 두 번째 작업의 start 2를 보고 판단하거나 이전 구간의 start가 1인지 2인지로 찾으면, 실제 종료 시점이 3·5인 작업의 충돌 여부를 잘못 해석하게 됩니다. 끝과 시작이 같은 경우를 허용하는 정책이라면 `upper_bound(start[j]) - 1`, 허용하지 않으면 strict 비교를 사용해야 합니다.

이진 탐색의 전제는 finish 배열이 정렬되어 있다는 점입니다. `p(j)`를 구한 뒤 점화식은 `weight[j]+OPT(p(j))`를 사용하므로, 비교자와 DP의 호환 조건이 일치해야 합니다. `finish<start`와 `finish≤start`를 섞으면 경계 작업 하나가 들어갔다 빠지는 오류가 생기고, 모든 p를 선형 탐색하면 정답은 맞아도 전처리와 전체 계산이 `O(n²)`로 커질 수 있습니다.

`p(j)`를 실제 배열로 보면 비교 기준이 명확합니다. finish가 `[3,5,6]`이고 작업 3의 start가 4이면 upper bound(4)는 위치 1 뒤를 가리키므로 0-based index 0, 즉 작업 `(1,3)`을 선택합니다. 작업 `(2,5)`는 finish가 5라 start 4보다 늦어 호환되지 않습니다. 반대로 작업 4의 start가 6이면 upper bound(6)은 finish 6까지 포함해 작업 3을 반환합니다. 이 경계에서 `lower_bound`를 잘못 쓰면 finish가 start와 같은 작업을 잃습니다.


## 득점 포인트

- 겹침 조건을 `previous.finish ≤ current.start`로 말한다.
- `(1,3),(2,5),(4,6)`에서 세 번째의 `p=1`을 추적한다.
- end-point 정책과 `upper_bound`/strict 비교자의 일치를 지적한다.

## 감점 포인트

- 현재 작업의 start를 이전 작업의 start와 비교해 predecessor를 정한다.
- finish 배열 정렬 없이 이진 탐색한다.
- finish가 start와 같은 경계의 포함 여부를 코드마다 다르게 둔다.

## 더 파고들 거리

- 구간을 양끝 포함으로 정의하면 predecessor 비교자와 예제 결과가 어떻게 바뀌는지 다시 계산해 보세요.
- 같은 finish 시각의 작업이 여러 개일 때 원래 ID와 tie-break를 어떻게 보존하겠습니까?
