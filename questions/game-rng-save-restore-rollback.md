---
id: game-rng-save-restore-rollback
title: rollback snapshot에 RNG seed만 저장하고 내부 state를 저장하지 않으면 어떤 문제가 생기나요?
difficulty: 중하
category: 게임 서버
tags:
  - game
  - mechanism
related:
  - pure-random-state-threading
---
# rollback snapshot에 RNG seed만 저장하고 내부 state를 저장하지 않으면 어떤 문제가 생기나요?

## 구두 답변
seed는 초기화 재료이고 현재 소비 위치가 아닙니다. seed 10에서 500회 draw한 상태와 초기 상태는 다르므로 tick 200 snapshot에 seed만 저장하면 restore 후 첫 값부터 달라집니다. snapshot에는 algorithm ID·version, stream key와 state bytes를 넣거나, seekable generator가 중간 draw를 정확히 재현한다는 전제에서 draw count를 저장합니다. combat state만 복원하고 loot를 현재 위치에 두면 새 입력과 restore 오류를 구분할 수 없으므로 모든 stream을 원자적으로 복원합니다. generator version이 바뀌면 같은 bytes 의미가 달라질 수 있으므로 호환·migration·resync 정책을 명시합니다. state bytes는 저장량이 있지만 draw count 재계산은 조건 분기와 lifecycle이 같아야 하므로 rollback에서는 작은 state 직접 저장이 보통 더 단순합니다.


복원 검사는 seed 비교로 끝내지 않고 snapshot 직후의 각 stream state와 restore 직후 bytes를 byte-level로 비교한 뒤 다음 draw의 value와 nextState를 비교합니다. state가 128비트인데 직렬화 endian을 한쪽이 다르게 읽으면 같은 seed라도 첫 draw부터 달라집니다. 따라서 schema는 endian, algorithm variant, state length도 고정하고 알 수 없는 길이는 거절합니다. draw count 재계산을 선택했다면 중간에 조건부 draw가 있는 fixture를 넣어 count가 실제 소비와 함께 움직이는지 확인해야 합니다. snapshot 파일을 다른 플랫폼에서 읽는 경우 state byte order와 integer width를 fixture로 고정해야 합니다.
## 득점 포인트
- seed와 현재 state를 구분한다.
- stream별 state와 generator version을 저장한다.
- restore 직후 첫 draw를 비교한다.
- bytes와 draw count의 전제를 비교한다.

## 감점 포인트
- seed만 저장한다.
- 한 stream만 restore한다.
- version 변경도 호환된다고 단정한다.
- 중간 상태를 마지막 결과로만 검증한다.

## 더 파고들 거리
- 큰 state 배열의 restore p99를 어떻게 제한할까요?
- 구버전 replay를 새 generator가 못 읽으면?
