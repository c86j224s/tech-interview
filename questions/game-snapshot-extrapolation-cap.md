---
id: game-snapshot-extrapolation-cap
title: snapshot이 끊겼을 때 extrapolation을 언제 중단해야 하나요?
difficulty: 중하
category: 게임 서버
tags:
  - snapshot
  - extrapolation
  - jitter
related:
  - game-state-input-delivery-classes
---
# snapshot이 끊겼을 때 extrapolation을 언제 중단해야 하나요?

## 구두 답변

extrapolation은 마지막 관측 속도와 렌더 규칙을 잠깐 연장하는 표시 정책이므로 다음 snapshot까지 무한히 계속하지 않습니다. 마지막 sample이 t=0이고 `maxExtrapolation=50ms`인데 100ms 동안 packet이 끊겼다면 0~50ms만 예측하고 그 뒤에는 정지·stale/fade·resync 중 계약된 결과를 보여 줍니다. `p=p0+v*t`는 가속·벽·방향 전환·teleport를 모르므로 cap을 넘기면 부드러움보다 상태 수렴을 우선합니다. 속도와 함께 충돌 제약을 넣어도 그 위치가 서버 확정이라는 뜻은 아니며, 권위 sample이 오면 예측 위치와의 correction을 snap·감쇠 보정·재생성 중 정책에 따라 처리합니다. window는 평균 ping이 아니라 결측 burst 분포, entity 중요도, 이동 속도, 허용 correction, lifecycle event 손실 여부로 정합니다. 투사체는 20ms, 장식물은 더 길게 허용할 수 있지만 destroy/spawn을 위치 외삽으로 복원하지 않습니다. 측정은 stale 전환 시각, 외삽 거리, authoritative 도착 후 correction, 벽 관통과 ghost 수를 기록해야 하며 “화면이 계속 움직였다”만으로 성공 판정하지 않습니다.


cap 이후 stale 상태를 어떻게 보일지는 entity 중요도와 lifecycle 위험에 따라 다릅니다. 장식물은 fade 후 숨길 수 있지만 플레이어와 투사체는 위치를 멈추고 “unknown” 상태를 표시한 뒤 full snapshot을 요청하는 편이 낫습니다. 새 sample이 도착하면 이전 외삽 궤적을 사실로 저장하지 않고 마지막 authoritative sample과의 차이를 계산합니다. 차이가 허용 오차를 넘으면 감쇠 보정 대신 즉시 discontinuity를 사용해야 보정 애니메이션이 벽이나 삭제된 객체를 가로지르지 않습니다.
## 득점 포인트

- 50ms cap과 100ms 결측 trace에서 표시·stale 경계를 수치로 말합니다.
- 속도식의 한계, 충돌·teleport·lifecycle event의 별도 처리를 구분합니다.
- entity별 window를 correction과 packet-loss 지표로 선택합니다.

## 감점 포인트

- 새 snapshot이 올 때까지 마지막 속도를 무제한 연장합니다.
- client 외삽 위치를 authoritative state로 간주하거나, stale 이후 destroy를 위치값으로 복원합니다.
- 장시간 손실에서 correction 크기와 벽 관통을 측정하지 않습니다.

## 더 파고들 거리

- 권위 위치가 3m 뒤에 도착했을 때 snap과 감쇠 보정의 perceptual·gameplay 비용을 비교해 보세요.
- 결측 packet이 delta이고 baseline도 없다면 외삽보다 resync를 선택해야 하는 조건을 정의해 보세요.
