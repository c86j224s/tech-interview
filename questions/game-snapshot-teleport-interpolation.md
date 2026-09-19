---
id: game-snapshot-teleport-interpolation
title: teleport snapshot을 일반 위치 보간에 넣으면 어떤 오표시가 생기나요?
difficulty: 중하
category: 게임 서버
tags:
  - snapshot
  - teleport
  - 불연속
related:
  - rewind-tick-interpolation-evidence
---
# teleport snapshot을 일반 위치 보간에 넣으면 어떤 오표시가 생기나요?

## 구두 답변

teleport은 연속 이동 sample이 아니라 불연속 사건이므로 일반 위치 보간에 넣으면 존재하지 않았던 경로를 화면에 만듭니다. 예를 들어 S20에서 x=10이던 entity가 S21에서 x=1000으로 teleport했다면 α=.5에서 x=505가 됩니다. 실제 서버 simulation에는 10과 1000 사이를 지난 tick이 없는데도 client는 그 중간 위치를 몇 frame 표시하고, 벽을 관통하거나 먼 적이 달려간 것처럼 보여 줍니다. 따라서 snapshot에 teleport·respawn·portal·stance/hitbox 변경 marker를 함께 싣고 marker 앞 segment를 닫습니다. 수신자는 이전 위치를 새 위치까지 섞지 않고 새 pose로 즉시 전환하거나, 게임 규칙에 맞는 fade·effect를 별도 렌더링합니다. marker가 없는 정상 이동에만 `p=(1-α)p0+αp1`을 씁니다. 좌표 차이가 크다는 이유만으로 항상 teleport라고 추정하면 빠른 정상 이동을 잘못 끊을 수 있으므로 authoritative event 또는 명시된 분류 규칙이 필요합니다. 렌더 위치는 rewind 판정용 hitbox가 아니며, 검증에서는 벽 앞 teleport, destroy 직전 teleport, g7→g8 재생성을 각각 넣어 505 같은 중간 state와 old sample 연결이 없는지 확인합니다.


marker를 packet의 단순 boolean으로만 두면 버전이 다른 receiver가 의미를 잃을 수 있으므로 event kind와 적용 sequence를 함께 검증합니다. teleport marker가 있는 S21이 손실되고 S22만 도착한 경우에는 큰 좌표 차이를 보고 임의로 선형 보간하기보다, 규칙이 허용하면 discontinuity로 보수적으로 전환하거나 create/resync를 요청합니다. 정상적인 이동 속도 제한과 marker의 authoritative 의미를 분리해야 false positive로 매 frame을 끊는 문제도 피할 수 있습니다.
## 득점 포인트

- 10→1000, α=.5→505의 구체 계산으로 왜 허구의 궤적이 생기는지 설명합니다.
- discontinuity marker로 segment를 끊고 즉시 전환·별도 효과를 선택하는 기준을 제시합니다.
- 정상 고속 이동과 teleport 분류를 구분하고 render/rewind 상태를 분리합니다.

## 감점 포인트

- 큰 좌표 차이면 항상 자동 teleport로 판단한다고 합니다.
- 속도 제한만 걸어 선형 보간하면 실제 경로 부재 문제가 해결된다고 말합니다.
- 화면 중간 위치를 충돌 판정에 사용하거나 새 generation을 old sample에 연결합니다.

## 더 파고들 거리

- marker가 유실됐을 때 좌표 휴리스틱과 full resync 중 어느 쪽이 오표시 비용이 작은지 비교해 보세요.
- 회전·stance 변경처럼 좌표가 연속이어도 hitbox가 불연속인 사건을 같은 규칙으로 다뤄야 하는 이유를 설명해 보세요.
