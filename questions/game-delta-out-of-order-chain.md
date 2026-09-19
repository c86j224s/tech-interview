---
id: game-delta-out-of-order-chain
title: 서로 다른 baseline을 가진 delta가 순서 역전으로 도착하면 어떤 것을 적용하나요?
difficulty: 중하
category: 게임 서버
tags:
  - delta compression
  - sequence
  - out-of-order
related:
  - game-state-input-delivery-classes
---
# 서로 다른 baseline을 가진 delta가 순서 역전으로 도착하면 어떤 것을 적용하나요?

## 구두 답변

먼저 packet의 `baselineId`가 receiver가 실제로 설치한 canonical state와 맞는지 보고, 그 다음 target sequence의 최신성을 판단합니다. 현재가 S8일 때 D10(base=S8)과 D12(base=S10)이면 D10을 설치해 S10을 만든 뒤 D12를 적용합니다. D12가 먼저 오면 S10이 없으므로 짧은 bounded buffer에 보관하고 age·bytes 상한을 넘으면 NACK/full resync로 전환합니다. D10 설치 후 늦은 D11(base=S8)이 오면 chained stream의 stale target이므로 버립니다. 다만 D12(base=S8)가 독립 delta라면 S8에서 canonical S12를 완전히 재구성할 수 있는지 확인한 뒤 atomic replacement로만 현재 S10을 대체할 수 있습니다. 이를 S10 위에 partial patch로 합치면 S8 mask의 unchanged 의미와 S10 값이 섞여 잘못된 상태가 됩니다. 즉 숫자가 큰 target을 무조건 먼저 고르는 것도, 현재 상태에 임의 merge하는 것도 금지합니다. pending은 generation·schema·epoch가 바뀌면 폐기하고, 시험은 D12 선행, D11 지연, duplicate, baseline mismatch를 각각 canonical output과 resync 횟수로 검증합니다.


독립 delta를 허용할 때는 “현재보다 target이 최신”이라는 비교만으로 충분하지 않고, base에서 target까지의 canonical reconstruction 결과가 현재 state를 대체해도 되는지 확인해야 합니다. S12가 B8에서 직접 만들어졌다면 S10에 없는 필드를 유지하는 merge가 아니라 완성된 S12 객체로 atomic replace합니다. 반면 D12가 S10의 health 변화만 담는 patch라면 S10을 기다립니다. 이 구분을 packet kind나 dependency list에 기록하면 운영자가 숫자 sequence만 보고 잘못된 우회 적용을 하는 일을 줄일 수 있습니다.
## 득점 포인트

- D10→D12 chain과 D12 선행 trace를 dependency와 sequence로 분리합니다.
- 독립 baseline delta의 atomic replacement 조건과 chained patch 금지를 명시합니다.
- bounded pending·generation 변경·resync 경계를 함께 설명합니다.

## 감점 포인트

- target 숫자가 큰 D12를 S8 위에 바로 적용합니다.
- 독립 delta와 chained delta를 구분하지 않고 현재 state에 field merge합니다.
- packet loss 대비 buffer를 무한히 두거나 stale D11을 최신 일부로 취급합니다.

## 더 파고들 거리

- dependency graph가 길어질 때 chain depth와 pending age 중 어떤 기준으로 full을 선택할지 정해 보세요.
- sequence wrap과 generation 변경이 동시에 발생하면 stale 비교와 pending 폐기 순서를 설명해 보세요.
