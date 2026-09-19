---
id: quaternion-rotation-interpolation-normalization
title: Quaternion 회전 보간·정규화
topic: 게임 서버
summary: 'Quaternion의 단위 제약, shortest-arc 선택, SLERP와 정규화 시점을 게임 회전 보간에 적용하는 제안입니다.'
questionIds: []
prerequisites:
  - simulation-budget
  - pure-state
related:
  - simulation-budget
  - pure-state
  - view-coordinates
reviewedAt: '2026-09-19'
---
# Quaternion 회전 보간·정규화

게임에서 quaternion은 회전을 저장하고 합성하는 수단이지, 숫자 네 개를 아무렇게나 선형 보간하는 벡터가 아닙니다. 회전으로 사용하려면 보통 단위 quaternion이어야 하고, `q`와 `-q`가 같은 3차원 회전을 나타내는 이중 표현을 가집니다. 이 두 성질을 놓치면 보간 중 긴 경로를 선택하거나, 누적 곱 뒤 회전 행렬에 scale 성분이 섞이는 문제가 생깁니다.

여기서 먼저 구분할 것이 있습니다. 권위 시뮬레이션에서 회전 상태를 갱신하는 것과 화면 렌더링에서 두 snapshot 사이 자세를 부드럽게 보이는 것은 같은 연산처럼 보여도 계약이 다릅니다. 권위 상태는 fixed tick, 입력 순서, 수치 재현성의 영향을 받고, 표시용 보간은 지연과 순간이동 처리의 영향을 받습니다. quaternion 수학의 일반 원리는 Shoemake의 1985년 논문과 맞닿아 있지만, 특정 엔진의 SIMD·normalize 빈도·epsilon 값은 해당 엔진 문서가 정해야 합니다.

## 단위 Quaternion과 회전의 이중 표현

quaternion을 `q=(w,x,y,z)`라 하고 norm²를 `w²+x²+y²+z²`라고 하겠습니다. 회전 quaternion은 이상적으로 norm²=1입니다. `q`와 `-q`는 모든 성분의 부호만 반대이지만 같은 회전 변환을 나타냅니다. 예를 들어 `q=(1,0,0,0)`과 `-q=(-1,0,0,0)`은 모두 항등 회전입니다. 따라서 두 quaternion의 숫자가 가까운지가 곧 두 자세의 회전 거리가 아닙니다.

두 orientation을 비교할 때 내적 `d=clamp(q0·q1,-1,1)`를 계산하고, 부호가 반대인 동일 회전 표현에서는 `d`가 -1에 가까울 수 있습니다. clamp 뒤 `d<0`이면 한쪽을 `-q1`로 바꾸어 같은 자세의 다른 표현을 선택합니다. 이 부호 변경은 자세를 반대로 뒤집는 행위가 아니라, 같은 회전 점을 4차원 단위 구면의 반대 표현으로 옮겨 경로를 짧게 고르는 작업입니다.

## SLERP의 각도와 매개변수

SLERP는 단위 구면 위의 두 점을 일정한 구면 각도 비율로 잇습니다. 부호 정렬과 clamp를 마친 정규화 quaternion에서 `d=cos(θ)`를 기준으로 구면 각 `θ`를 잡고, `t=0`이면 q0, `t=1`이면 q1에 도달하도록 `sin((1-t)θ)/sinθ`와 `sin(tθ)/sinθ` 비율을 사용합니다. `t`는 시간 그 자체가 아니라 두 key 사이의 정규화된 진행률입니다. 실제 시간 `u`를 쓰면 `(u-u0)/(u1-u0)`로 만들고, 구간 밖을 허용할지 clamp할지를 별도로 정합니다.

`d`가 음수일 때 sign correction을 하지 않고 SLERP하면 구면에서 긴 호를 선택할 수 있습니다. 시작과 끝이 거의 같은 자세인데 표현만 반대라면 중간에 180도에 가까운 경로가 생겨 화면이 크게 돌아가는 현상으로 보일 수 있습니다. 다만 “짧은 호”가 항상 게임 규칙상 정답인 것은 아닙니다. 포탑이 의도적으로 한 바퀴 도는 연출이나 회전 방향이 지정된 애니메이션에서는 누적 turn count와 별도 경로 정보를 보존해야 하며, quaternion 두 개만으로 그 의도를 복원할 수 없습니다.

```diagram
{"title":"Quaternion 보간은 표현 정렬 뒤 경로를 선택합니다","caption":"같은 회전의 부호 중복을 먼저 정리하고, 각도·매개변수에 따라 구면 또는 근사 경로를 택합니다.","rows":[[{"id":"inputs","label":"q0 · q1","detail":["단위 여부 · 내적"]}],[{"id":"sign","label":"부호 정렬","detail":["dot < 0이면 q1 ← -q1"]}],[{"id":"path","label":"SLERP 또는 NLERP","detail":["θ · t · 작은 각도"]}],[{"id":"unit","label":"단위 결과","detail":["normalize · norm² 검사"]}]],"edges":[{"from":"inputs","to":"sign","label":"같은 회전 표현"},{"from":"sign","to":"path","label":"짧은 호 선택"},{"from":"path","to":"unit","label":"결과 정규화"}]}
```

## 작은 각도의 NLERP 근사

`q(t)=normalize((1-t)q0+tq1)` 같은 normalized linear interpolation, 즉 NLERP는 SLERP의 삼각함수 비용을 줄이는 근사입니다. sign correction을 먼저 하고 마지막에 normalize해야 하며, 단순 lerp 결과를 그대로 회전으로 쓰면 norm이 1이 아닐 수 있습니다. 작은 각도에서는 두 경로의 시각적 차이가 작아 NLERP가 충분할 수 있지만, NLERP는 일반적으로 일정한 각속도(spherical constant speed)를 보장하지 않습니다.

예를 들어 두 자세의 상대 회전이 0.5도이고 `t=0.5`라면 NLERP와 SLERP의 중간 자세가 매우 가까울 가능성이 높습니다. 이 문장은 설명용 기하 판단이지 이 저장소에서 실행한 수치 benchmark가 아닙니다. 검증하려면 두 결과를 다시 상대 quaternion으로 만들고 각도 `2 arccos(|dot|)`를 계산해 최대 오차를 구합니다. 45도 이상처럼 간격이 커지거나, 카메라가 일정 각속도에 민감하거나, 회전이 물리 판정에 사용되면 SLERP를 유지하는 쪽이 안전합니다. 정확한 허용 각도는 프레임률·콘텐츠·오차 예산으로 정해야 합니다.

## 누적 곱과 정규화 시점

작은 delta rotation을 매 tick 현재 자세에 곱하는 방식은 이상적인 실수 연산에서 단위 조건을 보존합니다. 그러나 유한 정밀도에서는 곱셈마다 반올림이 들어가 norm²가 1에서 조금씩 벗어납니다. 고정된 z축 delta를 같은 곱 순서로 반복한 뒤 `q ← q / |q|`로 되돌리지 않으면 quaternion을 회전 행렬로 변환할 때 정규 직교 회전 행렬이 아니게 되어 길이 보존과 직교성이 깨질 수 있습니다. 정규화는 누적 drift를 제한하는 것이며, 잘못된 delta나 NaN을 고치는 만능 복구가 아닙니다.

실행 단위를 구체화하면 다음과 같습니다. tick 0에서 `q=(1,0,0,0)`, delta가 z축 1도 회전이라고 합시다. 고정된 z축 회전 delta를 같은 곱 순서로 90회 적용하면 이상적인 결과는 90도 회전입니다. 실제 구현에서는 local/world 곱 순서와 handedness를 먼저 고정해야 합니다. float 곱셈에서는 norm²가 `1±ε` 범위를 벗어날 수 있으므로 매 곱 뒤 또는 일정한 주기 뒤 검사합니다. 어떤 주기를 택할지는 성능과 허용 drift의 계약입니다. 권위 판정에 쓰는 상태는 매 tick 정규화해 예산을 단순하게 만들고, 표시 전용 보간은 입력 snapshot이 이미 단위인지 assertion으로 확인하는 방식이 설명하기 쉽습니다.

`norm²`가 0에 가깝거나 유한하지 않으면 나누지 않습니다. identity로 복구할지, 해당 entity를 invalid로 표시할지, snapshot을 다시 받을지는 시스템 정책입니다. 이 정책을 숨기면 한쪽 client만 identity로 복구하고 다른 쪽은 NaN을 전파해 replay가 갈라질 수 있습니다.

## Keyframe 연속성과 불연속 이벤트

애니메이션 keyframe `q0,q1,q2`를 독립적으로 저장하면 같은 자세의 부호가 프레임마다 바뀔 수 있습니다. 인접 key에서 `dot(prev,current)<0`이면 current 부호를 뒤집어 sign continuity를 만들면, 값이 같은데 화면이 길게 회전하는 가짜 경로를 줄일 수 있습니다. squad나 tangent 기반 곡선을 쓸 때는 control quaternion도 같은 연속성 기준으로 만들고, key 사이 시간 간격을 0으로 나누지 않도록 검사합니다. 곡선이 부드럽다는 이유로 모든 구간에 tangent를 적용하면 실제 순간이동을 완만한 회전으로 바꾸게 됩니다.

teleport, respawn, snap turn, 무기 교체처럼 회전의 불연속이 규칙인 경우에는 보간 금지 표식이나 event 경계를 snapshot에 넣습니다. `q0`와 `q1`의 각도가 큰 것을 모두 오류로 취급해서는 안 됩니다. 오히려 서버가 순간이동을 보냈는데 client가 오래된 snapshot과 새 snapshot을 일반 보간하면 벽을 통과하는 중간 방향이나 잘못된 조준 표시가 나올 수 있습니다. 보간은 관측을 부드럽게 만드는 도구이지 서버 상태의 물리 경로를 만들어 내는 도구가 아닙니다.

## 구현 경계와 선택 기준

권위 simulation에서 회전은 입력과 fixed dt로 업데이트하고, 충돌·조준 판정에 사용할 quaternion은 정규화 상태를 유지합니다. 화면 layer는 수신한 두 상태와 render time에 따라 SLERP 또는 NLERP를 선택하되, 각 snapshot의 sequence와 teleport flag를 확인합니다. 계산용 quaternion을 Euler 각도로 변환했다가 다시 quaternion으로 만드는 것을 매 tick 반복하면 축 순서와 wrap 경계가 추가되므로, UI 표시가 목적이 아니라면 원래 표현을 유지합니다.

작은 각도 branch에서는 `sinθ`가 너무 작아 SLERP 분모가 불안정할 수 있으므로 NLERP fallback을 사용합니다. 반대로 `d`를 부동소수점 오차로 1보다 약간 크게 얻으면 acos domain을 clamp해야 합니다. clamp는 입력이 유한하고 norm이 유효하다는 검증 뒤에 해야 합니다. SIMD implementation을 사용할 때도 lane 순서와 reciprocal approximation이 권위 replay 계약에 영향을 주는지 확인하며, 렌더 전용이라면 시각 오차 기준으로 분리합니다.

## 실패 사례와 검증

가장 흔한 실패는 `q`와 `-q`를 다른 자세라고 생각해 부호가 번갈아 나타나는 key를 그대로 보간하는 것입니다. 다음은 보간한 quaternion을 normalize하지 않는 경우이고, 그다음은 `t`를 실제 초 단위로 전달해 0~1 범위를 벗기는 경우입니다. 또 다른 실패는 SLERP가 모든 회전 의도를 보존한다고 믿는 것입니다. 두 endpoint만으로는 clockwise와 counter-clockwise 중 어떤 긴 경로를 의도했는지 알 수 없습니다.

검증은 항등·동일자세의 부호 반대·작은 각도·180도 근처·NaN/zero norm·teleport flag를 분리해 수행합니다. 각 결과의 norm², endpoint 오차, `t=0.5` 상대각, 시간에 따른 각속도, sign correction 발생 횟수를 기록합니다. 누적 곱 테스트는 1도 delta를 90번과 360번 적용하고 identity와의 상대각을 비교합니다. 이 환경에서는 특정 게임 엔진 코드와 SIMD를 실행하지 않았으므로 성공 수치를 주장하지 않고, 위 항목을 구현별 테스트 기준으로 제시합니다.

## 비용·한계와 참고자료

SLERP의 삼각함수와 분모 계산은 NLERP보다 비쌉니다. 그러나 회전이 표시 전용이고 각도가 작다면 NLERP의 비용 절감이 의미 있을 수 있습니다. 정규화를 매 tick 하면 나눗셈 비용과 branch가 생기지만, 권위 상태의 drift를 추적하는 비용보다 예측 가능성이 높을 수 있습니다. 어느 값이 판정에 들어가는지와 render-only 값인지 먼저 표시하지 않으면 성능 최적화가 결정성 문제로 번집니다.

Shoemake의 SIGGRAPH 1985 논문은 quaternion 곡선과 구면 보간의 고전적 근거입니다. 제공된 DOI는 이 환경에서 ACM 본문이 403으로 막혀 전문을 직접 확인하지 못했으므로, 논문에서 특정 구현 세부값을 인용하지 않습니다. Unity·Swift·기타 엔진의 normalize 정책이나 SIMD 결과는 입력 자료에 근거가 없으며 미확정입니다. 이 글은 단위 quaternion, 부호 중복, 구면 보간이라는 기하 원리와 구현 검증 경계를 중심으로 합니다.

### 참고 경로

- [https://doi.org/10.1145/325334.325242](https://doi.org/10.1145/325334.325242)

위 링크는 개념별 참고 경로이며, 본문에서 명시한 확인 범위와 미확인 구현 조건을 함께 적용합니다.
