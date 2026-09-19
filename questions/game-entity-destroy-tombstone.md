---
id: game-entity-destroy-tombstone
title: 삭제 tombstone을 즉시 없애면 어떤 replication 문제가 생기나요?
difficulty: 중하
category: 게임 서버
tags:
  - entity lifecycle
  - tombstone
  - late packet
related:
  - aoi-interest-management
---
# 삭제 tombstone을 즉시 없애면 어떤 replication 문제가 생기나요?

## 구두 답변

tombstone을 즉시 지우면 destroy 사실과 종료 generation/version을 증명할 기록이 사라집니다. client가 destroy를 놓친 상태에서 늦은 `42:g7 update`를 받으면 registry에 live 42가 없다는 이유로 ghost를 새로 만들 수 있고, 이미 42:g8이 재사용됐다면 g7의 health·position이 새 객체를 오염시킬 수 있습니다. tombstone은 id, 종료 generation, destroy version, epoch를 retention window 동안 기억해 이 packet이 현재 spawn이 아님을 판정합니다. retention은 최대 packet lifetime, reconnect client가 old snapshot을 들고 올 수 있는 시간, ID reuse delay, full resync 완료 경계를 포함해야 합니다. 무한 보관은 메모리 비용을 만들므로 상한에 다다르면 무검증 삭제 대신 ID 재사용 지연이나 해당 connection resync를 선택합니다. full resync가 새 AOI state를 설치하고 epoch 경계가 old packet을 차단한다는 증거가 있으면 해당 tombstone을 정리할 수 있지만, 단순히 destroy가 한 번 송신됐다는 사실만으로는 부족합니다. tombstone은 새 g8 spawn을 영원히 금지하는 장치가 아니라 g7 packet을 g8로 해석하지 않게 하는 장치입니다. 검증은 destroy-before-update, update-before-spawn, duplicate, reconnect를 나눠 ghost 수·resync 횟수·tombstone bytes를 기록합니다.


tombstone의 유용성은 server만 record를 갖는지 client도 destroy version을 기억하는지에 따라 달라집니다. client가 오래된 snapshot으로 재접속하면 server는 현재 epoch와 AOI full state를 먼저 제시하고, client가 새 baseline을 설치했다는 ACK를 받은 뒤에야 과거 pending update를 폐기할 수 있습니다. 이때 tombstone은 영구 삭제 목록이 아니라 old packet의 해석을 거절하는 최소 증거입니다. 장식 entity처럼 resync로 쉽게 재생성할 수 있는 대상과 보상 ledger처럼 삭제 순서를 보존해야 하는 대상을 같은 retention으로 묶지 않습니다.
## 득점 포인트

- destroy 유실→late update→ghost 및 ID 재사용 오염 경로를 구체적으로 추적합니다.
- retention 근거와 상한 초과 시 resync/재사용 지연의 선택을 연결합니다.
- tombstone이 새 generation 자체를 금지하지 않는다는 의미를 분명히 합니다.

## 감점 포인트

- destroy 송신이 끝나면 즉시 record를 삭제하거나 tombstone을 영구 보관합니다.
- g7 기록이 있으므로 g8 spawn도 금지한다고 설명합니다.
- memory pressure에서 retention 증명 없이 임의 삭제합니다.

## 더 파고들 거리

- full resync와 session epoch가 완료된 뒤 어떤 관측값으로 tombstone 정리를 증명할지 설계해 보세요.
- 보상 event처럼 durable해야 하는 삭제와 장식 entity의 retention을 다르게 둘 이유를 설명해 보세요.
