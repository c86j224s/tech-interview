---
id: cpu-pipeline-control-hazard
title: 조건 분기 결과가 나오기 전에 뒤 명령어를 가져옵니다. 분기 결과가 바뀌면 파이프라인에서 무엇을 폐기하고 다시 채워야 하나요?
difficulty: 하
category: 운영체제
tags:
  - CPU
  - 파이프라인
  - 분기
  - flush
related:
  - process-state-suspended
---
# 조건 분기 결과가 나오기 전에 뒤 명령어를 가져옵니다. 분기 결과가 바뀌면 파이프라인에서 무엇을 폐기하고 다시 채워야 하나요?

## 구두 답변

분기 예측이 틀리면 PC만 target으로 고치는 것이 아니라, 분기보다 뒤에 있고 아직 retirement하지 않은 잘못된 경로의 in-flight 명령어를 squash한 뒤 target에서 다시 fetch해야 합니다. 5단계 IF-ID-EX-MEM-WB 모델에서 분기가 EX에서 resolve된다고 하겠습니다. 순차 경로를 not-taken으로 예측했지만 실제 결과가 taken이면, resolve 시점에 IF와 ID에 들어온 두 명령어는 target 경로가 아니므로 pipeline register의 valid를 0으로 만들고 다음 fetch PC를 target으로 설정합니다.

예를 들어 cycle 1에 branch가 IF, cycle 2에 ID, cycle 3에 EX로 들어가고, 순차 주소의 I1이 cycle 2 IF·cycle 3 ID에 있고 I2가 cycle 3 IF에 있었다면 cycle 3의 resolve 결과는 I1·I2를 무효화합니다. target의 첫 명령어는 이후 IF에서 다시 채워지며, 그 때문에 모델상 빈 슬롯이 생깁니다. 만일 분기 해결이 MEM으로 늦어지면 더 많은 명령어가 잘못된 경로에 들어와 penalty가 커집니다. 예측이 맞았을 때는 준비한 경로를 그대로 이어가므로 이 폐기 비용이 없습니다.

폐기 범위에는 pipeline register뿐 아니라 실행 대기열, rename 결과, 아직 retire하지 않은 fault 후보가 포함된다고 보는 것이 안전합니다. 잘못된 경로의 레지스터 결과가 architectural register에 기록되거나 store가 프로그램 메모리에 보이면 오예측 회복이 실패한 것입니다. 반대로 cache line이나 predictor history 같은 내부 흔적까지 반드시 원상 복구된다는 뜻은 아닙니다. 따라서 correctness의 flush와 microarchitectural 보안 문제를 구분합니다. 이 표의 두 명령과 cycle 수는 설명용 교육 모델이며 실제 fetch 폭, resolve 위치, 회복 latency는 대상 CPU 자료와 측정으로 확인해야 합니다.

## 득점 포인트

- resolve 시점의 PC, valid bit, squash 집합, target refill을 순서대로 추적합니다.
- 잘못된 경로의 결과와 내부 cache 흔적을 모두 같은 flush 결과로 처리합니다.

## 감점 포인트

- 질문에 없는 일반론으로 결론을 흐리거나 모든 CPU·workload에 같은 규칙을 적용합니다.
- 중간 상태, 실패 조건, 성능·보안 비용을 생략해 결과만 단정합니다.

## 더 파고들 거리

- fetch 폭과 branch resolve 단계가 달라질 때 폐기 명령 수를 계산해 보세요.
- 입력 순서와 자원 조건을 바꿨을 때 어느 결론이 유지되고 어느 비용이 달라지는지 검증해 보세요.
