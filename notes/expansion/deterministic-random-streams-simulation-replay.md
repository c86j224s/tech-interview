---
id: deterministic-random-streams-simulation-replay
title: 결정적 난수 스트림과 시뮬레이션 Replay
topic: 게임 서버
summary: 게임 시스템별 난수 스트림을 분리하고 seed·상태·소비 순서를 기록해 rollback과 replay에서 같은 난수를 재현하는 지식 장입니다.
questionIds: []
prerequisites:
  - pure-state
  - simulation-budget
related:
  - pure-state
  - simulation-budget
  - input-authority
reviewedAt: '2026-09-19'
---
# 결정적 난수 스트림과 시뮬레이션 Replay

Replay에서 필요한 것은 랜덤해 보이는 값이 아니라 동일한 초기 상태와 입력에서 동일한 난수 소비를 재현하는 계약입니다. PCG 공식 자료는 correctness, uniformity, 성능, 예측 불가능성을 서로 다른 성질로 구분하고 stream 설계도 별도 문제로 취급합니다. 따라서 고정 seed는 재현의 출발점일 뿐 품질이나 암호학적 안전성을 보장하지 않습니다.

## Generator 상태 계약

난수 generator를 `next(state) = (value, nextState)`로 모델링하면 seed는 초기 state를 만드는 입력이고, snapshot에는 현재 state가 필요합니다. seed 10으로 초기화한 stream과 seed 10에서 이미 500회 draw한 stream은 같은 위치가 아닙니다. 저장 포맷에 `algorithmId`, 선택한 구현의 version, stream key, state bytes를 넣고, state 포맷을 모르는 버전은 조용히 현재 구현으로 읽지 않습니다.

draw count만 저장하는 대안은 generator가 seekable하고 매번 동일한 중간 실행을 보장할 때만 안전합니다. 500회 재계산 중 entity branch가 한 번 달라지거나 lifecycle이 바뀌면 같은 위치에 도달하지 않습니다. 작은 state를 가진 stream은 state bytes를 직접 저장하는 편이 rollback failure surface가 작고, 큰 배열은 checkpoint와 p99 restore 비용을 함께 측정해야 합니다.

## 전역 소비 간섭

전역 generator에서 tick 20에 combat가 두 번, loot가 한 번 draw하면 loot는 세 번째 전역 값을 받습니다. 다른 실행에서 NPC가 stun되어 combat가 한 번만 draw하면 loot는 두 번째 값을 받습니다. seed가 같은데도 전투의 조건 분기 하나가 전리품 결과를 바꾼 이유는 loot 로직이 아니라 공유 cursor가 이동했기 때문입니다.

`combat`, `loot`, `spawn`, `cosmetic` stream을 분리하면 combat draw 수 변화가 loot state를 움직이지 않습니다. 이는 영향 범위를 좁히는 애플리케이션 설계이며 PCG 자료가 임의의 게임 namespace가 통계적으로 독립임을 증명하는 것은 아닙니다. stream별 state를 simulation state로 넘기고, 시스템이 다른 시스템 stream을 몰래 소비하지 못하게 API를 제한합니다.

## Namespace와 Stream 구성

`globalSeed + playerId`는 overflow, truncation, ID 재사용, system 간 namespace 충돌을 만들기 쉽습니다. 애플리케이션 정책으로 `matchSeed`, `systemTag`, `entityId`, `entityGeneration`, epoch를 구조화한 key로 만들고, 선택한 generator가 제공하는 sequence/stream 식별자에 매핑합니다. hash 결과를 32비트로 자르면 서로 다른 key가 같은 seed에 도달할 수 있으므로 원래 key와 생성된 `(algorithm, sequence, state)`를 registry에 남깁니다.

이 registry는 충돌이 없다는 사실과 통계적 독립을 분리해야 합니다. 1과 2번 entity, generation 1과 2, truncation 경계, system tag가 다른 동일 숫자를 넣어 key가 중복되는지 검사합니다. 충돌이 없더라도 generator의 stream이 서로 닮을 수 있으므로 선택한 generator/version의 문서와 별도 통계 검정을 통해 allocation을 평가해야 합니다. 이것은 설계 선택이지 PCG의 보편적 앱 배정 규칙이 아닙니다.

## 소비 순서와 입력 정규화

난수 자체가 같아도 소비자가 받는 배열 순서가 다르면 결과가 달라집니다. map iteration 순서가 서버마다 달라져 Fisher–Yates의 같은 index를 적용해도 target이 달라질 수 있으므로 stable ID와 generation으로 입력 sequence를 정렬하고, lifecycle snapshot이 같은지 먼저 확인합니다. 병렬 job은 결과 merge 순서와 stream 소유권을 고정하지 않으면 scheduler에 따라 draw order가 바뀝니다.

예를 들어 tick 40에서 combat=421, loot=18, spawn=9라고 기록하고 실행 A가 각각 2, 1, 1회 draw하면 상태를 `(423,19,10)`으로 추적할 수 있습니다. rollback에서 combat만 1회 draw해도 분리 stream이라 loot=19, spawn=10은 유지되어야 합니다. 숫자는 실제 PCG 내부 state가 아닌 전이 횟수 설명용입니다.

## Save·Restore 원자성

rollback point는 모든 stream state를 같은 tick의 snapshot으로 복원해야 합니다. combat만 421로 돌리고 loot를 현재 19에 두면 새 입력 때문인지 잘못된 restore 때문인지 구분할 수 없고, 재실행 결과도 재현되지 않습니다. snapshot schema를 원자적으로 읽고 checksum에 stream key와 version을 포함하면 첫 divergence에서 어느 stream이 어긋났는지 알 수 있습니다.

algorithm version이 바뀌면 같은 seed/state bytes의 의미가 달라질 수 있습니다. 구버전 replay를 구버전 runtime에서만 허용할지, migration을 제공할지, 새 runtime에서 resync할지 정책을 정합니다. 이 정책을 “seed가 같으니 호환”으로 축약하지 않습니다.

## 통계 품질과 보안 경계

같은 결과를 내는 stream도 modulo 변환 때문에 확률이 치우칠 수 있고, 통계 품질이 좋아도 draw order가 달라지면 replay가 깨집니다. 결정성 테스트는 동일 snapshot·입력 log·generator version에서 tick별 checksum과 stream state를 비교하는 층입니다. 품질 테스트는 선택한 generator allocation에서 표본을 수집해 분포와 상관을 따로 평가하는 층입니다.

보안 token, nonce, 비밀번호처럼 예측 불가능성이 필요한 값에는 replay seed나 게임용 PCG stream을 사용하지 않습니다. 결정적 stream의 장점은 재현이지 공격자에게 숨겨진 엔트로피가 아닙니다. 동일 stream을 cosmetic과 authoritative loot에 섞지 않는 것도 이 경계를 코드에서 보이게 하는 방법입니다.

## 구현 API와 진단

`nextCombat(state)`, `nextLoot(state)`, `shuffleStable(ids, stream)`처럼 stream 소유권을 인자로 드러냅니다. 개발 빌드에서 `(tick, streamKey, consumer, drawIndex)`를 기록하고 출시 빌드에서는 checksum divergence 주변만 샘플링하면 진단 비용을 제한할 수 있습니다. entity 목록 checksum과 lifecycle event를 함께 저장해야 “난수만 달라졌다”는 잘못된 결론을 피할 수 있습니다.

재현 fixture는 NPC stun으로 combat draw가 줄어드는 branch, map 순서 변화, save/restore 직후 다중 stream 소비, entity generation 재사용, generator version mismatch를 포함합니다. 첫 divergence tick의 stream state를 비교하며 마지막 loot 결과만 보고 늦게 진단하지 않습니다.

```diagram
{"title":"분리된 stream의 replay 경로","caption":"snapshot은 generator 계약과 현재 위치를 보존하고 각 시스템은 독립 state를 소비하며 첫 divergence를 기록합니다.","rows":[[{"id":"snap","label":"stream snapshot","detail":["algorithm·version·state"]}],[{"id":"combat","label":"combat stream","detail":["조건별 draw"]},{"id":"loot","label":"loot stream","detail":["전투와 분리"]},{"id":"spawn","label":"spawn stream","detail":["생성 순서"]}],[{"id":"order","label":"입력 정규화","detail":["stable ID·generation"]}],[{"id":"checksum","label":"divergence 진단","detail":["tick·consumer·index"]}]],"edges":[{"from":"snap","to":"combat","label":"상태 복원"},{"from":"snap","to":"loot","label":"상태 복원"},{"from":"snap","to":"spawn","label":"상태 복원"},{"from":"order","to":"combat","label":"소비 순서 고정"},{"from":"combat","to":"checksum","label":"첫 차이 기록"},{"from":"loot","to":"checksum","label":"첫 차이 기록"},{"from":"spawn","to":"checksum","label":"첫 차이 기록"}]}
```

## 참고자료와 적용 범위

PCG 공식 논문 페이지(https://www.pcg-random.org/paper.html)는 generator의 성질 구분과 stream/state 설계의 중요성을 확인하는 근거로 사용했습니다. 특정 PCG variant, seed hash, 게임 엔진의 floating-point 모드와 application namespace는 이 자료가 선택해 주지 않으므로 이 장에서는 정책으로 표시했습니다. 숫자 trace는 설명용 상태 전이이며 실제 generator 실행이나 통계 검정 결과가 아닙니다.
