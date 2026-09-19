---
id: game-rollback-replay-side-effects
title: rollback 재실행 중 같은 공격 sound와 damage event가 두 번 발생하지 않게 어떻게 하나요?
difficulty: 중하
category: 게임 서버
tags:
  - game
  - mechanism
related:
  - lag-compensation-rewind
---
# rollback 재실행 중 같은 공격 sound와 damage event가 두 번 발생하지 않게 어떻게 하나요?

## 구두 답변
simulation 결과와 외부 effect commit을 분리하고 stable action ID와 confirmed tick을 사용합니다. actor generation 4의 counter 88로 `ActionId=(4,88)`인 발사가 tick 130에 만들어졌다고 하겠습니다. 예측 단계의 사운드·particle은 speculative epoch로 표시하고, rollback 후 같은 action이 다시 계산되면 교체하거나 한 번만 재생합니다. 피해·보상·메일은 confirmed prefix 뒤 ledger에 멱등키로 commit합니다. tick만 ID로 쓰면 actor 삭제 후 generation 5의 새 공격과 옛 공격을 혼동하므로 generation이 필요합니다. 반대로 실제 두 번 공격한 새 action은 새 counter를 받아야 합니다. 이미 외부 DB에 적용된 효과는 snapshot restore가 취소하지 못하므로 외부 사실을 gameplay snapshot에 넣지 않습니다. 이 confirmed commit·speculative cancel·action ledger는 GGPO의 보편 규칙이 아니라 애플리케이션 integration policy이며, 오디오처럼 취소하기 어려운 효과의 즉시 재생 여부는 UX와 중복 비용을 따로 정합니다.


커밋 순서도 중요합니다. simulation이 `ActionId=(4,88)`을 다시 만들었다고 해서 곧바로 외부 결제를 호출하지 않고, confirmed tick과 ledger의 unique key 조건을 같은 저장 경계에서 검사합니다. ledger에는 accepted, applied, cancelled 같은 상태를 두고 재시도 시 applied를 다시 실행하지 않게 합니다. 로컬 사운드는 네트워크 권위 효과와 분리해 취소 가능한 voice handle을 epoch에 연결할 수 있지만, 이미 스피커에서 난 소리를 완전히 지울 수는 없으므로 저지연 재생과 중복 방지 사이의 선택을 명시해야 합니다.
## 득점 포인트
- simulation·presentation·irreversible commit을 분리한다.
- action ID에 actor generation을 넣는다.
- confirmed 전과 후의 효과를 다르게 처리한다.
- 재전송, replay, 실제 신규 action을 구분한다.

## 감점 포인트
- rollback마다 damage를 재발행한다.
- 외부 DB가 복원된다고 말한다.
- tick만 ID로 사용한다.
- 모든 동일 kind 이벤트를 무조건 제거한다.

## 더 파고들 거리
- ledger와 simulation을 어떤 저장 경계에서 원자화할까요?
- 취소 불가 오디오의 UX 정책은?
