---
id: game-quaternion-squad-discontinuity
title: 회전 keyframe 사이의 보간이 특정 프레임에서 튀는 경우 어떤 상태를 검사하나요?
difficulty: 중하
category: 게임 서버
tags:
  - quaternion
  - keyframe
  - continuity
related:
  - rewind-tick-interpolation-evidence
---
# 회전 keyframe 사이의 보간이 특정 프레임에서 튀는 경우 어떤 상태를 검사하나요?

## 구두 답변

특정 프레임의 튐은 SLERP 문제로 단정하지 않고 keyframe의 sign continuity, norm², 시간 간격과 불연속 event를 먼저 확인합니다. 인접 key의 dot이 음수면 current를 뒤집어 같은 회전 표현으로 정렬합니다. 예를 들어 항등의 `(1,0,0,0)` 다음에 `(-1,0,0,0)`이 오면 자세는 같지만 squad tangent를 그대로 만들 때 경로가 튈 수 있습니다. 이어 `dt=0`, sequence 역전, control quaternion의 비정규화와 sign 불일치를 검사합니다.

teleport, respawn, snap turn이면 큰 각도를 smoothing하지 않고 discontinuity flag로 구간을 끊습니다. 늦게 온 event가 이미 렌더한 상태를 바꿀 때는 sequence로 재보간 시작점을 정합니다. 로그에는 key ID, dot sign, norm², 상대각, dt, tangent, event flag를 남깁니다. 모든 큰 회전을 오류로 취급하지 않는 것이 핵심입니다.

squad의 튐은 endpoint가 정상이어도 control quaternion이 만든 overshoot에서 생길 수 있습니다. 따라서 `q0-q1`만 비교하지 말고 실제 곡선의 샘플 각도와 각속도를 key 구간마다 검사합니다. teleport flag가 있으면 control을 계산하지 않고 새 key를 시작점으로 삼아야 하며, 이벤트가 없는 큰 회전만 데이터 오류로 분류하지 말고 콘텐츠 의도와 함께 판정합니다.

 원인 분류 뒤 수정도 다릅니다. sign 문제는 전처리로 정렬하고, dt 문제는 key를 합치거나 거부하며, teleport는 event metadata를 복원합니다. 이를 모두 보간 epsilon으로 덮으면 콘텐츠의 의도와 수치 오류를 함께 숨기게 됩니다.

 이 검사는 한 프레임의 화면 캡처보다 key 구간 전체의 상대각·각속도 trace를 우선합니다.

## 득점 포인트

- 끝점 부호·norm과 control quaternion·시간 간격을 따로 검사합니다.
- teleport를 수치 잡음이 아닌 불연속 사건으로 처리합니다.

## 감점 포인트

- 모든 큰 회전을 보간 오류로 판단합니다.
- 시간 역전과 중복 key를 epsilon으로 숨깁니다.

## 더 파고들 거리

- 비균일 keyframe 간격을 tangent 계산에 어떻게 반영하나요?
- 뒤늦게 들어온 key가 기존 control point를 바꿀 때 어느 구간을 다시 계산하나요?
