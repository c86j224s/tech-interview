---
id: floating-point-deterministic-simulation-limits
title: 부동소수점 결정적 시뮬레이션의 한계
topic: 게임 서버
summary: >-
  같은 입력이라도 플랫폼·컴파일러·실행 순서·수학 라이브러리 차이로 게임 상태가 갈라질 수 있는 지점을 고정 tick, 연산 순서, 정수화,
  검증 로그로 구분합니다.
questionIds: []
prerequisites:
  - simulation-budget
  - pure-state
  - input-authority
related:
  - simulation-budget
  - pure-state
  - input-authority
reviewedAt: '2026-09-19'
---
# 부동소수점 결정적 시뮬레이션의 한계

결정적 시뮬레이션은 “float를 사용하지 않는다”는 한 문장으로 정의되지 않습니다. 같은 초기 상태와 같은 입력을 넣었을 때, 같은 tick에서 상태가 같은 방식으로 갱신되고 비교 가능한 외부 효과가 같은 순서로 나와야 합니다. IEEE-754가 수의 표현과 기본 연산의 일부를 설명해도, 언어·컴파일러·CPU가 어떤 연산을 합치고 어떤 순서로 실행하며 `sin`, `cos`, `sqrt` 같은 수학 함수를 어떻게 구현할지는 별도의 계약입니다.

Gaffer On Games의 deterministic lockstep 글은 같은 시작 상태·입력·시간 간격으로 bit-identical한 상태를 요구하고, 컴파일러·운영체제·instruction set 차이가 재현을 깨뜨릴 수 있다고 설명합니다. 한 기기에서 두 인스턴스가 맞는다는 사실이 플랫폼 간 보장을 의미하지도 않습니다. 따라서 fixed tick은 필요조건에 가깝지만 충분조건이 아니며, 재현 로그와 상태 hash는 “결정적이라고 믿는 것”을 “어느 tick에서 갈라졌는지 관찰하는 것”으로 바꾸는 장치입니다.

## IEEE-754와 언어 실행 계약

부동소수점은 유한한 bit로 실수를 근사하므로 덧셈·곱셈 결과를 다시 반올림합니다. `(a*b)+c`는 보통 곱셈 결과를 한 번 반올림한 뒤 더하고 다시 반올림할 수 있지만, FMA가 사용되면 중간 결과를 유지한 채 한 번 반올림할 수 있습니다. 두 결과가 마지막 bit에서 달라질 수 있고, 그 값이 `if (x > threshold)`에 들어가면 branch가 달라집니다. 이후 서로 다른 entity를 처리하거나 서로 다른 RNG를 소비하며 작은 차이가 상태 차이로 확대됩니다.

컴파일러의 contraction 설정, debug/release 최적화, SIMD vectorization, excess precision, denormal 처리와 rounding mode는 구현·빌드 계약입니다. “둘 다 float이고 IEEE-754다”라는 말은 source-level expression의 실행 경로가 동일하다는 뜻이 아닙니다. NaN 비교, signed zero, overflow/underflow 처리도 규칙에 영향을 줄 수 있습니다. 권위 simulation이라면 허용된 compiler flag, target ISA, fast-math 사용 여부와 math library를 빌드 산출물의 일부로 고정해야 하며, 이를 모르면 cross-platform 결정성을 주장하지 않습니다.

## FMA 한 번과 두 번의 반올림

FMA의 핵심은 같은 source 식이라도 rounding point가 달라진다는 점입니다. 분리 경로는 `round(round(a*b)+c)`이고, fused 경로는 `round(a*b+c)`입니다. 이 문서에서는 재현 가능한 binary32 operand와 특정 CPU 출력까지 확보하지 않았으므로 임의의 십진수 결과를 제시하지 않습니다. 실제 검증에서는 `float` 입력을 hex 또는 bit pattern으로 고정하고, FMA on/off를 각각 실행해 bit pattern과 branch 결과를 기록해야 합니다.

velocity update가 `v = v * drag + impulse`이고 threshold가 `0.0`이라면, 두 경로가 `+ε`와 `-ε`로 갈라질 수 있습니다. 한 쪽은 충돌 후보를 추가하고 다른 쪽은 제외할 수 있습니다. FMA를 무조건 끄는 것이 항상 정답은 아닙니다. 한 플랫폼에 맞춘 단일 실행을 만들 것인지, 여러 플랫폼에서 같은 replay를 만들 것인지, 아니면 오차 허용형 동기화로 설계할 것인지 목표를 먼저 정해야 합니다. fast-math를 켜고 나중에 hash를 맞추려는 접근은 허용한 변환 자체가 계약을 무너뜨릴 수 있습니다.

```diagram
{"title":"작은 수치 차이가 상태 분기로 커집니다","caption":"같은 입력도 연산 경로의 반올림 지점이 다르면 threshold에서 다른 branch를 선택할 수 있습니다.","rows":[[{"id":"expr","label":"(a × b) + c","detail":["같은 source 식"]}],[{"id":"round2","label":"두 번 반올림","detail":["mul → add"]},{"id":"round1","label":"FMA 한 번","detail":["fused 결과"]}],[{"id":"branch","label":"threshold branch","detail":["+ε 또는 -ε"]}],[{"id":"state","label":"상태 divergence","detail":["다음 tick 입력도 달라짐"]}]],"edges":[{"from":"expr","to":"round2","label":"분리 연산"},{"from":"expr","to":"round1","label":"contraction"},{"from":"round2","to":"branch","label":"반올림 결과"},{"from":"round1","to":"branch","label":"반올림 결과"},{"from":"branch","to":"state","label":"규칙 경로 변경"}]}
```

## 연산 순서와 Reduction Tree

부동소수점 덧셈은 정확한 실수 덧셈처럼 결합법칙이 보장되지 않습니다. `((a+b)+c)`와 `(a+(b+c))`의 중간 반올림이 다르기 때문입니다. entity 피해를 순회하며 합산하는 코드에서 ID 순서, archetype chunk 순서, hash map 순서가 바뀌면 합계가 달라질 수 있습니다. 병렬 reduction은 thread별 partial sum을 어떤 tree로 합치는지에 따라 더 달라집니다. 정렬을 한 번 넣어도 시스템 간 실행 순서와 RNG 소비가 고정되지 않으면 전체 결정성은 끝나지 않습니다.

예를 들어 피해 `[1e8, 1, -1e8]`를 왼쪽부터 더하면 작은 `1`이 사라질 수 있고, 먼저 `1 + (-1e8)`를 계산하는 순서에서는 다른 근사값이 남을 수 있습니다. 정확한 결과는 타입과 rounding에 의존하지만, 숫자의 크기 차이가 큰 합산이 순서에 민감하다는 것을 보여 주는 설명용 값입니다. 피해가 정수 damage라면 정수 누적이 단순한 해가 될 수 있습니다. 물리 impulse처럼 실수가 필요한 값은 stable ordering, pairwise reduction 또는 deterministic reduction tree를 명시하고 비용을 측정합니다.

## Fixed Tick·입력·난수의 범위

fixed tick은 매 simulation step에 같은 `dt`를 넣어 wall-clock jitter가 수식에 직접 들어오는 것을 막습니다. 그러나 input이 어느 tick에 귀속되는지, 늦은 input을 보류할지 rollback할지, catch-up을 몇 step까지 할지, timer 만료 순서를 어떻게 정할지까지 고정해야 합니다. lockstep에서는 입력이 도착하지 않으면 해당 frame 실행을 멈추는 방식이 설명되지만, 실제 제품의 네트워크 정책은 별도 설계입니다.

RNG를 전역으로 공유하면 worker 완료 순서나 entity 순서가 난수 소비량을 바꿉니다. seed 하나만 저장해서는 충분하지 않고 generator 알고리즘·version, stream 배정, 현재 state, 소비 순서를 기록해야 합니다. 작업 ID별 stream을 나누면 한 작업의 난수 추가가 다른 작업의 sequence를 흔드는 것을 줄일 수 있지만, 작업 ID 배정과 stream 초기화 역시 결정적이어야 합니다. 순수 계산 경계에 RNG state를 명시적으로 전달하는 원칙은 재현성에 유리하지만, 외부 효과의 중복 안전성을 보장하지는 않습니다.

## Canonical State와 Hash 관측점

상태 hash는 원인을 찾는 관측점이지 결정성을 만들어 주는 마법이 아닙니다. canonical serialization에서 entity ID, component 순서, 배열 정렬, endian, float bit 표현, 제외할 presentation-only 필드를 명시합니다. map iteration을 그대로 serialize하면 같은 논리 상태라도 순서가 달라져 hash가 달라질 수 있습니다. 반대로 hash에서 빠진 필드가 gameplay state라면 hash가 같아도 실제 결과가 다를 수 있습니다.

진단 흐름은 다음과 같습니다. tick, 입력 packet, 규칙/빌드 버전, RNG stream state를 기록합니다. 전체 hash가 tick 420에서 처음 달라지면 movement, combat, inventory, RNG처럼 subsystem별 canonical hash를 앞에서부터 비교합니다. movement hash가 tick 419에 달랐다면 entity별 위치·속도·입력·연산 branch를 더 좁힙니다. 최종 hash만 매 tick 남기면 첫 원인보다 훨씬 늦은 연쇄 오류만 보게 됩니다. hash collision 가능성도 있으므로 재현 조사에서는 문제가 된 entity의 원시 field와 first-difference trace를 함께 저장합니다.

## 정수화와 Fixed-Point 경계

돈, 점수, 탄약, 격자 좌표처럼 범위와 정밀도를 명확히 정할 수 있는 값은 정수화가 효과적입니다. 예를 들어 금액을 cents로 저장하면 `10.00 + 0.05`가 이진 float 표현에 흔들리지 않고, overflow 범위를 계산할 수 있습니다. fixed-point는 `raw = round(real * S)`처럼 scale을 정하는 방식이며, 곱셈은 `rawA * rawB / S`, 나눗셈은 rounding mode와 0 나누기 정책이 필요합니다. 중간 곱이 저장 타입을 넘지 않는지 먼저 확인해야 합니다.

거리·속도·회전·물리 solver 전체를 정수로 옮기는 것은 다른 문제입니다. scale을 올리면 정밀도가 좋아지지만 범위가 줄고, 낮추면 quantization error가 커집니다. 외부 physics library가 float를 반환하면 정수 경계 밖에서 다시 platform 차이가 생깁니다. display interpolation을 float로 유지하면서 권위 판정만 정수화하는 설계도 가능하지만, 어떤 component가 규칙 상태인지 문서화하지 않으면 render 값이 다시 판정으로 흘러갑니다.

예를 들어 위치는 millimeter 정수, 속도는 1/1000 단위 fixed-point, 시각은 tick 정수로 두고 충돌도 정수 경계에서 수행할 수 있습니다. 이 경우 `velocity * dt`의 scale과 음수 rounding을 명시해야 합니다. “fixed-point를 도입했으니 전체 simulation이 결정적”이라고 말할 수 없는 이유가 여기에 있습니다. 남은 float math, iteration order, thread scheduling, RNG와 serialization도 같은 계약에 포함됩니다.

## 플랫폼 고정과 허용 오차 모델

완전한 bitwise replay가 필요하면 실행 환경을 한 target ABI·compiler·ISA·math implementation으로 고정하고 빌드 artifact를 식별하는 방법이 현실적일 수 있습니다. cross-platform competitive lockstep가 목표면 정수화·결정적 math·stable scheduling을 넓혀야 하며 개발 비용이 커집니다. 화면 위치처럼 작은 차이를 허용할 수 있는 값은 epsilon 비교와 correction을 사용할 수 있지만, 이 모델은 bitwise 결정성과 다릅니다.

허용 오차를 둘 때도 분기와 판정은 조심해야 합니다. `abs(a-b)<ε`가 위치 표시에는 유효해도, 체력 0 여부·아이템 소유권·충돌 hit 같은 권위 규칙에 적용하면 양쪽이 서로 다른 상태를 허용할 수 있습니다. 권위 값과 presentation 값을 분리하고, correction이 언제 누구에게 적용되는지 정합니다. Gaffer의 글이 한 머신·같은 binary에서 입력과 frame-index seed로 일치를 회복한 사례를 보여 주더라도, 그것을 다른 compiler와 OS까지 보장하는 처방으로 확대하지 않습니다.

## 실패 사례와 검증 계획

실패 사례는 세 가지가 자주 겹칩니다. 첫째, fixed dt만 넣고 variable iteration order를 방치합니다. 둘째, 최종 hash가 다르다는 사실만 보고 마지막 tick의 system을 고치려 합니다. 셋째, 정수화한 score와 float physics를 하나의 “결정적 simulation”으로 포장합니다. 각각 입력 귀속·canonical order·경계별 계약을 분리해야 합니다.

검증은 동일 binary의 두 replay부터 시작합니다. 같은 input log와 seed를 두 번 실행해 tick별 전체 및 subsystem hash를 비교합니다. 다음으로 FMA on/off, debug/release, SIMD 유무, entity 순서, worker 수를 한 번에 하나씩 바꿔 first divergence tick을 찾습니다. 합산은 ID 정렬과 archetype 순서, serial과 deterministic reduction을 비교합니다. 수치 값과 입력·RNG·명령 buffer 길이를 같이 기록해야 hash 불일치가 데이터 문제인지 순서 문제인지 구분할 수 있습니다. 이 환경에서는 실제 게임 runtime을 실행하지 않았으므로 결과가 일치했다고 주장하지 않습니다.

## 비용·한계와 참고자료

canonical serialization과 subsystem hash는 CPU·메모리·로그 저장 비용이 듭니다. 모든 field를 매 tick dump하면 진단은 쉬워도 운영 비용이 커지므로, 평소에는 hash와 ring buffer를 두고 divergence가 감지된 구간만 상세 trace로 승격하는 방법을 사용합니다. deterministic reduction은 병렬성을 줄일 수 있고, 정수화는 범위·정밀도·외부 library 호환 비용을 만듭니다. 선택은 “결정성 100%”가 아니라 replay, rollback, 치팅 검출, 플랫폼 지원 중 무엇이 요구되는지로 정해야 합니다.

참고한 Gaffer On Games 글은 lockstep에서 같은 시작 조건·입력·시간 간격과 bit-identical 상태를 요구하고, compiler·OS·instruction set·실행 순서의 차이를 경고합니다. 글의 정확한 게시 버전은 입력에서 고정되지 않았고, 제시된 seed 처리 사례는 같은 machine·binary·OS 범위의 설명입니다. 특정 CPU의 FMA 결과, compiler flag, 게임 엔진의 hash 포맷은 확인하지 않았으므로 본문에서 성공 보장으로 표현하지 않았습니다.

### 참고 경로

- [https://gafferongames.com/post/deterministic_lockstep/](https://gafferongames.com/post/deterministic_lockstep/)

위 링크는 개념별 참고 경로이며, 본문에서 명시한 확인 범위와 미확인 구현 조건을 함께 적용합니다.
