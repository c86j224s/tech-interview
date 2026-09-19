---
id: cache-replacement-set-locality
title: >-
  한 set에 새 line이 계속 들어오고 기존 line 중 하나를 내보내야 합니다. LRU 근사와 random replacement를 어떤
  접근 패턴으로 비교하나요?
difficulty: 하
category: 성능
tags:
  - 캐시
  - replacement
  - LRU
  - 지역성
related:
  - clock-page-replacement-approximation
---
# 한 set에 새 line이 계속 들어오고 기존 line 중 하나를 내보내야 합니다. LRU 근사와 random replacement를 어떤 접근 패턴으로 비교하나요?

## 구두 답변

비교의 출발점은 동일한 set mapping, way 수, 초기 valid 상태, 주소 trace를 고정하는 것입니다. 짧은 hot set 반복에서는 최근 재참조 정보가 유용하므로 LRU 계열이 안정적인 victim을 고를 수 있습니다. 반대로 way 수보다 하나 많은 순환이나 예측하기 어려운 충돌에서는 random이 특정 순서의 최악 패턴을 완화할 가능성이 있지만, seed에 따른 분산을 반드시 함께 봐야 합니다.

4-way set에 A,B,C,D를 넣어 상태를 채운 뒤 A,B,C,D,E를 반복해 보겠습니다. LRU에서 첫 A~D는 cold miss이고 E가 들어올 때 가장 오래된 A가 victim입니다. 다음 A는 없으므로 B를 내보내고, 다음 B는 없으므로 C를 내보냅니다. 즉 working set 다섯 개가 네 자리를 순환해 모든 재접근이 miss가 되는 thrashing trace입니다. random은 E가 들어올 때 A를 내보낼 수도, C를 내보낼 수도 있어 다음 재접근의 hit 여부가 seed마다 달라집니다. 한 번의 random 결과를 평균 성능으로 부르면 안 됩니다.

정확한 LRU는 way 순서를 갱신해야 해서 way 수가 늘수록 metadata와 전력 비용이 커집니다. pseudo-LRU는 더 작은 상태로 최근성을 근사하지만 특정 trace의 victim이 정확한 LRU와 달라질 수 있습니다. 순차 스캔 뒤 hot set을 재생하는 trace에서는 replacement와 admission 효과도 분리해야 합니다. 측정값은 hit rate 하나가 아니라 miss penalty를 곱한 평균 지연, p99, random seed별 평균과 최악값을 포함해야 합니다. OS 페이지 교체의 LRU와 CPU cache line의 set-local 정책은 단위와 하드웨어 구현이 다르므로 같은 알고리즘이라고 일반화하지 않습니다.

## 득점 포인트

- 4-way A–E 순환에서 LRU victim과 random seed별 다음 hit 가능성을 구분합니다.
- OS page LRU와 CPU cache line replacement를 같은 단위의 구현으로 취급합니다.

## 감점 포인트

- 질문에 없는 일반론으로 결론을 흐리거나 모든 CPU·workload에 같은 규칙을 적용합니다.
- 중간 상태, 실패 조건, 성능·보안 비용을 생략해 결과만 단정합니다.

## 더 파고들 거리

- pseudo-LRU의 metadata 상태와 exact LRU의 victim 차이를 동일 trace에서 비교해 보세요.
- 입력 순서와 자원 조건을 바꿨을 때 어느 결론이 유지되고 어느 비용이 달라지는지 검증해 보세요.
