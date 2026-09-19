---
id: cache-hierarchy-inclusive-victim
title: >-
  L1 miss가 L2 hit인데 L3에는 없을 수 있습니다. 캐시 계층의 inclusive·exclusive·victim 관계를 어떤 태그와
  eviction 사건으로 설명하나요?
difficulty: 중하
category: 성능
tags:
  - 캐시 계층
  - L1
  - L2
  - inclusive
  - victim cache
related:
  - cpu-cache-false-sharing
---
# L1 miss가 L2 hit인데 L3에는 없을 수 있습니다. 캐시 계층의 inclusive·exclusive·victim 관계를 어떤 태그와 eviction 사건으로 설명하나요?

## 구두 답변

L1 miss·L2 hit는 요청 line이 L2에는 있다는 뜻일 뿐 L3 보유 여부를 자동으로 결정하지 않습니다. 계층 관계는 각 level의 tag·valid 집합과 line 이동 규칙으로 확인해야 합니다. inclusive에 가까운 관계에서는 하위 cache가 상위 cache의 line을 포함하려 하므로 L2에서 line을 eviction할 때 L1의 복사본을 invalidate하는 전파가 필요할 수 있습니다. exclusive에 가까운 관계에서는 중복을 줄이기 위해 L1에서 밀려난 line을 L2의 다른 위치로 이동시키는 흐름을 생각합니다.

작은 사건 trace를 보겠습니다. L1에 A, L2에도 A가 있는 inclusive 모델에서 L2 set이 꽉 차 새 C를 넣으려 A를 내보내면, L2 tag A 삭제와 함께 L1 tag A의 valid를 0으로 만드는 invalidate가 뒤따를 수 있습니다. 이후 A 요청은 L1 miss가 됩니다. exclusive 모델에서는 L1에서 B가 victim으로 나오면 L2에 B를 넣고, L2 hit로 B를 L1에 올릴 때 L2의 B를 제거하거나 위치를 교환해 중복을 줄이는 방식이 가능합니다. 실제 구현은 CPU 세대와 level에 따라 다르므로 이 흐름을 보편 규칙으로 단정하지 않습니다.

victim cache는 주 cache에서 방금 쫓겨난 line을 소수의 별도 entry에 보관합니다. direct-mapped L1에 A를 넣으며 B를 밀어낸 직후 B를 다시 읽는다면, L1 miss 후 하위 메모리까지 가지 않고 victim cache의 tag B를 찾아 L1과 교환할 수 있습니다. 이때 victim entry의 valid, tag, coherence 상태와 L1의 tag 교체를 함께 기록해야 합니다. victim cache는 L2 전체 용량을 단순히 더한 것과 같지 않습니다. 검증에서는 L1 eviction, L2 hit/miss, lower-level fill, invalidate, victim hit를 순서대로 로그하고, cache 크기만 보고 inclusion을 추론하지 않습니다.

## 득점 포인트

- inclusive invalidate, exclusive 이동, victim-cache 교환에서 tag·valid 위치를 사건 순서로 설명합니다.
- L1 miss/L2 hit를 곧바로 L3와 메모리까지의 부재로 해석합니다.

## 감점 포인트

- 질문에 없는 일반론으로 결론을 흐리거나 모든 CPU·workload에 같은 규칙을 적용합니다.
- 중간 상태, 실패 조건, 성능·보안 비용을 생략해 결과만 단정합니다.

## 더 파고들 거리

- L2 eviction과 victim hit를 각각 독립 trace로 기록해 중복 보유 여부를 확인해 보세요.
- 입력 순서와 자원 조건을 바꿨을 때 어느 결론이 유지되고 어느 비용이 달라지는지 검증해 보세요.
