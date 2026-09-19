---
id: game-morton-dynamic-update
title: 객체가 이동할 때 Morton key 정렬 index를 언제 다시 배치해야 하나요?
difficulty: 중하
category: 게임 서버
tags:
  - Morton code
  - dynamic update
  - spatial index
related:
  - collision-broad-narrow-phase
---
# 객체가 이동할 때 Morton key 정렬 index를 언제 다시 배치해야 하나요?

## 구두 답변

Morton key는 center가 양자화된 cell을 바꿀 때 달라지지만, 갱신 기준은 center 하나가 아니라 query footprint와 이동 궤적입니다. 예를 들어 한 tick 동안 객체가 cell A의 x=0.9에서 cell C의 x=2.1로 이동하면 point index를 C로만 바꾸는 동안, 이동 선분을 검사하는 query는 중간 B와 교차할 수 있습니다. 정적 충돌 후보라면 A·B·C를 덮는 swept AABB를 overlay에 등록하고, 최종 narrow phase에서 실제 선분과 형상을 확인해야 합니다.

상태를 `old snapshot(A,g=7) → new snapshot(C,g=8)`로 분리하면 query는 한 tick의 index version을 선택하거나 전환 중 old/new를 모두 읽습니다. 둘 다 읽을 때는 `entity_id+generation`으로 dedup하고, stale old entry가 최신 상태를 덮지 못하도록 generation을 비교합니다. generation은 논리적 최신성을 위한 값일 뿐 이미 해제된 메모리를 안전하게 읽게 하지 않으므로 immutable snapshot, RCU, reference count 같은 reader lifetime 보호가 별도로 필요합니다.

업데이트 정책은 이동률에 따라 선택합니다. 저동적 데이터는 batch rebuild, 이동 객체가 많은 장면은 mutable overlay 후 주기적 Morton merge, 즉시 정렬이 필요하면 delete/insert 비용을 지불합니다. query p99와 overlay 크기를 함께 보며 flush를 정하고, update 지연 때문에 false negative가 생기지 않는 보수 범위를 먼저 증명합니다. 테스트에서는 A→C 이동, old/new 중복, query가 version 경계에 걸린 시점, reader가 이전 snapshot을 붙든 상태를 전수 비교합니다. center key만 갱신하면 고속 이동과 큰 footprint를 보장하지 못합니다.

## 득점 포인트

- cell 경계·footprint·swept 범위 변화가 재배치 기준임을 말한다.
- batch, mutable overlay, 즉시 sorted update의 비용을 이동률과 연결한다.
- old/new 전환의 dedup·version과 reader memory lifetime을 분리한다.

## 감점 포인트

- center key만 갱신하면 고속 이동도 항상 안전하다고 말한다.
- Morton 정렬 index가 동적 갱신을 무료로 제공한다고 주장한다.
- generation 비교만으로 이미 해제된 old entry 접근이 안전하다고 설명한다.

## 더 파고들 거리

- 이동률과 query p99를 기준으로 overlay flush 주기를 어떻게 선택할까요?
- old/new index 동시 조회에서 결과가 서로 다른 tick이면 어떤 snapshot을 우선할까요?
- swept 후보 폭증을 줄이면서 false negative를 검출하는 테스트는 무엇일까요?
