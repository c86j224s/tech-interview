---
id: game-morton-range-box-intervals
title: Morton 정렬 배열에서 사각형 범위 질의를 한 번의 연속 slice로 읽을 수 없는 이유는 무엇인가요?
difficulty: 중하
category: 게임 서버
tags:
  - Morton code
  - range query
  - false positive
related:
  - collision-broad-narrow-phase
---
# Morton 정렬 배열에서 사각형 범위 질의를 한 번의 연속 slice로 읽을 수 없는 이유는 무엇인가요?

## 구두 답변

Morton 정렬은 2차원 box를 일반적으로 한 구간으로 보존하지 않습니다. 재현 가능한 4×4 예를 들면 각 축을 2비트로 쓰고 `x1,y1,x0,y0` 순서로 interleave합니다. query를 `x∈[1,2], y∈[1,2]`로 잡으면 네 점은 `(1,1)→3`, `(1,2)→6`, `(2,1)→9`, `(2,2)→12`입니다. 따라서 정확한 code 집합은 `{3,6,9,12}`이고, 이 작은 예에서는 `[3,3]`, `[6,6]`, `[9,9]`, `[12,12]` 네 singleton interval이 필요합니다. `[3,12]`로 합치면 code 4,5,7,8,10,11처럼 box 밖의 좌표가 섞입니다.

실제 quadtree decomposition에서는 query box 안에 완전히 들어온 cell을 prefix 하나로 묶어 interval을 만들고, 일부만 겹치는 cell은 자식으로 내려갑니다. 그러므로 큰 box는 몇 개의 긴 interval, 경계가 많은 작은 box는 여러 짧은 interval이 됩니다. interval scan은 후보를 줄이는 단계일 뿐 정확한 predicate가 아닙니다. 각 row에 대해 decode한 x/y 또는 저장한 AABB를 다시 검사하고, 동적 객체라면 generation·layer·swept 범위도 확인합니다.

`minCode`와 `maxCode` 사이를 한 번에 읽는 방식은 구현이 쉽지만 false positive가 크게 늘고, 반대로 interval을 잘못 쪼개면 box 내부가 누락됩니다. 테스트에서는 전수 좌표 predicate와 interval 후보의 union을 비교해 false negative가 0인지 먼저 확인합니다. interval 수가 많아 seek 비용이 커지면 prefix depth, cell precision, 후보 batch 크기를 조정하되, 정밀 필터를 생략해 정확성을 얻으려 해서는 안 됩니다. 이 숫자는 설명용 계산이며 특정 DB planner의 실행 성능은 아닙니다.

## 득점 포인트

- 완전 포함 cell은 prefix interval로 묶고 부분 겹침은 자식으로 분해하는 원리를 설명한다.
- 단일 min-max scan의 false positive와 잘못된 분해의 false negative를 구분한다.
- 후보 interval 뒤 실제 좌표·형상 predicate를 재검사한다.

## 감점 포인트

- Morton key의 최소·최대값만 읽으면 정확한 사각형 결과라고 말한다.
- code locality가 공간 범위의 연속성을 보장한다고 단정한다.
- 후보가 많아도 정밀 필터가 필요 없다고 생략한다.

## 더 파고들 거리

- interval 수가 많아질 때 prefix depth와 정밀도 사이의 비용을 어떻게 조정할까요?
- 대형 객체와 swept 범위를 Morton 후보에 어떻게 포함할까요?
- 정렬 index 갱신 중 query가 old/new interval을 섞지 않게 하려면 무엇을 기록할까요?
