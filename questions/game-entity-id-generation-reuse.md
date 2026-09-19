---
id: game-entity-id-generation-reuse
title: 재사용된 entity ID의 늦은 replication packet을 어떻게 차단하나요?
difficulty: 중하
category: 게임 서버
tags:
  - entity ID
  - generation
  - replication
related:
  - aoi-interest-management
  - game-input-sequence-gap
---
# 재사용된 entity ID의 늦은 replication packet을 어떻게 차단하나요?

## 구두 답변

packet에 ID만 보내지 않고 `(world/session epoch,id,generation)`과 entity version을 넣어 registry key와 모두 일치할 때만 적용합니다. 42:g7이 destroy되고 42:g8이 새로 spawn된 뒤 늦은 `42:g7,health=0,v9`가 와도 version이 커 보인다는 이유로 적용하지 않습니다. 검증 순서는 connection/epoch, registry lookup, generation, baseline, version, field mask입니다. spawn은 새 generation의 authoritative full state를 설치하는 사건이고, spawn보다 update가 먼저 오면 기본 객체를 만들어 적용하지 않고 bounded pending이나 resync로 보냅니다. destroy tombstone은 g7의 종료 version을 일정 기간 기억해 registry에 live entry가 없을 때도 ghost 생성 경로를 차단합니다. generation이 같아도 다른 world epoch면 거부합니다. 또한 generation 검사는 논리 유효성일 뿐 pointer safety가 아닙니다. lookup 뒤 객체가 free될 수 있으므로 lock·ownership·reference·epoch reclamation 같은 reader lifetime이 필요합니다. 반대로 포인터가 살아 있어도 generation이 다르면 논리적으로 잘못된 packet입니다. generation 폭과 wrap은 packet lifetime·reuse delay와 함께 검증하며, AOI 재진입 entity는 과거 delta가 아니라 새 generation full create로 시작합니다.


registry 조회와 적용 사이의 경합도 별도 trace로 다뤄야 합니다. reader가 g8 handle을 얻은 뒤 destroy가 실행되면 lock 또는 immutable snapshot이 해당 reader의 수명을 보장하고, commit 시 generation/version을 다시 비교해 실패를 반환합니다. 이 재검사는 네트워크 늦은 packet 차단과 다른 문제를 해결합니다. 네트워크 검사를 통과한 g8 packet이라도 commit 시점에 g9가 설치됐다면 적용하지 않고 재동기화해야 하며, pointer가 우연히 같은 주소를 재사용했다는 사실은 유효성 증거가 아닙니다.
## 득점 포인트

- 42:g7→destroy→42:g8과 늦은 v9 packet을 실제 검사 순서로 추적합니다.
- epoch·generation·baseline·version과 pointer lifetime을 서로 다른 안전 축으로 구분합니다.
- spawn-before-update와 tombstone/resync 경계를 설명합니다.

## 감점 포인트

- 같은 ID라는 이유로 g7 update를 g8에 적용합니다.
- generation만 보고 다른 epoch를 허용하거나 spawn 전 update로 기본 객체를 만듭니다.
- generation 일치가 해제 포인터 접근까지 안전하게 만든다고 말합니다.

## 더 파고들 거리

- 8비트 generation wrap과 최대 packet lifetime을 계산해 재사용 지연을 정해 보세요.
- AOI 밖에서 누적한 delta를 보내지 않고 full create를 선택하는 공개·복구 이유를 설명해 보세요.
