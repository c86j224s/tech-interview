---
id: rollback-netcode-input-delay-replay
title: Rollback Netcode·Input Delay·Replay
topic: 게임 서버
summary: >-
  늦게 도착한 입력으로 과거 상태를 복원하고 입력을 재실행해 현재를 보정하는 rollback netcode의 저장·예측·효과 경계를 설명하는
  제안입니다.
questionIds: []
prerequisites:
  - input-authority
  - simulation-budget
  - rewind-evidence
related:
  - input-authority
  - rewind-evidence
reviewedAt: '2026-09-19'
---
# Rollback Netcode·Input Delay·Replay

Rollback은 늦은 패킷을 받아 화면을 한 번 보정하는 기능이 아니라, **입력으로 재구성할 수 있는 시뮬레이션 상태**를 과거 경계에 복원한 뒤 현재까지 다시 계산하는 실행 계약입니다. 따라서 상태 저장, 입력 귀속, 결정성, 렌더링과 외부 효과의 경계를 한 세트로 설계해야 합니다. GGPO 공식 개요가 말하는 save/load와 렌더링 없는 한 프레임 실행은 이 통합 경계의 근거이며, 특정 릴리스가 snapshot 스키마나 효과 커밋 정책까지 정해 주는 것은 아닙니다.

## 확정 입력과 예측 상태

각 tick에 `simulationTick`, 플레이어별 입력 sequence, 버튼 edge와 held 상태를 귀속합니다. 예를 들어 tick 100까지 상대 입력이 확정되고 101~105는 마지막 입력으로 예측했다면, 화면에 보이는 105의 상태는 확정 진실이 아니라 그 예측을 포함한 speculative state입니다. 실제 입력이 tick 102에서 달랐다는 사실이 도착하면 102 이전의 상태를 골라 102~105를 새 입력으로 실행합니다. 입력을 “현재 키 상태”만으로 보내면 재전송과 재정렬에서 edge를 중복 소비하므로 sequence와 tick을 함께 기록해야 합니다.

여기서 client prediction과 전체 rollback을 구분합니다. 전자는 확정된 서버 prefix 뒤에 로컬 입력을 다시 적용하는 범위가 보통이고, rollback netcode는 양측이 같은 과거 입력 prefix와 결정론적 실행을 통해 gameplay state 자체를 재구성하는 범위가 더 큽니다. rewind hitbox 판정도 과거 자료를 읽지만 판정 결과는 현재 권위 상태에 적용하므로, 이 장의 state restore와 같은 모델로 취급하지 않습니다.

## Snapshot 스키마

이 장은 오프바이원을 피하기 위해 `S[t] = tick t 입력을 적용하기 직전의 상태`라고 정의합니다. late input이 tick 125에 귀속되면 `S[125]`를 복원하고 input 125부터 headless step을 시작합니다. 만약 엔진이 tick 종료 후 상태를 저장한다면 복원점은 `S_after[124]`가 되므로, 이름이 아니라 invariant를 코드와 테스트에 고정해야 합니다.

snapshot에는 transform만이 아니라 결과를 바꿀 수 있는 velocity, health, cooldown, 탄약, 활성 projectile, 충돌용 문 상태, entity의 generation과 생명주기, 각 RNG stream의 현재 state, schema/version, checksum을 포함합니다. 포인터·파일 핸들·렌더 캐시를 그대로 memcpy하는 방식은 소유권을 복원하지 못합니다. 직렬화 필드와 restore 후 재생성할 캐시를 분리하고, 입력 history는 `tick → player별 입력` ring으로 별도 보관합니다.

## Late Input 복원 절차

tick 124의 `stateVersion=7`, combat RNG state 421, loot RNG state 18을 저장했다고 하겠습니다. 125~130을 모두 `P`로 예측했는데 실제 127이 `A`였으면 `S[125]`를 읽고 125~126에는 기존 입력, 127에는 `A`, 128~130에는 이미 수신한 입력을 적용합니다. RNG도 125부터 다시 소비하므로 130의 checksum이 달라질 수 있습니다. 새 결과를 현재 speculative state로 교체한 뒤, 확정 prefix보다 이전의 외부 효과를 다시 보내지 않습니다. 이 숫자는 설명용 trace이며 실제 엔진 실행 결과가 아닙니다.

입력 sequence가 늦게 도착한 tick을 찾는 기준도 명시해야 합니다. 이미 확정한 입력은 다시 rollback하지 않고, window 안에서 가장 오래된 영향을 주는 tick을 복원점으로 선택해 여러 늦은 입력을 한 번에 병합하는 편이 보통 한 번씩 되감는 것보다 낫습니다. window 밖이면 조용히 삽입하지 말고 correction/resync 같은 프로토콜 정책을 실행합니다.

## Input Delay와 체감 지연

고정 delay를 2 tick으로 두면 입력을 60Hz 시뮬레이션의 2개 tick 뒤에 예약하는 **명목 scheduling interval**은 `2/60 s = 33.3ms`입니다. 6 tick은 `6/60 s = 100ms`입니다. 이는 샘플링 위상, 전송, simulation, render, display를 포함한 input-to-photon latency가 아닙니다. 같은 타이밍 convention에서 입력을 tick 경계 전에 샘플하는지, 다음 경계에 넣는지를 고정하지 않고 “체감 지연이 정확히 33.3ms”라고 말하면 안 됩니다.

delay가 커지면 상대 입력이 그 buffer 안에 도착할 기회가 늘어 예측 miss와 평균 replay 길이가 감소할 수 있습니다. 대신 로컬 입력도 늦게 반영되어 조작감이 나빠집니다. 2와 6을 비교할 때는 late arrival 비율, rollback 길이 p95/p99, catch-up CPU, input-to-photon을 동일한 loss/jitter 조건에서 기록합니다. delay는 packet loss나 서로 다른 부동소수점 실행을 해결하지 않으므로, 낮은 miss율만으로 큰 delay를 선택하지 않습니다.

## 재실행 결정성

같은 입력을 같은 함수에 넣는 것만으로는 부족합니다. 충돌 검사 순서, entity 생성·삭제 순서, fixed timestep, 병렬 job merge, 부동소수점 정책, RNG stream state가 모두 같아야 합니다. 전역 RNG는 combat branch가 draw를 한 번 덜 하는 것만으로 loot의 다음 값까지 바꾸므로 시스템별 stream을 snapshot에 넣고 소비권한을 분리합니다. 외부 시계, 네트워크 도착 순서, 스레드 스케줄을 simulation 입력으로 직접 읽지 않습니다.

개발 빌드에서는 첫 divergence tick의 checksum과 entity 목록, stream별 state, 입력 sequence를 로그로 남깁니다. `stateVersion`이 다른 snapshot을 현재 코드로 묵시적으로 읽지 않고, migration 또는 resync를 선택합니다. 결정성 검증은 정상 경기보다 entity spawn, 늦은 입력, 중복 packet, RNG branch 변경을 포함한 replay fixture에서 더 잘 드러납니다.

## 외부 효과 커밋

snapshot으로 되돌릴 수 있는 것은 simulation 내부 상태뿐입니다. 화면에 이미 보낸 particle, 재생 중인 오디오 핸들, 외부 DB 지급, 메일과 같은 recipient 관찰 상태는 restore가 취소하지 못합니다. 그래서 `ActionId=(actorGeneration, localCounter)`와 speculative epoch를 두고, 사운드·particle은 취소/교체 가능한 presentation으로 처리하며, 피해·보상은 confirmed tick 뒤 한 번만 커밋하는 것이 이 문서의 integration policy입니다. GGPO가 이 정책을 보편적으로 규정한다는 뜻은 아닙니다.

같은 action이 replay되어도 ledger의 멱등키가 이미 처리되었으면 피해나 지급을 다시 적용하지 않습니다. actor가 삭제 후 재생성되면 tick만으로 만든 ID는 옛 entity와 새 entity를 혼동하므로 generation을 포함해야 합니다. 네트워크 재전송과 rollback replay를 동일하게 deduplicate하되, 실제로 새로 생성된 action은 새 ID를 가져야 합니다.

## Window와 자원 예산

snapshot 하나가 64KiB라면 30 tick의 payload는 `64×30=1920KiB`, 즉 약 1.875MiB이고, 120 tick은 `7680KiB`, 약 7.5MiB입니다. 이것은 allocator, alignment, history와 delta base를 제외한 계산입니다. entity 수가 늘면 snapshot 복사 bandwidth와 cache pressure가 memory capacity보다 먼저 병목이 될 수 있습니다. 한 번의 late input replay CPU는 대체로 되감은 tick 수에 비례하지만, 같은 프레임의 여러 late 입력과 restore chain은 p99를 악화시킵니다.

정상 tick budget을 `B`라고 할 때 catch-up이 지속적으로 `B`를 초과하면 window 축소나 delay 변경을 경기 중 임의로 적용하지 않습니다. 이 둘은 fairness와 peer protocol을 바꾸는 product 정책이므로 사전 협상과 측정이 필요합니다. 실무 선택지는 window 상한, replay를 합치는 스케줄러, snapshot 압축, 또는 full correction/resync이며 각 정책의 중단·공정성 결과를 명시합니다.

## 구현 검증과 실패 경계

작은 fixture는 `S[t]` invariant를 검사하는 tick 124/125 사례, window 경계, packet 중복·재정렬, entity generation 교체, combat RNG draw 변화, action ID 재전송을 포함해야 합니다. 기대값은 같은 확정 prefix에서 같은 checksum, speculative presentation의 교체 가능성, irreversible effect의 단일 commit입니다. 상태를 복원했는데 checksum이 갈라지면 먼저 입력 귀속과 RNG state를 보고, 이후 entity 순서와 floating-point 정책을 좁혀 갑니다.

```diagram
{"title":"늦은 입력의 복원과 커밋 경계","caption":"입력 history가 state-before-tick snapshot을 고르고 headless replay를 수행한 뒤 확정 경계를 넘어 외부 효과를 한 번만 커밋합니다.","rows":[[{"id":"history","label":"입력 history","detail":["sequence·tick 귀속"]}],[{"id":"snapshot","label":"S[t] snapshot","detail":["입력 전 gameplay state"]}],[{"id":"restore","label":"복원점 선택","detail":["late tick 이전 경계"]}],[{"id":"replay","label":"headless replay","detail":["입력·RNG 재소비"]}],[{"id":"commit","label":"effect commit","detail":["confirmed tick·멱등 ID"]}]],"edges":[{"from":"history","to":"snapshot","label":"영향 tick 조회"},{"from":"snapshot","to":"restore","label":"state invariant 적용"},{"from":"restore","to":"replay","label":"현재까지 재실행"},{"from":"replay","to":"commit","label":"외부 효과 분리"}]}
```

## 참고자료와 적용 범위

GGPO 공식 사이트(https://www.ggpo.net/)는 상태 저장·복원과 렌더링 없이 프레임을 실행하는 rollback 통합 경계를 설명하는 자료로 사용했습니다. 해당 페이지는 보편적인 input delay, snapshot 필드, 외부 효과 ledger를 정하지 않으므로 이 문서의 ID와 commit은 애플리케이션 정책입니다. 숫자 trace와 memory 값은 설명용 계산이고 게임 엔진에서 실행한 측정 결과가 아닙니다. deterministic simulation의 세부사항은 실제 엔진과 목표 플랫폼의 fixed-point·floating-point 계약을 별도로 고정해야 합니다.
