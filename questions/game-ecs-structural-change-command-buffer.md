---
id: game-ecs-structural-change-command-buffer
title: ECS iteration 중 add/remove를 즉시 수행하지 않고 command buffer로 미루는 이유는 무엇인가요?
difficulty: 중하
category: 게임 서버
tags:
  - ECS
  - command buffer
  - iteration
related:
  - cpu-cache-false-sharing
  - game-state-input-delivery-classes
---
# ECS iteration 중 add/remove를 즉시 수행하지 않고 command buffer로 미루는 이유는 무엇인가요?

## 구두 답변

순회 중인 query의 읽기 집합과 저장 구조를 동시에 바꾸면 iterator가 가리키던 row의 의미가 바뀌므로 구조 변경을 command buffer에 기록했다가 phase 경계에서 적용합니다. `Alive` entity를 읽는 전투 시스템이 10번 entity에 `Dead`를 붙일 때 즉시 이동하면 swap-remove로 다음 index를 건너뛰거나 같은 entity를 다시 읽을 수 있습니다. 명령에는 `tick=120, worker=2, sequence=17, entity=(10,generation=4), op=Add Dead`처럼 적용에 필요한 식별자를 담고 phase 뒤 세대와 현재 상태를 재검증합니다.

지연 적용 동안 다른 query는 옛 상태를 봅니다. 여러 worker buffer는 완료 순서가 아니라 `(tick,phase,worker,sequence)` 같은 canonical key로 merge하고 같은 entity의 add/remove 충돌은 마지막 승리나 명시적 오류로 고정해야 replay가 같습니다. 오래된 generation은 버리고 buffer 길이·적용 지연·충돌 수를 관찰합니다. command buffer는 수명과 결정성을 자동 보장하는 장치가 아니라 읽기와 mutation의 경계를 만드는 설계입니다.

예를 들어 같은 tick에 worker 1이 Add Dead를, worker 3이 Remove Dead를 발행했다면 sequence를 단순히 도착 시간으로 정하지 않습니다. canonical key를 비교해 한 명령을 승자로 정하거나 충돌을 오류로 남겨야 하며, 적용 전 query와 적용 후 query가 어느 phase에서 보이는지도 문서화합니다. 그렇지 않으면 iterator 문제는 사라져도 replay 불일치가 남습니다.

 이 정책은 buffer를 비우는 시점도 포함합니다. phase 경계에서 명령을 정렬·검증·적용한 뒤에만 다음 query를 열고, 적용 지연이 예산을 넘으면 명령을 버리는 대신 back-pressure나 다음 tick 이월을 명시합니다. 그래야 안정성을 위해 도입한 지연이 숨은 상태 오류가 되지 않습니다.

## 득점 포인트

- 순회 집합의 안정성과 변경 가시성을 phase 경계로 나눕니다.
- 충돌 명령의 정렬 키와 대상 generation을 명시합니다.

## 감점 포인트

- 버퍼에 넣기만 하면 실행 순서가 결정적이라고 단정합니다.
- worker 번호가 비결정적으로 배정되는데 그 번호로 정렬하면 재현된다고 합니다.

## 더 파고들 거리

- worker 수가 바뀌어도 같은 명령 순서를 만들려면 정렬 키를 무엇으로 정할까요?
- 한 틱의 구조 변경 명령이 예산을 넘으면 다음 틱의 query는 무엇을 보나요?
