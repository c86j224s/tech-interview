---
id: game-ecs-archetype-query-transition-cost
title: archetype 수가 지나치게 늘어날 때 query 비용과 구조 변경 비용을 어떻게 진단하나요?
difficulty: 중하
category: 게임 서버
tags:
  - ECS
  - query
  - archetype
related:
  - cpu-cache-false-sharing
  - collision-broad-narrow-phase
---
# archetype 수가 지나치게 늘어날 때 query 비용과 구조 변경 비용을 어떻게 진단하나요?

## 구두 답변

archetype 개수만 보고 느리다고 결론내리지 않고 query가 실제 방문하는 signature·chunk·entity 분포와 구조 변경 이동량을 함께 측정하겠습니다. 8개 독립 tag는 이론상 256 조합을 만들지만 실제 entity가 12개 archetype에만 몰릴 수 있고, 반대로 수백 signature에 entity가 두세 개씩 흩어지면 작은 chunk를 많이 방문해 locality를 잃습니다. 따라서 query별 매칭 archetype·chunk·entity 수와 빈 chunk 비율, 방문 p50/p99를 기록합니다.

add/remove 횟수만 보지 말고 복사한 component bytes와 구조 변경 p99, command 적용 지연도 tick별로 남깁니다. 64바이트 Transform을 가진 entity가 매 tick `Selected` tag를 토글하면 tag보다 전체 행 이주가 병목일 수 있습니다. sparse set으로 바꿀 때는 Position·Velocity ID join 횟수와 cache miss를 같은 장면에서 비교합니다. 태그를 값 필드로 합치면 이동은 줄지만 매 query 조건 branch가 늘 수 있으므로 대표 workload의 query p99와 이동 p99가 모두 예산 안에 드는 선택을 하겠습니다.

측정은 전체 프레임 평균보다 실제 hot query별로 나누어야 합니다. 예컨대 query A는 20개 큰 chunk를 읽고 query B는 300개 한두 entity chunk를 읽을 수 있는데 archetype 총수만으로는 둘을 구분할 수 없습니다. tag를 값 필드로 옮긴 뒤에는 구조 변경 p99가 줄었는지와 조건 branch·cache miss가 늘었는지를 같은 입력 재생으로 비교해야 합니다.

 이 비교에서 중요한 것은 수치를 한 번 재는 것이 아니라 같은 입력과 tick에서 두 레이아웃을 재생하는 것입니다. query가 읽는 component 목록, 이동 bytes, cache miss와 tail latency를 함께 저장하면 “조합 수가 많다”와 “실제로 병목이다”를 분리할 수 있습니다.

## 득점 포인트

- 이론적인 태그 조합 수와 실제 archetype·chunk 분포를 구분합니다.
- query 순회 비용과 컴포넌트 이주 바이트를 같은 장면에서 비교합니다.

## 감점 포인트

- archetype 수만으로 성능 병목을 확정합니다.
- 태그를 값으로 합친 뒤 늘어나는 필터 분기를 무시합니다.

## 더 파고들 거리

- 빈 chunk 정리와 query 캐시 갱신 비용은 언제 측정할까요?
- 희소 컴포넌트를 별도 sparse set에 두면 join 비용이 얼마나 추가되나요?
