---
id: game-entity-id-allocator-restart
title: 서버 재시작 뒤 entity ID를 다시 발급할 때 이전 packet과 충돌하지 않게 하려면 무엇을 바꾸나요?
difficulty: 중하
category: 게임 서버
tags:
  - entity ID
  - restart
  - epoch
related:
  - world-partition-handoff
---
# 서버 재시작 뒤 entity ID를 다시 발급할 때 이전 packet과 충돌하지 않게 하려면 무엇을 바꾸나요?

## 구두 답변

재시작 경계를 나타내는 epoch를 packet과 registry namespace에 넣되, epoch가 실제로 재사용되지 않는다는 조건까지 보장해야 합니다. epoch=12에서 `(id=42,g=7)`을 쓰고 epoch=13에서 42를 다시 발급하면 두 key는 다르지만, crash 뒤 volatile counter가 다시 12가 되거나 두 authority가 동시에 같은 epoch를 발급하면 충돌합니다. 그러므로 durable monotonic counter, 재사용되지 않는 random boot nonce, 또는 이전 session을 강제 종료하는 connection namespace와 fencing 중 하나를 선택하고 handshake에서 유일성을 검증합니다. 기존 client를 유지하는 handoff라면 old authority를 read-only/blocked로 만들고 새 epoch의 full snapshot을 설치·ACK받은 뒤 old packet을 거부합니다. 새 baseline ACK 전에는 old delta와 new epoch state를 섞지 않습니다. ID를 크게 하거나 UUID를 쓰는 것은 식별자 충돌을 줄일 뿐 replay, authority lease, lifecycle 수명을 자동 해결하지 않습니다. allocator가 durable ID 범위를 계속 소비하는 방식은 저장 비용 대신 replay 경계가 필요하고, boot nonce는 유일성 검증과 old connection 종료가 필요합니다. 시험은 restart 직전 packet, restart 후 같은 ID, duplicate, reconnect, 두 authority overlap을 나눠 `(epoch,id,generation)` 수용 여부와 full resync 수렴을 확인합니다.


boot nonce를 선택해도 저장소나 authority registry가 이미 사용한 nonce와의 충돌을 감지하지 못하면 유일성이 보장되지 않습니다. 따라서 새 authority는 lease를 획득하고 fencing token을 저장한 뒤에만 packet을 발급하며, 이전 lease가 살아 있으면 write를 거부해야 합니다. 기존 connection을 끊는 단순 정책은 구현이 쉽지만 재접속 full snapshot 비용이 있습니다. 연결을 유지하는 정책은 handoff ACK와 old packet rejection을 더 엄격하게 요구하므로, 실패 시 연결 종료로 되돌아가는 제한 시간도 계약에 넣습니다.
## 득점 포인트

- epoch=12/13 같은 ID 재사용 trace와 volatile counter 재충돌 반례를 함께 제시합니다.
- durable counter·boot nonce·connection fencing을 선택지로 구분하고 handoff ACK 순서를 설명합니다.
- UUID/큰 ID가 replay와 권위 전환을 자동 해결하지 않는 한계를 명시합니다.

## 감점 포인트

- epoch 필드가 있으면 재사용·동시 authority도 자동으로 안전하다고 단정합니다.
- 새 epoch baseline ACK 전에 old delta를 섞거나, 현재 registry의 ID만 보고 epoch를 생략합니다.
- ID 크기만 키워 replay와 lifecycle 문제까지 해결됐다고 말합니다.

## 더 파고들 거리

- 두 authority가 잠시 동시에 살아 있을 때 lease 만료와 write fencing의 관측값을 정해 보세요.
- epoch counter 저장이 불가능한 환경에서 boot nonce와 old session 차단을 어떤 handshake로 증명할지 설계해 보세요.
