---
id: cpu-pipeline-raw-forwarding
title: >-
  앞선 명령어의 결과를 바로 다음 명령어가 사용합니다. 레지스터에 쓰기까지 기다리지 않고 실행하려면 어떤 forwarding과 stall
  조건이 필요한가요?
difficulty: 하
category: 운영체제
tags:
  - CPU
  - 파이프라인
  - RAW
  - forwarding
related:
  - context-switch-overhead
---
# 앞선 명령어의 결과를 바로 다음 명령어가 사용합니다. 레지스터에 쓰기까지 기다리지 않고 실행하려면 어떤 forwarding과 stall 조건이 필요한가요?

## 구두 답변

결론부터 말하면 레지스터 파일에 기록된 시점이 아니라 producer가 결과를 만든 시점과 consumer가 입력을 요구하는 시점을 비교합니다. `add r1,r2,r3` 뒤 `sub r4,r1,r5`를 5단계 교육용 파이프라인으로 두면 add는 3사이클 EX 끝에서 r1을 만들고, sub는 4사이클 EX 입력에서 r1을 필요로 합니다. 이때 EX/MEM 레지스터의 결과를 ALU 입력 mux로 우회하면 WB까지 기다리지 않아도 됩니다. 이것이 ALU-to-ALU forwarding입니다.

반면 `load r1,0(r2)` 뒤 `add r3,r1,r4`에서는 load의 값이 MEM 접근이 끝나는 4사이클에야 생긴다고 가정합니다. 바로 뒤 add의 EX 요구 시점과 맞지 않으므로 hazard 검출기가 ID를 멈추고 bubble 하나를 삽입합니다. 예를 들어 load가 1 IF, 2 ID, 3 EX, 4 MEM, 5 WB를 지나면 뒤 add는 2 IF, 3 ID를 거친 뒤 4사이클에도 ID에 머무르고, 5 EX에서 MEM 결과를 받는 식으로 추적할 수 있습니다. 사이에 독립 명령어가 있으면 그 명령어가 bubble 자리를 사용합니다. L1 miss가 나면 준비 시점 자체가 뒤로 밀리므로 고정 한 사이클 규칙을 적용하면 안 됩니다.

구현에서는 source register와 앞선 명령어의 destination을 비교하되 이름 일치만으로 stall을 결정하지 않습니다. ALU, load, 곱셈처럼 결과 생성 단계가 다른 producer별 ready cycle, consumer의 operand need cycle, 가능한 bypass 경로를 함께 봅니다. forwarding 경로가 없거나 값이 아직 생성되지 않았으면 interlock이 pipeline register의 valid를 유지하고 뒤에 bubble을 넣습니다. 컴파일러가 독립 명령어를 사이에 배치해 stall을 줄일 수도 있지만, 그 재배치가 예외 순서와 데이터 의미를 보존해야 합니다. 실제 CPU의 latency와 bypass 종류는 구현별이므로 5단계 표를 특정 제품의 성능 보장으로 읽지 않습니다.

## 득점 포인트

- producer availability와 consumer need를 ALU 결과와 load 결과로 나누어 설명합니다.
- interlock이 register 이름만 비교해 load-use stall을 놓치는 경우를 지적합니다.

## 감점 포인트

- 질문에 없는 일반론으로 결론을 흐리거나 모든 CPU·workload에 같은 규칙을 적용합니다.
- 중간 상태, 실패 조건, 성능·보안 비용을 생략해 결과만 단정합니다.

## 더 파고들 거리

- 곱셈·cache miss처럼 결과 생성 단계가 긴 명령어의 bypass trace를 만들어 보세요.
- 입력 순서와 자원 조건을 바꿨을 때 어느 결론이 유지되고 어느 비용이 달라지는지 검증해 보세요.
