---
id: game-rollback-input-delay-choice
title: 고정 input delay를 늘리면 rollback 비용과 조작감은 어떻게 달라지나요?
difficulty: 중하
category: 게임 서버
tags:
  - game
  - mechanism
related:
  - client-prediction-input-replay
---
# 고정 input delay를 늘리면 rollback 비용과 조작감은 어떻게 달라지나요?

## 구두 답변
고정 delay는 상대 입력이 도착할 완충 구간을 늘려 예측 miss와 replay 길이를 줄일 수 있지만 로컬 입력도 늦게 반영됩니다. 60Hz의 2 tick은 `2/60=33.3ms`, 6 tick은 `6/60=100ms`인 명목 scheduling interval입니다. 이는 input-to-photon이 아닙니다. polling phase, transport, simulation, render, display와 tick 경계 convention을 더해 측정해야 합니다. 예를 들어 jitter가 0~4 tick이면 delay 2에서는 일부 입력이 예측 뒤 도착하지만 delay 6에서는 buffer 안에 들어올 가능성이 커집니다. 대신 모든 버튼의 반응이 늦어집니다. late 비율, rollback p95/p99, catch-up CPU, input-to-photon을 같은 loss/jitter 조건에서 비교하며 평균 rollback만으로 선택하지 않습니다. packet loss와 실행 divergence는 delay로 해결되지 않고, 동적 delay는 peer tick 계약과 fairness를 바꾸므로 별도 protocol 정책입니다.


측정 예를 들면 10,000개 input sample에서 delay 2의 late 비율이 18%, rollback p99가 4 tick이고 delay 6에서 각각 3%, 1 tick으로 내려갔다고 해도, input-to-photon p95가 58ms에서 125ms로 늘면 조작감 요구를 만족하지 못할 수 있습니다. 이 수치는 실행 결과가 아니라 지표를 읽는 방법의 예시입니다. 네트워크 상태에 따라 값을 바꾸려면 양 peer가 같은 tick 번호에 같은 delay를 적용해야 하며, 한쪽만 바꾸면 입력 sequence의 의미 자체가 어긋납니다. 입력 지연 비교에서는 동일한 tick budget에서 render를 생략해 얻은 catch-up이 latency를 악화시키지 않는지도 함께 봅니다.
## 득점 포인트
- 2·6 tick을 명목 interval과 체감 latency로 구분한다.
- late 비율·rollback p99·CPU·입력 반응을 함께 측정한다.
- loss와 deterministic divergence를 delay 문제와 구분한다.
- 동적 변경의 peer 계약을 설명한다.

## 감점 포인트
- 100ms를 체감 latency라고 단정한다.
- rollback 평균만 보고 6 tick을 고른다.
- delay가 loss를 고친다고 말한다.
- 샘플링과 표시 지연을 빼고 결론낸다.

## 더 파고들 거리
- jitter p99로 delay 상한을 정하는 방법은?
- fairness 때문에 동적 변경을 금지할 조건은?
