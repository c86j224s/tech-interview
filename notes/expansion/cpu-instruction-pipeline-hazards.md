---
id: cpu-instruction-pipeline-hazards
title: CPU 명령어 파이프라인과 해저드
topic: 시스템
summary: >-
  명령어를 여러 단계로 겹쳐 실행할 때 데이터·제어·구조적 해저드가 stall, forwarding, flush로 어떻게 처리되는지
  설명합니다.
questionIds: []
prerequisites:
  - execution-boundaries
  - cpu-scheduling
related:
  - cacheline-layout
  - atomic-publication
reviewedAt: '2026-09-19'
---
# CPU 명령어 파이프라인과 해저드

파이프라인의 핵심은 명령어 하나를 여러 조각으로 잘라 단일 명령어의 완료 시간을 자동으로 줄이는 데 있지 않습니다. 인출과 해석을 끝낸 명령어가 연산하는 동안 다음 명령어가 인출되도록 겹쳐서, 독립적인 명령어 흐름의 완료 간격을 줄이는 데 있습니다. 여기서는 IF, ID, EX, MEM, WB라는 다섯 단계의 교육용 in-order 모델을 사용합니다. 실제 프로세서는 단계 수, 실행 포트, 분기 해결 위치가 다르므로 아래 수치는 메커니즘을 추적하기 위한 계산입니다.

## 단계와 상태

각 pipeline register에는 적어도 valid, opcode, source/destination register, operand-ready 시점을 기록한다고 생각하면 설명이 명확해집니다. valid가 0이면 그 칸은 bubble이라 자원은 점유하지 않지만 파이프라인의 시간 슬롯은 지나갑니다. 독립 명령어 네 개를 1사이클 단계로 흘리면 첫 명령어는 1~5사이클을 거쳐 5사이클에 완료되고, 뒤 명령어는 6, 7, 8사이클에 완료됩니다. 단일 명령어의 지연시간은 5사이클이지만 steady state의 완료 간격은 1사이클입니다.

## 데이터 의존성과 시점

`add r1,r2,r3`가 사이클 3의 EX 끝에서 결과를 만들고 다음 `sub r4,r1,r5`가 사이클 4의 EX 입력에서 그 값을 요구한다고 하겠습니다. WB까지 기다리는 대신 EX/MEM pipeline register의 결과를 ALU 입력 mux로 우회하면 RAW 의존성을 한 사이클 지연 없이 처리할 수 있습니다. 반대로 `load r1,0(r2)`는 같은 모델에서 MEM 끝인 사이클 4에야 값이 생깁니다. 바로 뒤 `add`의 EX 요구 시점과 겹치므로 interlock이 ID를 멈추고 bubble 하나를 삽입한 뒤 사이클 5에 forwarding합니다. source와 destination 이름이 같다는 검사는 필요조건일 뿐, 결과 가용 시점과 consumer 요구 시점을 함께 비교해야 합니다.

## 구조적 자원

구조적 해저드는 값이 아니라 같은 사이클에 필요한 자원의 수가 부족해서 생깁니다. 단일 포트 메모리를 쓰는 모델에서 사이클 4에 한 명령어의 IF와 다른 명령어의 MEM이 동시에 오면 둘 중 하나를 사이클 5로 미뤄야 합니다. instruction/data cache를 분리하면 이 충돌을 없앨 수 있지만 포트와 태그 비교기가 늘어납니다. 실행 유닛을 복제해도 register-file read port와 writeback bus가 동시에 병목이 될 수 있으므로 한 유닛의 사용률만 보고 설계를 결정하면 안 됩니다. 자원별 점유표와 목표 initiation interval을 같이 계산해야 합니다.

## 제어 흐름

분기가 EX에서 resolve되는 5단계 모델에서 not-taken으로 예측했지만 실제로 taken이면, 분기 뒤에 순차 주소로 들어온 IF·ID의 두 명령어가 잘못된 경로입니다. PC만 target으로 바꾸는 것으로 충분하지 않습니다. 해당 pipeline register와 실행 대기열의 valid를 지우고, 잘못된 결과와 fault 후보가 retirement에 도달하지 못하게 한 뒤 target에서 다시 fetch해야 합니다. resolve가 MEM처럼 더 뒤로 이동하면 같은 fetch 폭에서 폐기할 명령어가 늘어 penalty도 커질 수 있습니다. 예측이 맞는 경우에는 이미 채운 경로를 그대로 사용하므로 flush가 발생하지 않습니다.

## 지연시간과 처리량

깊은 파이프라인은 조합 논리를 더 잘게 나눠 높은 클록을 노릴 수 있지만 fill·drain, 분기 회복, 의존성 chain 비용을 늘릴 수 있습니다. 예를 들어 5단계와 10단계가 모두 단계당 1사이클이라고 가정하면 단일 명령어는 각각 5와 10사이클입니다. 독립 명령어 네 개의 완료 시점은 5,6,7,8 대 10,11,12,13입니다. 긴 독립 stream에서는 두 모델 모두 이상적으로 한 사이클마다 완료하지만, `r1`을 만든 직후 계속 사용하는 chain은 각 producer latency에 묶입니다. 따라서 IPC 하나가 아니라 dependency stall, branch miss, cache miss를 분리해 봅니다.

## 구현 추적

교육용 시뮬레이터는 사이클 시작마다 WB, MEM, EX, ID, IF 순서로 자원과 valid를 갱신하고, forwarding 후보를 계산한 뒤 stall 또는 bubble을 넣는 방식이 안전합니다. `add→sub`, `load→add`, IF/MEM 단일 포트, taken branch 오예측을 별도 테스트로 두면 원인이 섞이지 않습니다. ALU 결과는 EX 끝, load 결과는 MEM 끝이라는 가정은 trace에 명시하고, 실제 대상 CPU의 latency로 바꾸려면 해당 ISA·마이크로아키텍처 자료나 counter를 추가해야 합니다.

```diagram
{"title":"해저드의 판정과 회복","caption":"값의 준비 시점, 자원 점유, 다음 PC를 각각 판정한 뒤 forwarding·stall·flush를 선택합니다.","rows":[[{"id":"issue","label":"인출·발행","detail":["opcode·valid·PC"]}],[{"id":"data","label":"값 시점","detail":["producer·consumer"]},{"id":"resource","label":"자원 점유","detail":["포트·유닛"]},{"id":"control","label":"분기 경로","detail":["예측·target"]}],[{"id":"forward","label":"forwarding","detail":["우회 입력"]},{"id":"stall","label":"stall·bubble","detail":["늦은 값·자원"]},{"id":"flush","label":"squash·refill","detail":["오예측 회복"]}],[{"id":"retire","label":"순서 완료","detail":["유효 결과만 반영"]}]],"edges":[{"from":"issue","to":"data","label":"source 확인"},{"from":"issue","to":"resource","label":"요구 자원"},{"from":"issue","to":"control","label":"다음 PC"},{"from":"data","to":"forward","label":"값이 이미 준비"},{"from":"data","to":"stall","label":"값이 늦음"},{"from":"resource","to":"stall","label":"동시 점유 충돌"},{"from":"control","to":"flush","label":"target 불일치"},{"from":"forward","to":"retire","label":"의존 진행"},{"from":"stall","to":"retire","label":"bubble 뒤 진행"},{"from":"flush","to":"retire","label":"target 재인출"}]}
```

## 실패와 비용

forwarding 경로는 mux, 배선, timing 검증 비용을 만들고, 포트 복제는 면적·전력을 소비합니다. 모든 RAW를 없앤다고 가정하면 load miss와 긴 실행 latency를 설명하지 못하고, 실행 유닛을 늘리면 모든 구조적 병목이 사라진다고 보면 register-file과 writeback 병목을 놓칩니다. flush가 cache 흔적까지 지운다고 말하는 것도 correctness와 microarchitecture 관찰을 섞는 오류입니다.

## 참고 자료와 한계

- [Intel Software Developer Manuals](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html) — 공식 문서 진입점은 확인했지만 랜딩 페이지로 보편적인 5단계, forwarding 경로, predictor 내부를 검증하지 않았습니다.
- [CPU 스케줄링과 실행 예산](/tech-interview/notes/cpu-scheduling/) — runnable 작업 선택과 명령어 내부 hazard를 구분하는 비교 자료입니다.
- [프로세스와 커널 실행 경계](/tech-interview/notes/execution-boundaries/) — CPU pipeline과 권한·스케줄 경계를 분리합니다.
