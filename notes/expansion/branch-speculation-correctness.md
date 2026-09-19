---
id: branch-speculation-correctness
title: 분기 예측과 추측 실행의 정확성
topic: 시스템
summary: 분기 예측이 틀렸을 때 건축적으로 보이는 결과를 보존하면서 추측 경로의 작업을 폐기하는 원리를 설명합니다.
questionIds: []
prerequisites:
  - execution-boundaries
related:
  - atomic-publication
  - cacheline-layout
reviewedAt: '2026-09-19'
---
# 분기 예측과 추측 실행의 정확성

분기 예측은 조건이 확정되기 전에 다음 PC를 추정해 fetch와 실행을 이어 가는 방법입니다. 정확성은 예측이 언제나 맞는다는 뜻이 아니라, 틀린 경로가 프로그램에 보이는 상태를 확정하지 않는다는 뜻입니다. 따라서 architectural register·메모리·프로그램 순서상 예외와, reorder buffer·rename 값·cache·predictor 같은 내부 상태를 먼저 분리해야 합니다.

## 상태의 두 층

architectural state는 ISA 관점에서 다음 명령어가 읽을 수 있는 레지스터와 메모리, PC, 보고할 예외입니다. 내부 실행 결과는 계산되었더라도 아직 프로그램 결과가 아닐 수 있습니다. `ok=false`인데 true를 예측해 `x=1` store를 준비한 경우, 분기 확인 전에 그 store가 store buffer에 들어갈 수는 있지만 잘못된 경로로 표시되어 retirement와 architectural visibility를 통과해서는 안 됩니다. 내부 상태가 잠시 변했다는 사실과 프로그램 결과가 바뀌었다는 사실을 같은 것으로 말하면 안 됩니다.

## 예측부터 retirement까지

predictor가 taken과 target을 선택하면 fetch는 target 경로를 가져옵니다. decode와 execute는 조건 계산과 뒤 명령어를 겹쳐 처리하고, resolve 시점에 실제 조건과 target을 비교합니다. 맞으면 이미 준비한 명령어가 순서대로 진행되고, 틀리면 분기 이후의 in-flight 항목을 squash하고 올바른 PC에서 refill합니다. out-of-order 설계에서는 결과와 fault 후보가 내부 대기열에 저장되며, 앞선 명령어가 준비되지 않았거나 분기가 아직 확인되지 않았으면 retirement하지 않습니다. 이 순서는 개념적 계약이며 실제 buffer 이름과 크기는 CPU별로 다릅니다.

## 오예측 회복

5단계 모델에서 분기가 EX에서 resolve되고 순차 경로를 잘못 fetch했다고 하겠습니다. 현재 IF와 ID의 명령어는 target 경로가 아니므로 valid를 지우고, target의 첫 명령어를 다음 fetch 위치로 넣습니다. 이미 EX를 끝낸 후보가 있다면 그 후보가 branch보다 뒤인지 확인해 함께 폐기합니다. PC만 바꾸고 잘못된 경로의 유효 상태를 그대로 두면 레지스터 결과나 fault 후보가 남을 수 있으므로 불충분합니다. 회복 비용은 resolve 위치, fetch 폭, in-flight 깊이, target fetch 지연에 따라 달라집니다.

## 예외와 순서

precise exception과 in-order retirement를 보장하는 out-of-order 설계에서는 잘못된 경로의 page fault나 보호 위반을 즉시 외부 예외로 보고하지 않고 후보 상태로 둡니다. 실제 경로의 명령어가 순서상 retirement 대상이 되었을 때만 예외를 보고해 앞선 architectural 상태와 일관성을 만듭니다. 이 문서는 특정 ISA의 모든 fault 분류를 확정하는 근거가 아니라 그 계약을 가진 교육용 모델입니다. 대상 ISA 문서가 없으면 “모든 CPU가 fault metadata를 같은 방식으로 저장한다”고 일반화하지 않습니다.

## 내부 흔적

squash는 결과의 architectural 반영을 취소하지만 cache line fill, TLB entry, branch history, predictor counter 같은 모든 microarchitectural 변화를 되돌린다고 보장하지 않습니다. 예측 load가 특정 line을 warm하게 만들고 뒤의 probe가 접근 시간 차이를 본다면, 값은 폐기되었어도 상태 변화는 정보 경로가 될 수 있습니다. 실제 누출에는 공격자 위치, 공유 자원, 측정 정밀도, 권한, 완화책이라는 추가 조건이 필요하므로 “추측 load만 있으면 공격 성공”이라고 쓰지 않습니다.

## Predictor 간섭

제한된 predictor table에서는 서로 다른 branch가 같은 index나 history 표현을 공유할 수 있습니다. 교육용 4-entry table에서 `index=PC mod 4`로 A와 B가 같은 slot을 쓰고, A의 결과가 taken, B의 결과가 not-taken이라고 하겠습니다. A만 반복할 때와 A→B→A 순서를 비교하면 B update가 A의 다음 counter 상태를 바꾸어 같은 A 입력도 다른 예측을 만들 수 있습니다. 실제 predictor는 local/global history와 hash를 사용할 수 있으므로 주소, history, index 함수, 초기 상태, 실행 순서를 모두 고정해야 재현됩니다.

## 장벽의 범위

C++ memory-order fence는 언어 수준의 원자 접근 순서와 happens-before를 위한 수단이지 자동으로 보안용 speculation barrier가 아닙니다. compiler barrier는 재배치 범위를 제한하지만 CPU의 실행·관찰을 직접 막는다는 뜻도 아닙니다. 대상 ISA가 명시한 speculation barrier 또는 serializing instruction은 별도 범주로 검토해야 합니다. 보호할 경계와 공격 모델을 정한 뒤 보장 범위가 실제 load 경로를 덮는지 확인하고, 그 뒤 cycles·IPC·branch miss·load latency를 비교합니다.

```diagram
{"title":"예측 경로의 확정 경계","caption":"예측 경로는 실행될 수 있지만 resolve 전에는 확정되지 않으며, 내부 흔적은 별도 관찰면으로 남을 수 있습니다.","rows":[[{"id":"predict","label":"예측·fetch","detail":["다음 PC 선택"]}],[{"id":"execute","label":"추측 실행","detail":["결과·fault 후보"]}],[{"id":"resolve","label":"조건 resolve","detail":["실제 경로 판정"]}],[{"id":"commit","label":"retirement","detail":["유효 결과 확정"]},{"id":"trace","label":"내부 흔적","detail":["cache·TLB·history"]}]],"edges":[{"from":"predict","to":"execute","label":"예상 경로 진행"},{"from":"execute","to":"resolve","label":"조건 계산 대기"},{"from":"resolve","to":"commit","label":"맞으면 순서 확정"},{"from":"resolve","to":"trace","label":"상태 변화 잔존 가능"},{"from":"execute","to":"commit","label":"틀리면 squash"}]}
```

## 검증과 비용

trace에는 branch PC, 예측, resolve cycle, squash 집합, retirement 결과를 적습니다. aliasing은 교육용 counter simulator에서 A/B 교차 실행으로 확인하고, 내부 흔적은 실제 CPU에서 성공했다고 주장하지 않고 관찰 가능성의 조건만 분리합니다. predictor를 크게 하면 충돌을 줄일 수 있지만 면적·전력과 warm-up 비용이 커지고, 장벽은 speculative window를 줄이는 대신 pipeline 겹침과 IPC를 낮출 수 있습니다.

## 참고 자료와 한계

- [Intel Software Developer Manuals](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html) — 공식 진입점과 관련 문서 연결만 확인했습니다. 랜딩 페이지에서 보편적인 predictor·retirement 규칙을 읽어 확정하지 않았습니다.
- [Intel Analysis of Speculative Execution Side Channels](https://www.intel.com/content/www/us/en/content-details/671163/intel-analysis-of-speculative-execution-side-channels.html) — 추측 실행 보안 분석의 출발점이며, 이 페이지 자체를 세부 완화 규칙의 단독 근거로 쓰지 않았습니다.
- [C++ atomic_thread_fence reference](https://en.cppreference.com/w/cpp/atomic/atomic_thread_fence.html) — 언어 memory ordering과 speculation barrier를 구분하는 보조 자료입니다.
