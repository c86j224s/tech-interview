---
id: erasure-km-overhead
title: >-
  Erasure coding에서 k data shard와 m parity shard를 늘리면 저장 overhead와 장애 허용 수가 어떻게
  바뀌나요?
difficulty: 하
category: 분산 시스템
tags:
  - erasure coding
  - parity
  - durability
related:
  - consensus-vs-replication
---
# Erasure coding에서 k data shard와 m parity shard를 늘리면 저장 overhead와 장애 허용 수가 어떻게 바뀌나요?

## 구두 답변

MDS/RS 계열 또는 대상 profile이 “임의의 k개 shard로 복구”를 보장한다고 가정하면, `k` data와 `m` parity의 총 저장량은 원본의 `(k+m)/k`배이고, 최대 `m`개 shard 손실까지 수학적으로 견딜 수 있습니다. `k=6,m=3`이면 9개를 저장하고 6개가 남아야 하므로 `9/6=1.5`, 원본보다 50%의 저장량입니다. `m=4`로 늘리면 같은 k에서 overhead는 `10/6≈1.667`로 증가하고 독립 shard 여유는 4개로 커집니다.

반대로 k를 10으로 늘리고 m=3을 유지하면 overhead는 `13/10=1.3`으로 낮아지지만 작은 range도 더 많은 shard 조정과 decode fan-in을 요구할 수 있습니다. 이 계산은 rack·zone이 독립이고 같은 stripe의 coding contract가 적용된다는 전제입니다. 9개가 Rack A 6, B 2, C 1에 몰려 Rack A가 꺼지면 3개만 남아 복구 불능이므로 m=3이 rack 장애 보장이 되지 않습니다. 실제 Ceph plugin/profile과 release의 recovery·overwrite·placement 규칙을 확인하고, 저장 효율과 degraded latency·repair bandwidth를 함께 측정합니다.

따라서 k와 m을 고를 때는 숫자만 비교하지 않고 stripe 크기와 요청 단위를 함께 계산합니다. 큰 k는 `m/k`를 낮추지만 4KB range가 여러 shard에 걸리는 순간 읽기 fan-in과 네트워크 요청 수가 늘 수 있습니다. m을 늘리는 선택도 단순 내구성 향상이 아니라 parity 계산, 쓰기량, repair가 정상 트래픽과 경쟁하는 비용입니다. 최종 계약에는 독립 domain 수와 복구 profile의 “임의 k개” 조건을 명시합니다.

## 득점 포인트

- `(k+m)/k`와 `m` 손실 조건을 MDS/RS/profile 전제로 명시합니다.
- `6,3 → 9/6=1.5`, `10,3 → 13/10=1.3`을 직접 계산합니다.
- shard 수학과 failure-domain 가용성, partial read 비용을 분리합니다.

## 감점 포인트

- parity 3개가 rack 3개 장애를 보장한다고 말합니다.
- k·m 증가가 저장·읽기·repair 비용을 모두 개선한다고 단정합니다.
- 임의의 k개 복구 조건을 모든 erasure code의 보편 계약으로 씁니다.

## 더 파고들 거리

- 작은 range에서 k가 커질 때 실제 shard fan-in과 tail latency를 측정할 실험을 설계해 보세요.
- MDS 성질을 보장하지 않는 profile에서 “충분한 조각”을 어떻게 정의할지 조사해 보세요.
