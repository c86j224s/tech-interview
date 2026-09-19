---
id: game-matchmaking-widening-cadence
title: 대기 시간이 길어질 때 rating 범위를 단계적으로 넓히는 이유와 위험은 무엇인가요?
difficulty: 중하
category: 게임 서버
tags:
  - matchmaking
  - queue
  - search widening
related:
  - priority-queue-starvation
---
# 대기 시간이 길어질 때 rating 범위를 단계적으로 넓히는 이유와 위험은 무엇인가요?

## 구두 답변

대기 시간이 길어질수록 rating 조건을 조금씩 넓히는 이유는 품질과 starvation 사이에서 단계적으로 절충하기 위해서입니다. 설명용 policy를 `0≤age<10초: ±50`, `10≤age<20초: ±100`, `age≥20초: ±150`으로 두면 9.9초 후보는 좁은 quality를 우선하고 10.0초 후보는 다음 단계로 이동합니다. 각 단계에 `policyVersion`을 붙여 어떤 완화로 경기가 만들어졌는지 재현합니다. 이 숫자는 서비스 기본값이 아니라 검증할 정책입니다.

경계에서 후보가 없다는 원인도 분리해야 합니다. rating 후보가 부족한 것과 region 장애로 ping hard constraint를 만족하지 못하는 것은 같은 widening으로 해결하면 안 됩니다. 먼저 party 크기·team size·필수 region 같은 hard 조건을 유지하고, skill difference 같은 soft 조건만 단계적으로 넓힙니다. 상한에 도달하면 대기 취소, 다른 region 동의, 훈련 모드 같은 명시 fallback을 제시합니다. 무한히 넓혀 평균 wait만 낮추면 신규 플레이어가 고숙련자와 반복 매칭되고 이탈·악용이 늘 수 있습니다.

후보 조합을 만들었다고 확정하지 않습니다. `candidate selected → player A가 다른 match에 claim됨 → atomic claim에서 version/lease 불일치 → 조합 폐기` 같은 경로를 정상 실패로 처리해야 합니다. queue age는 monotonic clock 또는 합의 tick으로 계산하고, rating snapshot과 실제 claim 시점의 상태를 재확인합니다. 평가는 wait p50/p95만 아니라 expected win gap, match quality, ping p95, cancel rate, 단계별 이탈, 중복 claim 실패율을 cohort별로 비교합니다. widening cadence는 priority queue aging과 이름이 비슷하지만 실력·지연 조건을 완화하는 matchmaking 정책이라는 점도 구분합니다.

## 득점 포인트

- 품질 우선 검색과 age 기반 starvation 완화를 단계 정책으로 설명한다.
- widening 속도가 빠를 때 skill gap·지연·악용 위험을 구체적으로 말한다.
- 상한, hard constraint, fallback, claim·snapshot 재검증을 둔다.

## 감점 포인트

- 평균 wait만 줄이면 widening이 성공이라고 판단한다.
- rating 범위를 무한히 넓히면 결국 공정해진다고 말한다.
- queue age를 조정 가능한 벽시계로 계산해도 된다고 설명한다.

## 더 파고들 거리

- widening 단계별 quality SLO와 player 이탈을 어떤 cohort로 비교할까요?
- 후보가 동시에 선택될 때 중복 match claim을 어떤 원자 경계에서 막을까요?
- region 장애와 rating 후보 부족을 같은 완화 단계로 처리해도 될까요?
