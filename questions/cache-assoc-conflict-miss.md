---
id: cache-assoc-conflict-miss
title: >-
  두 배열을 번갈아 읽을 때 캐시 용량은 충분한데 miss가 많습니다. associativity와 index 충돌로 이를 설명하려면 주소를
  어떻게 분해하나요?
difficulty: 하
category: 성능
tags:
  - 캐시
  - associativity
  - conflict miss
  - 주소
related:
  - cache-readonly-sharing-versus-writes
---
# 두 배열을 번갈아 읽을 때 캐시 용량은 충분한데 miss가 많습니다. associativity와 index 충돌로 이를 설명하려면 주소를 어떻게 분해하나요?

## 구두 답변

주소를 byte offset, line 번호, set index, tag로 나누고 같은 set에 필요한 line 수를 way 수와 비교합니다. line 크기를 B라 하면 offset은 `a mod B`, line 번호는 `floor(a/B)`, set 수를 S라 할 때 index는 `line 번호 mod S`, 나머지 상위 비트가 tag입니다. set-associative cache는 index가 고른 set 안에서 각 way의 valid와 tag를 비교하므로 전체 용량만으로 hit를 예측할 수 없습니다.

1KiB, 64B line, 4-way 모형을 계산하면 line은 16개이고 set은 16/4=4개입니다. 주소 0, 256, 512, 768, 1024의 line 번호는 각각 0,4,8,12,16입니다. 모두 `line mod 4=0`이므로 set 0에만 들어갑니다. 첫 네 접근은 네 way를 채우지만 1024를 읽는 다섯 번째 접근에서 victim 하나를 내보내야 합니다. LRU에서 다섯 주소를 반복하면 직전에 필요한 line이 방금 쫓겨난 상태가 되어 반복 miss가 생깁니다. set 1~3에 빈 공간이 남아도 set 0의 자리는 늘지 않습니다.

처음 한 번의 miss는 cold miss이고, warm-up 뒤 같은 주소열에서 계속 나는 miss는 이 모형의 conflict miss입니다. working set이 전체 16 line을 넘어 생기는 capacity miss와 구분하려면 초기 valid 상태, 반복 구간, set별 occupancy와 victim 순서를 기록합니다. 배열 시작 주소나 padding을 바꾸면 line 번호와 index가 달라질 수 있으므로 실제 주소를 먼저 출력합니다. 실제 CPU는 물리/가상 인덱싱, slice hash, line 크기와 계층 정책이 다를 수 있어 modulo 계산을 제품 구현으로 단정하지 않습니다. 연관도를 높이면 충돌을 줄일 수 있지만 tag 비교, 전력, hit latency, replacement metadata 비용이 증가합니다.

## 득점 포인트

- 64B line·4 set·4-way에서 주소 0부터 1024까지의 line/index/tag를 계산합니다.
- 전체 cache capacity만 보고 set-local way 부족을 배제합니다.

## 감점 포인트

- 질문에 없는 일반론으로 결론을 흐리거나 모든 CPU·workload에 같은 규칙을 적용합니다.
- 중간 상태, 실패 조건, 성능·보안 비용을 생략해 결과만 단정합니다.

## 더 파고들 거리

- 배열 alignment와 padding을 바꿔 동일한 working set의 set 분포를 다시 계산해 보세요.
- 입력 순서와 자원 조건을 바꿨을 때 어느 결론이 유지되고 어느 비용이 달라지는지 검증해 보세요.
