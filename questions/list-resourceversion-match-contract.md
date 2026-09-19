---
id: list-resourceversion-match-contract
title: resourceVersion 옵션이 다른 LIST의 최신성 의미를 어떻게 계약해야 하나요?
difficulty: 중하
category: 인프라
tags:
  - watch
  - resourceVersion
  - relist
related:
  - service-discovery-stale-endpoint
---
# resourceVersion 옵션이 다른 LIST의 최신성 의미를 어떻게 계약해야 하나요?

## 구두 답변
핵심은 `resourceVersionMatch`를 최신성의 막연한 힌트가 아니라 LIST snapshot 계약으로 쓰는 것입니다. 읽은 Kubernetes API Concepts 기준으로 `resourceVersionMatch=Exact`는 지정한 resourceVersion의 collection snapshot을 요구하며, 그 버전이 사용 불가능하면 410이 될 수 있습니다. `NotOlderThan`은 지정 rv보다 오래되지 않은 snapshot을 허용하므로 exact snapshot과 다릅니다. `resourceVersionMatch`만 단독으로 쓰는 것은 유효하지 않고, `resourceVersion`과 함께 지정해야 합니다.

요청 파라미터를 생략하거나 빈 값, `0`, 비제로 값으로 두었을 때의 읽기 경로와 consistency는 대상 릴리스 문서 표를 기준으로 고정해야 합니다. 예를 들어 UI 목록이 약간의 stale을 허용한다면 cache-friendly 경로를 선택할 수 있지만, controller가 그 결과로 외부 삭제를 결정한다면 허용 stale과 재검증 시점을 명시해야 합니다. `limit`을 사용한 pagination은 continuation token이 같은 snapshot 경계를 이어가며, token의 버전이 만료되면 410을 처리해야 합니다. rv 숫자를 벽시계나 다른 resource의 업무 순번으로 비교하면 안 됩니다.

검증 로그에는 요청 rv, match, limit, 반환 collection rv, continue token, 410 여부를 함께 남깁니다. Exact rv=120 요청에 120 snapshot이 없으면 성공한 “대충 최신” 결과로 바꾸지 않고 재시도/새 기준 선택으로 분기합니다. NotOlderThan은 120 이상 동기화된 결과를 받았는지와 후속 작업이 그 의미를 허용하는지 확인합니다.

Exact를 사용한 controller는 410을 “결과 없음”으로 삼지 말고 새 snapshot을 취할지 호출자에게 재시도하도록 결정해야 합니다. NotOlderThan은 지정 rv 이상이라는 하한을 충족하지만, 그 결과가 특정 객체의 업무 상태를 최신으로 보장하는 것은 아니므로 후속 update에는 UID·generation 조건을 붙입니다. page 단위로 반환된 collection의 continue token을 임의로 합성하거나 다른 LIST와 섞지 않고, 토큰이 가리키는 snapshot을 끝까지 소비하거나 만료 시 처음부터 재구성합니다.

참고: https://kubernetes.io/docs/reference/using-api/api-concepts/ (2026-09-19에 읽은 공식 문서 본문; 대상 릴리스와 실제 cluster 실행은 별도 확인)

## 득점 포인트
- Exact와 NotOlderThan의 snapshot 차이와 410 조건을 직접 답합니다.
- 생략·0·비제로 rv와 pagination continuation을 대상 문서 계약으로 연결합니다.
- 최신성 요구를 UI 표시와 외부 효과 결정으로 나누어 비용을 판단합니다.

## 감점 포인트
- 모든 rv 숫자를 전역 시간이나 업무 순서로 비교합니다.
- Exact와 NotOlderThan을 같은 강한 읽기로 설명합니다.
- continuation token 만료와 410을 무시하고 무한 재시도합니다.

## 더 파고들 거리
- cache read와 quorum 성격의 읽기를 진단 화면에서 어떻게 구분할까요?
- NotOlderThan 결과로 삭제하기 전 어떤 재검증을 넣어야 할까요?
