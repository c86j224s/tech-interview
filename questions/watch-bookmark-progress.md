---
id: watch-bookmark-progress
title: bookmark를 객체 변경으로 처리하면 안 되는 이유와 controller가 갱신할 상태를 설명하세요.
difficulty: 중하
category: 인프라
tags:
  - watch
  - resourceVersion
  - relist
related:
  - service-discovery-stale-endpoint
---
# bookmark를 객체 변경으로 처리하면 안 되는 이유와 controller가 갱신할 상태를 설명하세요.

## 구두 답변
bookmark는 `ADDED`, `MODIFIED`, `DELETED`가 아니라 서버가 특정 resourceVersion까지 관찰 위치를 진전시켰다는 `BOOKMARK` 이벤트입니다. 따라서 object cache의 spec이나 generation을 바꾸지 않고, 필요하다면 controller의 last-observed-rv와 수신 시각, 연결 상태만 갱신합니다. 예를 들어 객체 변경 없이 bookmark `rv=300`이 오면 Pod의 spec은 그대로여야 하고 업무 reconcile callback도 만들지 않아야 합니다.

`allowWatchBookmarks=true`로 요청해도 서버가 일정한 빈도나 항상 bookmark를 보낸다고 가정할 수 없습니다. bookmark rv를 업무 version, 외부 티켓 commit offset, “모든 이전 효과 완료” 번호로 저장하면 관찰 cursor와 업무 처리 계약을 혼동합니다. 연결이 끊긴 뒤 마지막 bookmark가 남아 있어도 history가 만료되면 relist가 필요합니다. bookmark는 cache의 현재 object를 대신하지 않는 진행 체크포인트입니다.

검증 fixture에는 MODIFIED rv=299, BOOKMARK rv=300, 연결 종료를 넣습니다. 기대 결과는 object callback 1회, bookmark 기록 1회, 외부 효과 1회뿐입니다. bookmark 직후 update가 오면 update만 object handler로 보내고 cursor 기록과 분리합니다. 실제 bookmark 전달 빈도와 cache freshness는 대상 Kubernetes 버전과 client 구현에서 측정해야 하며, 여기의 rv는 설명용 상태입니다.

bookmark 기록은 liveness 지표이지 correctness commit이 아닙니다. 예를 들어 마지막 bookmark가 300이어도 처리 큐에 rv=299의 reconcile이 남아 있을 수 있으므로, bookmark 수신만으로 backlog를 비우지 않습니다. 업무 처리 완료는 별도의 queue offset이나 controller 상태로 기록하고, bookmark cursor는 API 관찰 위치로만 사용해야 두 계약의 장애 복구가 독립적입니다.

참고: https://kubernetes.io/docs/reference/using-api/api-concepts/ (2026-09-19에 읽은 공식 문서 본문; 대상 릴리스와 실제 cluster 실행은 별도 확인)

## 득점 포인트
- bookmark와 object event, resourceVersion과 generation을 네 개의 서로 다른 역할로 구분합니다.
- cache를 바꾸지 않고 기록할 수 있는 last rv·시각·연결 상태를 제시합니다.
- bookmark 부재나 만료 시 relist가 남아 있음을 설명합니다.

## 감점 포인트
- bookmark마다 object update와 reconcile을 발생시킵니다.
- bookmark rv를 외부 처리 완료 offset으로 사용합니다.
- bookmark가 있으면 cache가 반드시 최신이라고 단정합니다.

## 더 파고들 거리
- bookmark age를 freshness 지표로 만들 때 어떤 SLO를 둘까요?
- bookmark와 실제 MODIFIED가 섞인 stream에서 callback 중복을 어떻게 막을까요?
