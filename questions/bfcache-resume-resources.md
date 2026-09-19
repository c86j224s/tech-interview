---
id: bfcache-resume-resources
title: pagehide에서 모든 WebSocket과 timer를 취소하면 bfcache 복원 뒤 어떤 문제가 생길 수 있나요?
difficulty: 중하
category: 웹
tags:
  - bfcache
  - pageshow
  - pagehide
  - history
related:
  - ios-view-lifecycle
---
# pagehide에서 모든 WebSocket과 timer를 취소하면 bfcache 복원 뒤 어떤 문제가 생길 수 있나요?

## 구두 답변

문제는 취소 자체보다 복원 후 재개 계약이 없다는 데 있습니다. `pagehide`에서 화면 전용 timer를 멈추는 것은 합리적일 수 있지만, WebSocket을 닫거나 브라우저가 연결을 끊은 뒤 `pageshow`에서 handshake·재구독·누락 메시지 보정을 하지 않으면 화면은 과거 DOM만 보여 주고 실시간 상태는 멈춥니다. 반대로 socket 객체가 남아 있다고 살아 있는 연결이라고 가정해도 안 됩니다.

작은 trace를 두 종류로 나눕니다. 화면 세대 3에서 만료 시각이 10:05:00이고 마지막 socket sequence가 42인 상태로 `pagehide(persisted:true)`가 왔다고 하겠습니다. `setInterval`의 남은 tick을 저장하지 말고 복원 시 현재 시각 10:06:10을 읽어 이미 만료됐다고 계산합니다. WebSocket은 `pageshow`에서 ping/pong 또는 애플리케이션 handshake를 하고, 연결이 재수립되면 마지막 sequence 42를 기준으로 snapshot이나 43 이후 증분을 요청합니다. 증분 범위를 서버가 제공하지 않으면 전체 snapshot이 안전한 대안입니다.

일반 종료와 bfcache 복원도 다릅니다. `persisted:false`에서는 문서가 다시 돌아오지 않을 수 있으므로 화면 자원을 정리하되 중요한 draft는 별도 내구화합니다. 모바일 앱 전환이나 프로세스 종료는 pagehide가 오지 않을 수 있으므로 이 이벤트만으로 서버 저장을 보장하지 않습니다. 재연결 시도와 handler는 owner·세대별 하나로 제한하고, 기존 구독을 제거하지 않아 동일 메시지를 두 번 반영하는 경합도 막습니다. 예를 들어 재연결 handshake가 300ms 동안 pending이면 두 번째 handshake를 만들지 않고, 복원된 화면은 `syncing` 상태로 둡니다. snapshot이 sequence 50에서 끝난 뒤에야 51 이후 delta를 적용해 42 시점의 오래된 DOM을 최신 상태로 교체합니다.

## 득점 포인트

- timer를 tick 수가 아니라 절대 만료 시각으로 복원합니다.
- sequence 42 이후 snapshot/증분 재동기화가 필요한 이유를 trace로 설명합니다.
- persisted true·false와 pagehide 미전달을 서로 다른 실패 경계로 구분합니다.

## 감점 포인트

- 모든 자원은 pagehide에서 닫아야 bfcache가 된다고 단정합니다.
- socket 객체가 존재하면 끊긴 동안의 메시지도 자동 재생된다고 가정합니다.
- 백그라운드에서 멈춘 timer의 남은 횟수만 이어 가면 실제 시간을 보존한다고 말합니다.

## 더 파고들 거리

- snapshot과 증분 응답 순서가 뒤집힐 때 sequence 경계를 어떻게 적용할까요?
- 복원 직후 polling을 한꺼번에 몰지 않으면서 만료 상태를 정확히 표시하려면 어떻게 할까요?
