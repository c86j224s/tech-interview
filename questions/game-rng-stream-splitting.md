---
id: game-rng-stream-splitting
title: player별 RNG stream을 seed로 분할할 때 어떤 충돌과 상관을 검사해야 하나요?
difficulty: 중하
category: 게임 서버
tags:
  - game
  - mechanism
related:
  - pure-random-state-threading
---
# player별 RNG stream을 seed로 분할할 때 어떤 충돌과 상관을 검사해야 하나요?

## 구두 답변
단순히 player ID를 seed에 더하지 말고 `matchSeed, systemTag, playerId, entityGeneration, epoch`를 구조화한 stream key로 관리합니다. 64비트 hash를 32비트 seed로 잘라 쓰면 다른 key가 같은 값으로 충돌할 수 있으므로 registry에 원래 key와 `(algorithm, sequence, state)`를 기록하고 truncation 경계·ID 재사용·system tag 변경을 시험합니다. 충돌이 없다는 사실은 통계적 독립이나 암호학적 안전성의 증명이 아닙니다. 선택한 generator/version의 stream 보장과 출력 변환을 읽고, allocation 표본에 통계 검정을 적용하되 검정은 증명이 아니라 회귀 탐지입니다. replay에서는 동일 key가 동일 초기 state를 만들고 generation이 바뀌면 옛 stream을 재사용하지 않는 것이 우선이며, token·nonce에는 예측 가능한 replay stream을 쓰지 않습니다.


실무 검사는 세 단계로 나눕니다. 먼저 registry에서 서로 다른 원래 key가 같은 canonical stream identity로 매핑되는지 확인하고, 다음으로 match 재시작과 entity generation 증가가 의도한 state를 만드는지 확인합니다. 마지막으로 충분한 표본을 사용해 선택한 generator의 stream allocation에서 cross-correlation이나 분포 이상을 회귀 검사합니다. 실패한 통계 검정은 독립성의 반증 후보이지 보안 보증의 근거가 아니며, generator를 바꾸면 seed와 state 포맷을 포함한 replay version도 함께 올려야 합니다. 단순 seed 충돌과 출력 상관은 서로 다른 실패이므로 registry 오류와 generator 품질 결과를 같은 경보로 묶지 않습니다.
## 득점 포인트
- namespace와 stream identity를 분리한다.
- truncation·ID 재사용·tag 충돌을 시험한다.
- generator 보장과 통계 검정을 구분한다.
- replay와 보안 RNG를 분리한다.

## 감점 포인트
- seed가 다르면 독립이라고 단정한다.
- ID 덧셈이 충돌을 막는다고 한다.
- 게임 stream을 보안 nonce에 쓴다.
- 검정을 독립성 증명으로 표현한다.

## 더 파고들 거리
- registry schema에 어떤 key를 저장할까요?
- stream 수 증가 시 snapshot memory를 어떻게 제한할까요?
