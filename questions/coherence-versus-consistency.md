---
id: coherence-versus-consistency
title: >-
  두 코어가 서로 다른 변수에 쓴 뒤 읽는 순서가 예상과 다릅니다. cache coherence와 memory consistency 중 어느
  계약이 깨졌다고 말해야 하나요?
difficulty: 중하
category: 동시성
tags:
  - coherence
  - memory consistency
  - 메모리 순서
  - 원자성
related:
  - atomics-memory-order
---
# 두 코어가 서로 다른 변수에 쓴 뒤 읽는 순서가 예상과 다릅니다. cache coherence와 memory consistency 중 어느 계약이 깨졌다고 말해야 하나요?

## 구두 답변

이 사례를 먼저 “coherence 위반”이라고 부르면 안 됩니다. coherence는 한 주소 또는 cache line의 복사본과 수정 순서를 조정하고, consistency는 서로 다른 주소의 작업을 어떤 순서로 관찰할 수 있는지 정합니다. 따라서 `x`와 `y`의 각 line이 최신 값 하나를 유지해도 두 주소 사이의 전역 순서가 프로그램 직관과 같다는 보장은 별도입니다.

구체적으로 초기 `x=0, y=0`에서 A가 `x.store(1, relaxed)` 뒤 `r1=y.load(relaxed)`, B가 `y.store(1, relaxed)` 뒤 `r2=x.load(relaxed)`를 수행한다고 합시다. 두 store가 각자의 store buffer에 잠시 남아 있으면 A와 B가 각각 상대 주소의 0을 읽어 `r1=0, r2=0`이 되는 store-buffering 결과를 검토할 수 있습니다. 이것은 x와 y의 동일 주소 coherence가 깨졌다는 증거가 아니라, relaxed 연산이 두 주소 사이의 순서를 동기화하지 않는다는 문제입니다. C++에서 비원자 `x,y`를 같은 방식으로 접근하면 data race가 되어 결과를 하드웨어 trace만으로 해석할 수도 없습니다.

반대 사례로 생산자가 `data=42` 후 `flag.store(1, release)`를 하고 소비자가 `flag.load(acquire)`에서 1을 읽은 뒤 `data`를 읽는다면, 그 acquire가 해당 release 값을 읽는 조건에서 공개 관계가 생깁니다. 이때도 data의 수명과 동시 재수정 여부는 따로 확인해야 합니다. 진단 순서는 주소별 coherence 상태, 원자 memory order, 실제 동기화 관계, 객체 lifetime 순으로 나누는 것이 좋습니다. 두 변수가 같은 cache line이어도 line 무효화 비용은 달라질 뿐, line coherence 자체가 cross-address consistency를 대신하지 않습니다. fence를 넣을 때도 “어떤 store를 어떤 load가 관찰해야 하는가”를 먼저 쓰고 비용과 필요한 순서를 검증하겠습니다.

## 득점 포인트

- coherence를 한 위치의 복사본·수정 순서, consistency를 여러 위치의 관찰 순서로 구분합니다.
- relaxed x/y store-buffering에서 `r1=0, r2=0`이 가능한 이유를 두 store buffer와 함께 추적합니다.
- release/acquire가 실제 release 값을 읽었을 때만 data 공개 관계를 만든다는 조건을 붙입니다.

## 감점 포인트

- 모든 coherent cache가 sequential consistency를 자동 제공한다고 말하면 계약 층위를 합친 것입니다.
- 일반 비원자 접근의 data race를 원자성이나 cache freshness만으로 덮으면 안 됩니다.
- 한 번 관찰한 순서를 모든 실행의 보장으로 일반화하면 memory model의 허용 범위를 잘못 말합니다.

## 더 파고들 거리

- 두 변수가 같은 line일 때 무효화 비용과 cross-address ordering이 왜 별개인지 비교합니다.
- fence 설계와 release/acquire flag 설계에서 실제 증명 지점을 각각 적습니다.
