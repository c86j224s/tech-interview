---
id: erasure-failure-domain-placement
title: Erasure shard를 같은 rack에 배치하면 k+m 계산이 맞아도 어떤 장애를 견디지 못하나요?
difficulty: 하
category: 분산 시스템
tags:
  - erasure coding
  - failure domain
  - placement
related:
  - consistent-hash-virtual-nodes
---
# Erasure shard를 같은 rack에 배치하면 k+m 계산이 맞아도 어떤 장애를 견디지 못하나요?

## 구두 답변

`m`은 독립적으로 손실된 shard 수에 대한 coding 여유이지, 한 rack이나 zone이 통째로 사라지는 상관 장애를 자동으로 견딘다는 뜻이 아닙니다. MDS/RS형 `k=6,m=3`의 9개 shard가 Rack A 6개, B 2개, C 1개로 배치되었다고 하겠습니다. A가 장애 나면 B와 C의 3개만 남아 필요한 6개에 못 미칩니다. 반대로 세 rack에 3개씩 두면 한 rack 장애 뒤 6개가 남아 이 수학 모델의 경계 안에 들어갑니다.

그래도 rack마다 3개라는 숫자만으로 보장이 끝나지 않습니다. 같은 top-of-rack switch, power domain, chassis, zone, maintenance batch가 함께 실패하면 서로 다른 서버도 같은 failure domain일 수 있습니다. 그래서 목표를 “독립 device 3개 손실”과 “rack 1개 손실”처럼 별도로 적고, placement rule과 rebalance 후 실제 shard 위치를 대조합니다. coding profile이 요구하는 shard 조합, 작은 object 예외, 복구 중 일시적 분산 붕괴도 함께 확인해야 합니다. `k+m` 산술은 배치 독립성 검증을 통과한 뒤에만 availability 근거로 사용합니다.

실무에서는 “rack 하나 장애”라는 목표를 먼저 placement 제약으로 번역합니다. 9개를 3개 rack에 균등하게 놓는 규칙이 있어도 rack 수가 두 개뿐이면 3-3-3 자체가 불가능하므로 profile을 바꾸거나 복제 정책을 섞어야 합니다. 또한 repair가 새 shard를 가장 가까운 빈 장비에만 쓰면 복구 직후 다시 한 rack에 몰릴 수 있으므로, repair 완료 조건에 checksum뿐 아니라 domain 분산 검사를 포함합니다.

실무에서는 “rack 하나 장애”라는 목표를 먼저 placement 제약으로 번역합니다. 9개를 3개 rack에 균등하게 놓는 규칙이 있어도 rack 수가 두 개뿐이면 3-3-3 자체가 불가능하므로 profile을 바꾸거나 복제 정책을 섞어야 합니다. 또한 repair가 새 shard를 가장 가까운 빈 장비에만 쓰면 복구 직후 다시 한 rack에 몰릴 수 있으므로, repair 완료 조건에 checksum뿐 아니라 domain 분산 검사를 포함합니다. 장애 직후 임시 degraded 상태와 최종 placement 정상 상태를 따로 표시해야 운영자가 복구 완료를 과대평가하지 않습니다.

## 득점 포인트

- Rack A 6개 손실 뒤 3개만 남는 계산과 3-3-3 배치를 비교합니다.
- device·host·rack·zone·power·network의 상관 장애를 분리합니다.
- placement rule뿐 아니라 rebalance 후 실제 분포와 복구 중 상태를 검증 대상으로 둡니다.

## 감점 포인트

- 서버가 9대면 shard가 모두 독립이라고 가정합니다.
- m=3이 rack 세 개 또는 zone 세 개 장애를 자동으로 보장한다고 말합니다.
- 설정된 placement rule만 보고 현재 위치와 maintenance batch를 확인하지 않습니다.

## 더 파고들 거리

- 한 zone 장애와 한 rack 장애를 동시에 목표로 할 때 필요한 shard 수와 배치 제약을 모델링해 보세요.
- rebalance 중 일시적으로 domain 분산이 깨지는 상태를 읽기·쓰기 API에서 어떻게 표시할지 결정해 보세요.
