---
id: entity-ids-generations-replication-lifecycle
title: Entity ID·Generation·Replication 수명
topic: 게임 서버
summary: >-
  재사용 가능한 entity ID와 generation을 조합해 spawn·despawn·replication·늦은 패킷이 새 객체를
  오염시키지 않도록 하는 지식 장입니다.
questionIds: []
prerequisites:
  - input-authority
  - aoi-disclosure
  - world-authority
related:
  - input-authority
  - aoi-disclosure
  - world-authority
  - spatial-candidates
  - iocp-completion
reviewedAt: '2026-09-19'
---
# Entity ID·Generation·Replication 수명

정수 entity ID는 registry slot일 뿐 객체의 영원한 신원은 아닙니다. 42:g7이 destroy된 뒤 allocator가 42:g8을 만들고, 네트워크에 남은 g7 health update가 도착할 수 있습니다. packet이 ID만 보내면 새 객체에 과거 상태를 적용하게 됩니다. 안전한 논리 key는 보통 `(world/session epoch, entityId, generation)`이며, 그 뒤 entity version·baseline·field mask를 검사합니다. 이 계약은 UUID를 쓴다고 자동으로 사라지지 않습니다.

## 식별자 축

RFC 9562는 UUID를 128비트 식별자로 정의하고 공간·시간에 걸친 유일성과 persistence를 설명하지만 lifecycle ownership, destroy ordering, replication memory safety를 정의하지 않습니다. 작은 ID+generation은 wire와 cache에 유리하고, UUID는 중앙 조정 없는 분산 발급과 장기 유일성에 유리하지만 packet·index 비용이 커집니다. 어떤 형식이든 world epoch와 권위 경계는 별도 필드로 확인해야 합니다.

## 세대와 재사용

generation은 slot의 몇 번째 생명인지 나타냅니다. 42:g7과 42:g8은 같은 slot이라도 다른 객체입니다. 8비트 generation이면 256회 재사용 후 wraparound가 생겨 오래된 packet과 같은 값이 될 수 있으므로 packet 최대 생존시간, 재사용 지연, generation 폭을 함께 계산합니다. 재사용 전 tombstone 또는 epoch를 유지해 같은 세대 값이 살아 있는 network window와 겹치지 않게 합니다.

## Spawn 원장

spawn은 “ID가 보인다”가 아니라 authoritative registry에 generation, 초기 full state, spawn version, AOI 공개 조건을 설치하는 사건입니다. update가 spawn보다 먼저 도착하면 기본 객체를 만들어 적용하지 않고 bounded pending이나 resync로 보냅니다. AOI 재진입은 client가 과거 delta와 비공개 필드를 갖고 있다고 가정할 수 없으므로 현재 generation의 full create로 시작합니다. 공간 후보로 발견한 ID와 공개 허가를 분리해야 합니다.

## Destroy와 Tombstone

destroy가 유실되면 client는 entity가 살아 있다고 생각하고 늦은 update를 계속 받을 수 있습니다. tombstone은 `id`, 종료 generation, destroy version, epoch, 종료 시각을 일정 범위 기억해 g7 packet이 새 spawn으로 해석되지 않음을 증명합니다. retention은 packet lifetime, reconnect window, ID reuse delay, full resync 완료 시점을 기준으로 정합니다. 무한 보관은 메모리를 소모하므로 상한을 넘으면 ID 재사용을 늦추거나 연결을 resync해야 하며, tombstone을 무검증 삭제해서는 안 됩니다.

## Packet 검증

검증 순서는 인증·connection epoch, world/session epoch, registry lookup, generation, entityVersion, baseline, field schema입니다. 현재 `{epoch=12,id=42,generation=8,version=3}`일 때 `P(g7,v9)`는 version이 커도 세대 불일치로 폐기하고, `P(g8,v2)`는 stale, `P(g8,v4)`만 matching baseline 뒤 적용합니다. `P(epoch=11,g8)`도 ID와 generation이 같아 보이지만 구 epoch라 거부합니다. 실패 시 default entity 생성 fallback을 두지 않습니다.

## Entity별 Baseline

A는 S10에서 AOI에 들어와 create를 받았고 B는 S12에서 처음 보였다고 하겠습니다. B에게 S11 delta를 보내면 base가 없고, 그 안에 비공개 필드가 있으면 공개 경계도 침해됩니다. connection·entity별로 `spawnVersion`, `lastAckedVersion`, generation, 공개 field mask를 유지하거나 AOI 진입마다 full create를 보냅니다. 위치 snapshot과 보존해야 할 보상·전투 event는 같은 channel에 섞지 않습니다.

## 재시작 Epoch

프로세스가 epoch=12에서 중단되고 새 authority가 epoch=13을 얻는다고 해서 단순 부팅 카운터를 메모리에서 다시 12로 시작하면 fencing이 실패합니다. epoch는 durable monotonic counter, 재사용되지 않는 random boot nonce, 또는 이전 connection을 강제 종료하는 namespace 중 하나로 유일성을 보장해야 합니다. handoff에서는 old authority를 read-only/blocked로 만들고 새 epoch full snapshot 설치·ACK 뒤 old packet을 거부합니다.

## 메모리 수명

generation 검사는 논리 packet의 유효성이지 pointer safety가 아닙니다. registry lookup 뒤 다른 작업이 g7을 free하고 g8을 설치할 수 있으므로 lock, ownership, reference count, epoch reclamation, immutable snapshot 중 하나로 reader lifetime을 보호합니다. 반대로 포인터가 살아 있어도 generation이 다르면 적용하지 않습니다. 논리 세대와 물리 메모리 수명을 분리해야 합니다.

```diagram
{"title":"slot 재사용과 두 수명의 분리","caption":"epoch·generation은 늦은 packet의 논리 유효성을 검사하고, 별도의 reader 보호가 해제 메모리 접근을 막습니다.","rows":[[{"id":"g7","label":"42:g7 live","detail":["epoch=12","registry owner"]}],[{"id":"dead","label":"destroy record","detail":["tombstone g7","destroy version"]}],[{"id":"g8","label":"42:g8 spawn","detail":["새 full state","generation 증가"]}],[{"id":"check","label":"late packet check","detail":["epoch·generation·version","불일치 폐기"]}]],"edges":[{"from":"g7","to":"dead","label":"lifecycle 종료"},{"from":"dead","to":"g8","label":"재사용 경계"},{"from":"g8","to":"check","label":"현재 registry"},{"from":"dead","to":"check","label":"옛 세대 차단"}]}
```

## 검증과 비용

설명용 trace는 `spawn(12,42,g8,v1)→current`, `update(12,42,g7,v9)→discard`, `update(11,42,g8,v4)→discard`, `update(12,42,g8,v4)→baseline 확인 후 install`, `destroy(g8,v5)→live 제거·tombstone 유지`입니다. 실제 서버 실행 결과가 아니며, 테스트는 destroy-before-update, update-before-spawn, duplicate, reconnect stale snapshot, restart, generation wrap을 분리해야 합니다. 100,000 live entry를 ID4+generation4+version8+pointer8바이트로 단순 계산하면 2.4MB이고 tombstone 50,000개는 1.2MB가 추가됩니다. hash overhead와 alignment는 별도이므로 retention·resync 비용을 함께 측정합니다.

## 참고 자료와 확인 범위

https://www.rfc-editor.org/rfc/rfc9562 (RFC 9562 full text, 2026-09-19 확인)는 UUID 형식·유일성 참고로만 사용했으며 lifecycle 규칙의 근거로 확대하지 않았습니다. 저장소 `notes/game/aoi-disclosure.md`는 create/increment/delete와 generation 순서를, `notes/design/snapshot-lifetime.md`는 reader와 memory reclamation 경계를, `notes/networking/datagram-contracts.md`는 최신 상태와 내구 event의 계약 분리를 다룹니다. 특정 ECS allocator·transport의 restart 보장은 확인하지 못했으므로 선택 가능한 설계로 제시합니다.
