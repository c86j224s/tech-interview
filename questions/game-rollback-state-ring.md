---
id: game-rollback-state-ring
title: rollback netcode에서 어떤 상태를 ring buffer에 저장해야 하나요?
difficulty: 중하
category: 게임 서버
tags:
  - game
  - mechanism
related:
  - authoritative-server-input
---
# rollback netcode에서 어떤 상태를 ring buffer에 저장해야 하나요?

## 구두 답변
재실행 결과를 바꾸는 gameplay state와 RNG의 현재 내부 state, tick별 입력 원장을 저장합니다. 여기서는 `S[t]`를 tick t 입력 직전 상태로 정의하므로 tick 125 입력이 늦으면 S[125]를 복원하고 125부터 현재까지 실행합니다. transform만 저장하면 velocity, cooldown, projectile, 충돌용 문 상태가 달라져 checksum이 갈라집니다. 예를 들어 S[124]에 combat state 421과 loot state 18을 저장하고 125~130을 예측했다가 127 입력이 바뀌면, 125~126은 기존 입력, 127은 새 입력, 이후는 수신한 입력을 적용하며 RNG도 124 이후 위치에서 다시 소비합니다. 입력에는 player, sequence, simulationTick, edge와 held를 넣어 재정렬과 중복을 구분합니다. 렌더 cache, 오디오 핸들, 외부 DB 지급은 snapshot으로 취소되지 않으므로 presentation과 effect ledger를 분리합니다. 64KiB snapshot 120개는 7680KiB, 약 7.5MiB payload지만 allocator와 history는 별도입니다. 최대 late tick, restore/replay p99, schema version을 함께 정하고 버전 불일치에는 migration이나 resync를 둡니다.


실제 ring lookup은 tick만 보고 슬롯을 재사용하지 않도록 slot의 storedTick과 checksum을 함께 비교해야 합니다. 140을 저장한 슬롯에 260을 덮어쓴 뒤 141을 찾으면 modulo index가 같아도 복원하면 안 됩니다. 또한 snapshot과 input history의 보존 범위가 다르면 상태는 있어도 해당 입력을 재생할 수 없으므로 두 ring의 oldestTick을 함께 전진시킵니다. 저장 직후와 restore 직후 checksum을 비교하고, headless replay가 끝난 뒤에만 렌더러가 새 상태를 읽게 하면 중간 상태가 화면에 노출되는 문제도 줄어듭니다.
## 득점 포인트
- S[t]의 before-tick invariant로 복원 off-by-one을 막는다.
- RNG 현재 state와 input sequence를 함께 보존한다.
- 외부 효과와 렌더 cache는 rollback state에서 제외한다.
- window·bytes·restore CPU를 같이 예산화한다.

## 감점 포인트
- transform만 저장한다.
- seed만 저장해 현재 RNG 위치를 잃는다.
- 확정 입력을 다시 처리해 자원을 중복 적용한다.
- snapshot이 외부 지급을 되돌린다고 말한다.

## 더 파고들 거리
- delta chain의 restore p99를 어떻게 제한하겠습니까?
- schema 변경 시 어떤 resync 경계를 두겠습니까?
