---
id: watch-resourceversion-expired-relist
title: watch가 410 Gone을 반환하면 마지막 변경을 놓치지 않도록 cache를 어떻게 재구성하나요?
difficulty: 중하
category: 인프라
tags:
  - watch
  - resourceVersion
  - relist
related:
  - service-discovery-stale-endpoint
---
# watch가 410 Gone을 반환하면 마지막 변경을 놓치지 않도록 cache를 어떻게 재구성하나요?

## 구두 답변
410 Gone은 단순한 순간 네트워크 오류가 아니라 요청한 resourceVersion의 상세 history를 서버가 더 이상 제공하지 못한다는 expired 신호로 처리합니다. 그러므로 `rv=900`으로 무한 재시도하지 않습니다. local cache를 신뢰할 수 없는 상태로 표시하고 새 LIST를 보내 현재 객체 집합과 collection `rv=1250`을 받은 뒤, 그 기준 이후를 watch합니다. 901~1249의 모든 이벤트를 복원한다고 약속하지 않고, 현재 목록에 있는 객체를 설치하고 목록에 없는 예전 객체를 제거해 상태를 재구성합니다.

LIST 직후 같은 객체의 update가 watch에서 다시 오는 것은 정상적으로 흡수해야 합니다. handler는 UID와 현재 resourceVersion/generation을 보고 이미 반영된 상태면 no-op하거나 원하는 상태 reconcile을 다시 계산합니다. 이름만 key로 쓰면 같은 이름의 새 UID를 옛 delete가 지울 수 있으므로 UID 조건을 둡니다. relist가 여러 worker에서 동시에 발생하면 backoff와 jitter를 넣되, stale cache로 외부 delete를 계속 수행하는 것보다 재동기화를 우선하는 차단 기준을 둡니다. LIST-watch 사이의 세부 누락 방지는 대상 apiserver와 client-go 계약을 확인해야 하며 이 설명은 cluster 실행 결과가 아닙니다.

cache 교체 중 외부 reconcile이 부분 상태를 보지 않도록 generation 또는 atomic swap을 사용합니다. 목록에 없는 name을 바로 외부 삭제 대상으로 보내기 전에 relist 기준이 설치되었는지 확인하고, 새 목록에 UID가 다시 나타나면 옛 삭제를 취소해야 합니다. 410 복구 성공의 판정도 watch 연결 성공이 아니라 현재 list rv, cache object 수, 마지막 reconcile 결과가 일치하는지로 둡니다.

참고: https://kubernetes.io/docs/reference/using-api/api-concepts/ (2026-09-19에 읽은 공식 문서 본문; 대상 릴리스와 실제 cluster 실행은 별도 확인)

## 득점 포인트
- 410을 history expiration으로 해석하고 동일 rv 재시도를 배제합니다.
- LIST의 현재 상태와 새 rv로 cache를 교체하는 중간 상태를 숫자로 추적합니다.
- LIST 직후 중복 event, UID 검증, relist backoff를 함께 설명합니다.

## 감점 포인트
- 410을 일시 네트워크 오류로만 보고 같은 cursor를 반복합니다.
- 없는 이벤트를 영구 로그처럼 재생할 수 있다고 합니다.
- 이름만으로 늦은 delete를 적용해 새 UID 객체를 제거합니다.

## 더 파고들 거리
- client-go reflector가 LIST와 watch 경계를 어떻게 다루는지 확인하려면 무엇을 읽을까요?
- relist 폭주와 stale cache 사이의 차단 임계값을 어떻게 정할까요?
