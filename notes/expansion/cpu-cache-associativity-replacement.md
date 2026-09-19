---
id: cpu-cache-associativity-replacement
title: CPU 캐시 계층의 연관도와 교체
topic: 시스템
summary: >-
  set·way·tag로 주소를 배치하고 conflict miss와 capacity miss를 구분하며 교체 정책을 접근 패턴에 맞춰
  판단합니다.
questionIds: []
prerequisites:
  - cacheline-layout
  - virtual-memory
related:
  - page-replacement
  - cache-policy
reviewedAt: '2026-09-19'
---
# CPU 캐시 계층의 연관도와 교체

CPU cache는 메모리 전체를 복사하는 저장소가 아니라 고정 크기 line을 제한된 set과 way에 보관하는 계층입니다. 주소는 보통 block offset, set index, tag로 나뉘고 index가 정한 set 안에서 tag와 valid를 비교합니다. 따라서 “전체 캐시가 충분한가”와 “같은 set에 동시에 필요한 line을 담을 수 있는가”는 다른 질문입니다. 아래 수치는 특정 제품의 보장이 아니라 mapping과 교체 사건을 추적하기 위한 모형입니다.

## 주소 분해

1KiB cache, 64B line, 4-way를 가정하면 line 수는 1024/64=16이고 set 수는 16/4=4입니다. 주소 `a`의 offset은 `a mod 64`, line 번호는 `floor(a/64)`, index는 `line 번호 mod 4`, tag는 `floor(line 번호/4)`입니다. 주소 0은 offset 0·set 0·tag 0, 주소 256은 line 4이므로 offset 0·set 0·tag 1입니다. 두 line은 같은 set의 서로 다른 way 후보가 됩니다. 실제 CPU에는 물리/가상 인덱싱, slice hash, line 크기 차이가 있을 수 있어 이 식을 제품 구현으로 일반화하지 않습니다.

## 연관도와 용량

direct-mapped는 set당 way가 하나라 같은 index의 두 tag가 동시에 있을 수 없습니다. 2-way와 4-way는 같은 set에 더 많은 tag를 보관해 충돌을 완화하지만 tag 비교기, metadata, 전력, timing 비용이 늘어납니다. fully associative는 index 충돌을 줄이는 대신 넓은 병렬 비교가 필요합니다. 연관도는 총 용량과 독립 축입니다. 4-way·4-set 모델에서 set 0에 매핑되는 line 다섯 개는 전체 16-line 공간이 남아도 한 set의 네 자리만 넘기 때문에 반복 conflict가 발생합니다.

## Miss 분류

처음 읽는 line은 compulsory 또는 cold miss입니다. working set이 cache 전체에 들어가지 않으면 capacity miss가 생깁니다. 전체 용량은 충분하지만 특정 set의 요구 line 수가 way 수를 넘으면 conflict miss입니다. 예컨대 line `L0`부터 `L4`가 모두 set 0이고 4-way이면 첫 네 번은 cold fill, 다섯 번째부터는 victim 교체, 다음 순환도 재참조 실패가 됩니다. warm-up과 반복 구간을 분리하지 않으면 cold와 conflict를 같은 원인으로 잘못 셉니다.

## Replacement 정책

set이 꽉 찬 뒤 내보낼 way는 replacement가 정합니다. 이상적 LRU는 가장 오래 재참조되지 않은 line을 고르지만 way가 늘수록 순서 metadata와 갱신 회로가 비싸집니다. 실제 CPU는 정확한 LRU라는 보장보다 pseudo-LRU, random 등 구현별 정책을 사용할 수 있습니다. 4-way에 A,B,C,D를 넣고 A,B,C,D,E를 순환하면 작업 집합이 5라서 LRU도 계속 victim을 만들 수 있습니다. random은 seed에 따라 victim과 hit 위치가 달라지므로 한 번의 결과가 평균 정책 성능이 아닙니다.

## 계층과 inclusion

L1 miss·L2 hit는 L2가 line을 보유한다는 뜻이지 L3 보유 여부를 자동으로 결정하지 않습니다. inclusive 관계라면 하위 cache의 line 집합이 상위 line 집합을 포함해야 하므로 L2 eviction 때 L1 복사본을 invalidate하는 전파가 필요할 수 있습니다. exclusive에 가까운 계층은 중복을 줄이기 위해 L1에서 밀린 line을 L2로 이동시키는 흐름을 가질 수 있습니다. victim cache는 주 cache에서 막 밀려난 line을 작은 별도 공간에 두어 direct-mapped 충돌을 완화하는 장치이지 L2 전체를 늘리는 것과 같지 않습니다.

## 쓰기 miss 정책

write-allocate는 miss line을 먼저 채운 뒤 cache에서 store하고, no-write-allocate는 line을 채우지 않고 하위 계층에 store를 보냅니다. 같은 64B line의 8B 위치 네 개를 곧 다시 쓴다면 한 번의 fill 뒤 세 번의 후속 hit를 얻을 수 있습니다. 반대로 각 line을 한 번만 쓰는 streaming workload는 기존 64B를 읽어 오는 비용과 cache 오염이 커질 수 있습니다. write-through/write-back은 하위 계층에 내용을 반영하는 시점을 뜻하므로 allocate 여부와 교차해 분석해야 합니다.

## 접근 trace

64B line·4 set·4-way에서 `0,256,512,768,1024`는 line `0,4,8,12,16`, 모두 set 0입니다. 첫 네 접근으로 way 0~3이 채워지고 1024에서 victim이 필요합니다. LRU 교체를 가정하고 같은 LRU에서 다섯 주소를 반복하면 재참조 전에 계속 하나가 나가므로 conflict miss가 반복됩니다. `0,64,128,192,256`은 set `0,1,2,3,0`으로 흩어져 첫 주소와 마지막 주소만 set 0에서 경쟁합니다. 이 중간 상태를 출력해야 주소 mapping과 replacement를 분리할 수 있습니다.

```diagram
{"title":"주소에서 교체까지","caption":"주소를 line과 set으로 해석하고, tag 비교와 replacement를 거쳐 hit·fill·victim 사건을 구분합니다.","rows":[[{"id":"addr","label":"주소","detail":["offset·line 번호"]}],[{"id":"index","label":"set index","detail":["후보 set 선택"]}],[{"id":"compare","label":"tag·valid 비교","detail":["way별 hit 판정"]}],[{"id":"hit","label":"hit","detail":["재참조 완료"]},{"id":"replace","label":"교체·fill","detail":["victim 정책"]}],[{"id":"lower","label":"하위 계층","detail":["line 공급·반영"]}]],"edges":[{"from":"addr","to":"index","label":"line 번호 분해"},{"from":"index","to":"compare","label":"set 안 후보"},{"from":"compare","to":"hit","label":"tag 일치"},{"from":"compare","to":"replace","label":"miss·자리 부족"},{"from":"replace","to":"lower","label":"fill 또는 write"},{"from":"lower","to":"compare","label":"새 line 재검사"}]}
```

## 검증과 비용

시뮬레이터는 line size, set 수, way 수, valid 초기값, replacement 상태, 주소열을 고정하고 매 접근의 set·tag·occupancy·victim을 출력해야 합니다. 배열 alignment나 padding을 바꿀 때는 먼저 실제 주소를 기록합니다. hardware counter는 이름과 의미가 아키텍처마다 다르므로 매핑과 miss 원인을 곧바로 counter 하나로 단정하지 않습니다. 연관도를 높이면 conflict는 줄 수 있지만 hit latency, 전력, 면적이 증가하고 replacement metadata가 복잡해집니다.

## 참고 자료와 범위

- [Intel Software Developer Manuals](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html) — 공식 참고 진입점입니다. 제공된 랜딩 페이지로 보편적인 set/way 수, replacement 알고리즘, inclusive 정책을 읽어 확정하지 않았습니다.
- [Cache line과 false sharing](/tech-interview/notes/cacheline-layout/) — line 공유와 coherence 비용을 다루며 set/way victim과는 구분됩니다.
- [가상 메모리와 TLB](/tech-interview/notes/virtual-memory/) — 주소 변환과 페이지 단위의 문제를 cache line mapping과 분리합니다.
- [페이지 교체](/tech-interview/notes/page-replacement/) — OS page 교체와 CPU cache line 교체는 단위와 계층이 다릅니다.
