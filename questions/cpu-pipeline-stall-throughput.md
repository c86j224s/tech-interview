---
id: cpu-pipeline-stall-throughput
title: >-
  파이프라인 깊이를 늘렸는데 단일 명령어 지연은 줄지 않고 처리량만 좋아질 수 있습니다. latency와 throughput을 어떻게 구분해
  설명하나요?
difficulty: 하
category: 운영체제
tags:
  - CPU
  - 파이프라인
  - latency
  - throughput
related:
  - throughput-vs-latency
---
# 파이프라인 깊이를 늘렸는데 단일 명령어 지연은 줄지 않고 처리량만 좋아질 수 있습니다. latency와 throughput을 어떻게 구분해 설명하나요?

## 구두 답변

latency는 한 명령어가 시작해 결과를 얻기까지의 시간이고 throughput은 충분한 명령어가 있을 때 단위 시간당 완료하는 양입니다. 파이프라인은 단계들을 겹쳐 독립 stream의 완료 간격을 줄이지만, 한 명령어가 거쳐야 하는 단계 수와 의존성 chain을 없애지는 않습니다. 따라서 깊이를 늘렸다는 이유만으로 단일 명령어 latency가 줄었다고 말하지 않습니다.

단계당 1 cycle인 교육용 모델을 비교해 보겠습니다. 5단계 파이프라인의 단일 명령어는 1~5 cycle을 써 5 cycle에 완료합니다. 10단계라면 1~10 cycle을 써 10 cycle에 완료합니다. 독립 명령어 네 개는 5단계에서 5,6,7,8 cycle, 10단계에서 10,11,12,13 cycle에 끝납니다. 첫 결과까지는 깊은 파이프라인이 늦지만 steady state의 완료 간격은 둘 다 1 cycle입니다. 실제 설계에서는 단계당 clock period를 줄여 시간 latency를 보상할 수 있지만, 그 값은 해당 구현의 측정 문제입니다.

의존 chain `r1=...; r2=r1+1; r3=r2+1`에서는 다음 명령어가 앞 결과를 기다리므로 initiation interval이 producer latency와 forwarding 경로에 묶입니다. 반대로 독립 연산 네 개는 서로 다른 단계에 동시에 놓여 throughput 이득을 얻습니다. 여기에 pipeline fill·drain, branch mispredict flush, cache miss, 구조적 자원 충돌이 들어가면 `명령어 수/단계 수`만으로 성능을 예측할 수 없습니다. 비교할 때는 동일 workload에서 첫 완료 latency, steady-state IPC, dependency stall, branch miss, cache miss를 분리해 기록합니다. 아래 계산은 구조를 설명하는 산술이며 특정 CPU의 성능 결과가 아닙니다.

## 득점 포인트

- 5단계와 10단계의 첫 완료 시점, 완료 간격, dependency chain을 별도로 계산합니다.
- steady-state throughput을 단일 명령어 latency 또는 단계 수만으로 설명합니다.

## 감점 포인트

- 질문에 없는 일반론으로 결론을 흐리거나 모든 CPU·workload에 같은 규칙을 적용합니다.
- 중간 상태, 실패 조건, 성능·보안 비용을 생략해 결과만 단정합니다.

## 더 파고들 거리

- fill·drain을 제거한 긴 stream과 branch/cache miss가 있는 stream을 각각 측정해 보세요.
- 입력 순서와 자원 조건을 바꿨을 때 어느 결론이 유지되고 어느 비용이 달라지는지 검증해 보세요.
