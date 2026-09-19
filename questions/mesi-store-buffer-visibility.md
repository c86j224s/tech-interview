---
id: mesi-store-buffer-visibility
title: >-
  store buffer에 값이 남아 있는 동안 다른 코어가 이전 값을 읽습니다. coherence 상태와 store buffer drain을
  함께 설명하려면 무엇을 확인하나요?
difficulty: 중하
category: 동시성
tags:
  - MESI
  - store buffer
  - visibility
  - fence
related:
  - atomics-memory-order
  - cpp-release-sequence-visibility
---
# store buffer에 값이 남아 있는 동안 다른 코어가 이전 값을 읽습니다. coherence 상태와 store buffer drain을 함께 설명하려면 무엇을 확인하나요?

## 구두 답변

store가 실행됐다는 것은 명령이 파이프라인에서 발행됐다는 뜻이지, 다른 코어가 즉시 그 값을 읽는다는 뜻은 아닙니다. 먼저 `A store 발행 → A의 store buffer → 해당 line의 coherence 권한 획득/전파 → B의 load 관찰`을 분리해서 그립니다. `data`와 `flag`가 다른 주소라면 두 line의 권한 상태와 전파 시점도 별개입니다. 한 line이 `M`이 되었다고 해서 A의 다른 주소 store가 같은 순서로 보인다는 보장은 없습니다.

예를 들어 A가 `data=42; flag=1`을 수행하고 B가 `if (flag==1) read(data)`를 실행한다고 하겠습니다. B가 flag의 1을 읽었는데 data에서 0을 허용하지 않으려면, 단순히 MESI 상태를 설명하는 것이 아니라 release store와 acquire load 또는 명시적 fence를 사용해 공개 관계를 만들어야 합니다. relaxed 원자는 각 위치의 원자성·수정 순서를 제공할 수 있지만, 두 위치의 message-passing 순서를 자동으로 제공하지 않습니다. 일반 비원자 data를 동시 접근하면 언어 수준 data race 여부를 먼저 판정해야 합니다.

검증 표에는 `t0: data=0, flag=0`, `t1: A의 data store가 buffer에 있음`, `t2: flag store가 먼저 관찰될 수 있는지`, `t3: B가 flag=1 관찰`, `t4: acquire/fence 조건 아래 data=42 관찰`을 적습니다. fence의 의미는 어느 앞뒤 연산의 재배치를 제한하는지와 결합해 읽어야 하며, fence 하나만 추가했다고 임의 구조체가 안전해지지 않습니다. 실제 이전 값 관찰이 나왔다면 coherence 고장, store buffer 지연, 잘못된 언어 memory order를 구분하기 위해 동일 CPU·스레드 배치·최적화 수준으로 반복하되, 한 번의 비재현이 보장을 뜻한다고 말하지 않습니다.

## 득점 포인트

- store 발행·store buffer·coherence 전파·상대 load 관찰을 서로 다른 사건으로 나눕니다.
- data/flag message passing에서 relaxed와 release/acquire가 만드는 공개 관계를 구체 값 42와 1로 설명합니다.
- fence의 앞뒤 연산, 언어 data race, 실제 하드웨어 관찰을 각각 확인합니다.

## 감점 포인트

- M 상태가 다른 주소의 프로그램 순서까지 보장한다고 하면 coherence와 consistency를 혼동한 것입니다.
- store 발행 순간 모든 코어가 같은 시각에 새 값을 읽는다고 단정하면 buffer drain을 빠뜨립니다.
- fence 하나로 임의 구조체의 lifetime과 경쟁 접근이 자동으로 안전해진다고 말하면 안 됩니다.

## 더 파고들 거리

- flag acquire가 data=42를 언제 보장하는지 release가 만든 값을 읽는 조건까지 추적합니다.
- 두 atomic을 각각 읽어도 snapshot이 되지 않는 경우를 mutex와 대조합니다.
