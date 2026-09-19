---
id: game-rng-stream-isolation
title: 전투 RNG와 전리품 RNG를 같은 전역 generator에서 읽으면 replay가 왜 쉽게 갈라지나요?
difficulty: 중하
category: 게임 서버
tags:
  - game
  - mechanism
related:
  - pure-random-state-threading
---
# 전투 RNG와 전리품 RNG를 같은 전역 generator에서 읽으면 replay가 왜 쉽게 갈라지나요?

## 구두 답변
전역 generator는 모든 시스템이 같은 소비 cursor를 공유합니다. tick 20에서 combat가 두 번, loot가 한 번 draw하면 loot는 세 번째 값을 받지만, NPC가 stun되어 combat가 한 번만 draw하면 loot는 두 번째 값을 받습니다. seed가 같아도 combat branch가 loot 결과를 이동시키는 이유입니다. `combat`, `loot`, `spawn` stream을 나누고 현재 state를 simulation state로 전달하면 combat draw 수 변화가 loot state를 움직이지 않습니다. 다만 stream 분리는 전체 결정성을 보장하지 않습니다. entity 순서, 병렬 merge, 생성·삭제 lifecycle이 다르면 한 stream 안에서도 결과가 갈라집니다. 개발 로그에는 tick, stream key, consumer, draw index를 남겨 첫 divergence를 찾고, 통계 품질과 replay 동일성은 별도 시험합니다.


전역 방식의 오류는 loot 분포가 나쁘다는 뜻이 아니라 특정 branch가 loot의 소비 위치를 바꾼다는 뜻입니다. 그래서 로그에서 tick 20의 combat drawCount가 A에서는 2, B에서는 1이고 loot의 firstDrawIndex가 A에서는 2, B에서는 1인지를 먼저 확인합니다. 분리 stream을 쓰면 이 index는 loot state에 대해 동일하게 유지되어야 합니다. 다만 combat 내부에서 entity를 map 순서로 순회하면 combat 결과 자체가 달라질 수 있으므로 stable ordering과 stream isolation을 동시에 적용해야 합니다. stream state의 checksum을 combat와 loot별로 분리하면 branch가 어느 경계를 넘어 영향을 주었는지 빠르게 판별할 수 있습니다.
## 득점 포인트
- 공유 cursor 이동을 수치 trace로 설명한다.
- 시스템별 state 전달과 소비권한을 분리한다.
- entity order와 병렬 merge도 검증한다.
- 결정성과 통계 품질을 구분한다.

## 감점 포인트
- seed만 같으면 된다고 한다.
- stream 분리가 병렬 결정성을 보장한다고 한다.
- 분포 문제로만 원인을 진단한다.
- 첫 divergence 대신 마지막 결과만 본다.

## 더 파고들 거리
- stream key 충돌 registry를 어떻게 시험할까요?
- entity generation을 key에 넣는 이유는?
