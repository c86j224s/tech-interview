---
id: spatial-morton-codes-locality-range-queries
title: Morton Code 공간 지역성과 범위 질의
topic: 게임 서버
summary: >-
  다차원 좌표를 비트 interleave한 Morton/Z-order code로 공간 객체를 정렬·분할하고, 범위 질의가 여러 code
  interval로 분해되는 비용을 설명합니다.
questionIds: []
prerequisites:
  - spatial-candidates
  - spatial-tree-foundations
related:
  - spatial-candidates
  - spatial-tree-foundations
reviewedAt: '2026-09-19'
---
# Morton Code 공간 지역성과 범위 질의

Morton code 또는 Z-order code는 2차원·3차원 좌표의 비트를 번갈아 섞어 하나의 정수 키로 만드는 방법입니다. 공간을 그대로 1차원으로 보존하는 것은 아니지만, 같은 큰 사분면·팔분면에 있는 점들이 비슷한 prefix와 가까운 정렬 구간을 갖도록 해 공간 데이터를 정렬 인덱스나 계층 구조에 넣기 쉽게 합니다. 이 방법을 “가까운 점은 언제나 가까운 code” 또는 “사각형은 한 번의 연속 범위 조회”로 이해하면 안 됩니다.

NVIDIA의 Z-order 기술 문서는 GPU에서 공간 계층을 구성하기 위해 Morton key를 정렬하는 용례를 보여 주지만, 특정 데이터베이스·엔진의 query planner나 bit width 기본값을 규정하지는 않습니다. 여기서는 원리와 비용 경계를 다루며, 좌표 양자화·부호·overflow·갱신 정책은 사용하는 저장소의 계약으로 고정해야 합니다.

## 좌표 양자화와 셀 표현

실수 좌표 `(x,y)`를 바로 interleave할 수 없으므로 먼저 원점 `o`와 셀 크기 `s`를 정합니다. `qx=floor((x-o_x)/s)`, `qy=floor((y-o_y)/s)`처럼 정수 셀 좌표를 얻고, 각 축을 허용 비트 폭의 unsigned 값으로 매핑합니다. 음수 좌표가 있는 월드라면 offset을 더해 비음수 범위로 만들거나 signed order-preserving mapping을 별도로 설계해야 합니다. 단순 cast는 상위 비트와 정렬 순서를 망가뜨릴 수 있습니다.

예를 들어 2비트 좌표 `x=2 (10₂)`, `y=1 (01₂)`의 비트를 `x1,y1,x0,y0` 순서로 번갈아 놓으면 `1001₂ = 9`가 됩니다. `x=3 (11₂)`, `y=1 (01₂)`은 `1101₂ = 13`입니다. 이 네트워크가 “x와 y를 각각 먼저 쓰고 나중에 합치는 것”이 아니라, 각 level의 quadrant 선택을 상위 bit부터 묶는다는 점이 중요합니다. 실제 code는 구현이 선택한 x/y bit 순서에 따라 값은 달라질 수 있으므로 encode와 decode의 동일 계약이 필요합니다.

## Bit interleave와 계층 Prefix

두 축을 각각 `b`비트로 표현하면 code는 최대 `2b`비트입니다. 가장 높은 두 bit가 한 level의 quadrant를 결정하고, 그 다음 두 bit가 더 작은 사분면을 결정합니다. 따라서 같은 상위 prefix를 가진 두 code는 최소한 해당 큰 셀 안에 있다는 정보를 공유합니다. 3차원에서는 x/y/z의 bit를 번갈아 배치해 각 level의 octant를 나타냅니다.

이 prefix 성질이 공간 locality의 유용한 부분입니다. 예를 들어 4×4 격자에서 상위 2 code bit가 `01`인 값들은 같은 2×2 사분면을 가리킬 수 있습니다. 하지만 인접한 두 사분면의 code는 정렬 경계에서 멀어지고, 같은 사분면 안에서도 Z 순서가 유클리드 거리 순서와 같지는 않습니다. 모서리에 있는 두 셀이 실제로 가깝더라도 code 정렬에서는 구간이 갈릴 수 있습니다.

```diagram
{"title":"좌표를 계층 prefix와 정렬 key로 바꿉니다","caption":"양자화된 각 축의 비트를 interleave하면 prefix는 큰 공간 셀을 나타내고 전체 code는 정렬 key가 됩니다. 정렬 인접성이 기하학적 거리의 완전한 순서는 아닙니다.","rows":[[{"id":"world","label":"실수 world 좌표","detail":["원점·셀 크기"]}],[{"id":"quant","label":"정수 셀 좌표","detail":["x·y·z quantize"]}],[{"id":"interleave","label":"bit interleave","detail":["level별 prefix"]}],[{"id":"index","label":"Morton 정렬 index","detail":["1차원 key"]}],[{"id":"filter","label":"범위 후보·정밀 검사","detail":["false positive 제거"]}]],"edges":[{"from":"world","to":"quant","label":"floor·범위 변환"},{"from":"quant","to":"interleave","label":"축 비트 섞기"},{"from":"interleave","to":"index","label":"정렬·분할"},{"from":"index","to":"filter","label":"후보 interval"}]}
```

## 직사각형과 여러 Interval

점 하나의 Morton code는 단일 key로 찾을 수 있지만, `x∈[x1,x2]`와 `y∈[y1,y2]`인 사각형은 Z-order에서 여러 조각으로 찢어질 수 있습니다. 큰 quadtree cell이 query box 안에 완전히 포함되면 그 cell의 code prefix 전체를 하나의 정렬 interval로 읽을 수 있습니다. 부분적으로 겹치면 더 작은 자식 cell로 재귀 분해합니다. box 밖의 큰 cell은 버립니다.

검산 가능한 4×4 예를 고정하겠습니다. 좌표를 2비트로 쓰고 bit 순서를 `x1,y1,x0,y0`로 정하면 query `x∈[1,2], y∈[1,2]`의 네 점은 `(1,1)→3`, `(1,2)→6`, `(2,1)→9`, `(2,2)→12`입니다. 따라서 정확한 집합은 `{3,6,9,12}`이고, 이 encode에서는 네 singleton interval `[3,3]`, `[6,6]`, `[9,9]`, `[12,12]`로 표현됩니다. `[3,12]` 하나로 합치면 4×4 격자의 다른 좌표 code가 사이에 들어옵니다. 더 큰 quadtree cell이 box 안에 완전히 들어가는 경우에만 그 prefix를 하나의 연속 interval로 묶을 수 있다는 점이 핵심입니다.

interval을 얻은 뒤에도 실제 좌표·AABB·거리·층·collision layer를 재검사해야 합니다. Morton code가 범위 predicate 자체가 아니기 때문입니다. interval 수가 많으면 index seek가 여러 번 발생하고, 큰 box는 후보를 많이 읽습니다. 작은 box는 precision이 낮을 때 해당 셀 전체를 후보로 반환해 정밀 필터 비용이 커질 수 있습니다.

## 수치와 overflow 경계

축마다 16비트를 쓰는 2D code는 32비트가 필요합니다. 32비트 signed 정수의 최고 bit를 일반 양수처럼 저장하면 값이 음수로 보이므로 정렬 비교가 깨질 수 있습니다. 32비트 code를 signed 타입에 넣어 `0x80000000`과 `0x7fffffff`를 비교하면 언어의 signed 비교는 전자의 정렬 위치를 기대와 다르게 만듭니다. 64비트 unsigned 저장 또는 명시적인 order-preserving 비교가 필요합니다.

`b`를 16에서 21로 늘리면 2D code 폭은 32비트에서 42비트가 됩니다. 해상도를 높이는 이점은 셀의 공간 오차를 줄이는 것이지만, 42비트가 필요하며 일반적으로 64비트 unsigned 컨테이너에 pack할 수 있습니다. 실제 저장 폭이 반드시 64비트라는 뜻은 아니며, packed 42-bit/custom key와 정렬·전송 구조의 비용은 구현 계약입니다. 단순히 bit 수를 키운다고 세계 범위까지 동시에 늘어나지는 않습니다. `세계 범위 ≈ 2^b × 셀 크기`라는 관계에서 셀 크기를 줄이면 같은 bit 폭으로 더 세밀해지지만 표현 가능한 world 범위가 줄어듭니다.

negative coordinate는 `signed x`를 바로 unsigned로 재해석하지 않고, `x - minX` 같은 명시적 offset과 overflow 검사를 거쳐야 합니다. query가 world origin을 바꾸거나 chunk가 다른 schema version으로 encode되면 예전 key와 새 key를 같은 정렬 index에서 비교할 수 없습니다. origin, cell size, bit width, axis order를 index metadata와 version에 기록합니다.

## 동적 객체와 정렬 갱신

정적 지형이나 batch rebuild할 공간 데이터에는 Morton 정렬이 잘 맞지만, 이동 객체는 cell 경계를 넘을 때 key가 바뀝니다. center가 같은 cell 안에서 움직이면 key 갱신이 필요 없을 수 있지만, query가 객체의 반경·이동 궤적을 요구하면 등록 범위는 달라질 수 있습니다. 한 tick에 A에서 C로 건너뛴 객체를 A와 C만 갱신하면 중간 B를 대상으로 한 swept query에서 후보가 누락될 수 있습니다.

동적 index에는 다음 세 가지 정책이 있습니다. 첫째, 소수의 이동 객체를 별도 mutable hash에 두고 주기적으로 Morton batch index에 합칩니다. 둘째, B-tree나 sorted vector의 삭제·삽입으로 key 순서를 즉시 유지합니다. 셋째, old/new index를 짧은 전환 기간에 동시에 조회하고 ID·generation으로 dedup합니다. 어떤 정책이 좋은지는 이동률, query p99, 재정렬 batch 크기, reader 수명에 달려 있으며 code locality 하나만으로 결정할 수 없습니다.

현재 key와 새 key를 교체하는 사이 reader가 old entry를 읽을 수 있으므로 immutable snapshot, RCU류 reader lifetime, 또는 index version을 사용합니다. logical generation이 같은 객체인지 확인해도 이미 해제된 memory를 안전하게 읽을 수 있게 하지는 않습니다. 이동 물체의 충돌 query라면 Morton 후보가 보수적 swept bound를 포함하는지 먼저 검증한 뒤 narrow phase를 적용해야 합니다.

## Locality의 한계와 거짓 후보

Morton order는 공간 hierarchy를 정렬 배열로 표현하기 쉽게 만들지만, 인접성의 보장은 일방향입니다. 근처 code를 읽는다고 항상 반경 query를 완전히 덮는 것도 아니고, code가 가까워도 실제 좌표가 query box 안이라는 뜻도 아닙니다. 특히 Z-order curve가 큰 셀 경계를 오갈 때 멀리 떨어진 구간이 연속 code에 섞입니다.

따라서 후보 집합 포함 관계를 기준으로 시험합니다. 작은 좌표 집합에서는 모든 점을 실제 거리 predicate로 필터한 기준 집합과 interval scan 결과의 정밀 필터 집합을 비교합니다. 누락이 있으면 interval decomposition의 cell 경계, quantization floor, negative coordinate mapping, code width overflow를 순서대로 확인합니다. false positive가 많으면 precision을 높이는 것만이 답이 아니며, 큰 query를 계층 cell prefix로 합치고 정밀 필터를 SIMD·batch로 처리할 수 있습니다.

spatial-candidates 노트의 broad phase와 마찬가지로 false positive는 비용이고 false negative는 정확성 실패입니다. Morton key가 빠른 후보를 만든다고 바로 충돌·AOI·시야를 확정하지 않습니다. 실제 객체의 radius, 이동 시간, layer, generation을 같은 snapshot에서 재검사해야 합니다.

## 비용·선택·검증

정렬된 code를 이용하면 큰 공간 셀 단위 batch, GPU radix sort, disk/index locality를 얻을 수 있습니다. 반면 범위 query가 작은 disjoint interval 여러 개로 쪼개지면 seek와 후보 재검사가 늘고, 객체가 자주 움직이면 key update와 snapshot 교체 비용이 커집니다. quadtree/BVH는 계층 box와 질의 의미가 더 직접적일 수 있으며, uniform grid는 일정한 국소 query와 빠른 갱신에 적합할 수 있습니다.

선택 전에는 query box 크기 분포, 좌표 동적성, 정밀도 오차, key 메모리, interval 개수, 후보 false positive 비율, update p99를 측정합니다. 2D 음수 경계와 `2^b-1` 경계, cell 경계에 걸친 사각형, 큰 box, 작은 box, 이동 중 old/new index 전환을 시험합니다. 실행하지 않은 경우 이 문서의 interval 숫자는 예상 계산이며, 특정 저장소의 실제 latency나 GPU throughput으로 해석하지 않습니다.

## 참고자료와 확인 범위

- NVIDIA, “Thinking Parallel, Part III: Tree Construction on the GPU”, https://developer.nvidia.com/blog/thinking-parallel-part-iii-tree-construction-gpu/ — Morton/Z-order 기반 linearization과 계층 구성의 출발점. 기술 문서의 구현 맥락은 특정 GPU/코드 경로에 한정됩니다.
- `notes/game/spatial-candidates.md` — 후보 보수성, swept 범위, 공간 index와 최종 정밀 판정을 대조했습니다.
- `notes/knowledge/spatial-tree-foundations.md` — Morton code가 일반 공간 트리와 같은 구조가 아니라 정렬 기반 linearization임을 구분했습니다.

이 배치에서는 특정 library의 bit interleave intrinsics, 데이터베이스 range optimizer, GPU 구현 버전을 검증하지 않았습니다. 그러한 동작은 source revision과 target architecture를 정한 뒤 별도로 확인해야 합니다.
