---
id: game-inventory-trade-idempotency
title: 거래 요청 응답이 유실된 뒤 같은 inventory 거래를 재시도해도 복제되지 않게 하려면 무엇을 저장하나요?
difficulty: 중하
category: 게임 서버
tags:
  - inventory
  - trade
  - idempotency
related:
  - account-merge-invariants
  - reservation-hold-confirm-race
---
# 거래 요청 응답이 유실된 뒤 같은 inventory 거래를 재시도해도 복제되지 않게 하려면 무엇을 저장하나요?

## 구두 답변

응답 유실을 새 거래로 오해하지 않으려면 `trade_id` 또는 idempotency key를 실제 inventory 전이와 같은 내구 경계에 연결해야 합니다. 예를 들어 `t-77`이 P1의 `i-101`을 P2로 옮긴 뒤 ownership commit 후 응답 전에 끊겼다면, 재시도는 새 검을 만들지 않고 `t-77=committed`와 결과 참조를 반환해야 합니다. record만 별도 DB에 저장하면 record는 committed인데 item은 아직 P1에 있는 불일치가 생길 수 있습니다.

저장 record에는 key, 요청 fingerprint, 인증 actor, source/destination, item 또는 stack ID, 기대 version, 상태(`accepted/prepared/committing/committed/reconciling`), 결과, created/expiry를 둡니다. 같은 key·같은 fingerprint의 동시 요청 두 개는 한 쪽이 unique key를 선점하고 다른 쪽은 그 상태를 조회합니다. 같은 key인데 item이나 대상이 다르면 기존 성공을 재사용하지 않고 conflict로 거절합니다. 단일 DB에서는 양쪽 owner 변경과 record를 한 transaction으로 묶고, 서로 다른 서비스라면 saga·조정 상태·양쪽 ledger와 대사 정책이 필요합니다.

상태 trace도 중요합니다. `accepted`는 아직 ownership이 바뀌지 않은 접수이고 `committed`만 내구 소유권 전이를 뜻하게 하면 응답 재조회가 명확합니다. P1 제거 후 P2 추가 전에 장애가 나면 `in_transit/reconciling`으로 남기고 repair가 ledger와 inventory를 비교합니다. 이미 P2가 item을 소비했다면 원래 state를 덮어써 되돌리지 않고 correction event와 경제 효과를 조사합니다. key를 너무 일찍 만료하면 오래된 retry가 새 거래가 될 수 있으므로 client retry, queue redelivery, 복구 지연을 포함해 보존합니다. 외부 메일·보상은 outbox/inbox로 inventory commit과 구분하고, 멱등 보장 범위와 보상 지연을 운영 지표로 감시합니다.

## 득점 포인트

- 동일 거래 ID와 payload fingerprint를 실제 inventory 전이·결과 상태와 연결한다.
- 응답 유실을 실패로 취급해 새 거래를 만들지 않고 조회·멱등 재요청으로 처리한다.
- cross-service 부분 완료, key 보존 기간, correction·대사 경계를 설명한다.

## 감점 포인트

- 요청마다 새 trade ID를 발급해 재시도하면 중복을 막는다고 말한다.
- 동일 key인데 payload가 달라도 기존 성공을 돌려준다.
- 한쪽 소유권 변경 후 실패를 DB rollback 하나로 항상 되돌릴 수 있다고 주장한다.

## 더 파고들 거리

- 멱등 record가 만료된 뒤 도착한 재시도를 거절할지 새 요청으로 볼지 계약을 어떻게 정할까요?
- 거래 중 한쪽 item이 사용되면 correction을 어떤 원장으로 기록할까요?
- 계정 병합과 거래가 동시에 일어날 때 owner canonicalization과 lock 순서는 무엇일까요?
