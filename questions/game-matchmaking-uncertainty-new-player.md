---
id: game-matchmaking-uncertainty-new-player
title: 신규 플레이어의 rating uncertainty가 크다는 것을 매칭 범위에 어떻게 반영하나요?
difficulty: 중하
category: 게임 서버
tags:
  - matchmaking
  - rating
  - uncertainty
related:
  - ranking-global-topk
---
# 신규 플레이어의 rating uncertainty가 크다는 것을 매칭 범위에 어떻게 반영하나요?

## 구두 답변

신규 플레이어는 `μ`만 비교하지 않고 `σ`와 provisional 상태를 별도로 매칭 입력에 넣습니다. `μ=1500,σ=300`과 `μ=1500,σ=50`은 중심은 같지만 후자의 추정이 훨씬 안정됐다는 뜻입니다. σ는 hard lower/upper range가 아니라 skill belief의 표준편차이므로 “실제 실력 범위가 정확히 ±300”이라고 말하면 안 됩니다. 서비스가 90% 신뢰구간을 사용하기로 했다면 그때의 구간을 별도 정책으로 계산합니다.

후보를 고를 때는 μ 차이만 보지 않고 μ·σ를 이용한 match quality 또는 정규화된 가상 무승부 확률 같은 기준을 사용합니다. 예를 들어 안정된 1500과 신규 1500은 중심 차이가 0이어도 provisional 위험을 표시하고, 선택한 uncertainty 정책에 따라 1450·1650 주변 후보를 추가 탐색할 수 있습니다. 이것은 “아무 상대나 허용”이 아니라 team size, role, region, ping 같은 hard constraint를 먼저 통과시킨 뒤 soft quality를 비교하는 절차입니다. 범위 확대 자체는 rating 모델의 자동 결과가 아니라 제품 정책입니다.

경기가 끝나면 결과·탈주·무효 판정을 검증한 뒤 rating snapshot version에 맞춰 posterior를 갱신합니다. 초기 몇 경기의 승패만으로 σ를 강제로 낮추지 않고 provisional 경기 수, calibration, 상대 분포를 관찰합니다. queue에는 `(μ,σ,policyVersion,ratingVersion)`을 저장하고, match claim 전에 player가 다른 게임으로 빠졌거나 rating이 바뀌었는지 재검증합니다. 늦은 무효 결과는 현재 rating 위에 맹목적으로 적용하지 않고 sequence와 correction 정책으로 처리합니다. 정확한 prior·update 상수는 TrueSkill 프로젝트 페이지가 보장하는 서비스 기본값이 아니므로 게임별 실험과 승인으로 정해야 합니다.

## 득점 포인트

- mean과 uncertainty를 분리하고 σ가 큰 것이 곧 고숙련이라는 뜻은 아니라고 한다.
- provisional player의 후보 범위 확대와 hard constraint·quality 검사를 함께 둔다.
- 결과 update, snapshot version, smurf·calibration 관측을 연결한다.

## 감점 포인트

- 신규 player도 μ만 같으면 안정 player와 동등하다고 말한다.
- σ를 즉시 낮추거나 누구와든 붙이면 빠르게 해결된다고 주장한다.
- rating SDK의 기본값을 모든 게임에 그대로 적용한다고 설명한다.

## 더 파고들 거리

- 복귀 player의 σ를 다시 키우는 기준을 경기 공백과 어떻게 연결할까요?
- party 안의 고·저 uncertainty를 팀 quality에 어떻게 합칠까요?
- 결과가 늦게 도착하거나 무효 match가 될 때 posterior를 어떻게 보정할까요?
