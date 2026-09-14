---
id: dda-boundaries
title: Voxel DDA의 경계 시간과 Supercover
topic: 게임 서버
summary: step/tMax/tDelta의 실제 trace·0/음수 방향·정규화 거리·동점 cell 집합·면 위 ray·시작 경계·unloaded·부피 sweep과 방문 상한을 설명합니다.
questionIds: [voxel-raycast-dda, dda-supercover-corner-cells]
---

# Voxel DDA의 경계 시간과 Supercover

## 일정 거리 Sampling 대신 다음 Cell 경계로 갑니다

ray를 `p(t)=o+t*d`로 두고 현재 cell에서 x/y/z축의 다음 경계를 만나는 tMax를 계산합니다. 가장 작은 값을 가진 축으로 이동하고 해당 tMax에 tDelta를 더합니다. 셀 내부에 임의의 작은 step을 반복하는 방식과 다릅니다.

cell side s에서 방향 성분 d_i가 양수면 다음 경계는 `(cell_i+1)*s`, 음수면 `cell_i*s`입니다. `tMax_i=(boundary_i-o_i)/d_i`, `tDelta_i=s/abs(d_i)`를 사용합니다. d_i=0이면 step=0,tMax=tDelta=∞로 두고 나눗셈을 피합니다. ray 전체 방향이 0이면 별도 점 query로 처리합니다.

## 숫자 하나를 따라가 봅니다

2D 단면에서 s=1,o=(0.25,0.25),d=(1,0.5)라면 시작 cell=(0,0),tMaxX=.75,tMaxY=1.5,tDeltaX=1,tDeltaY=2입니다.

| 다음 t | 넘는 축 | 진입 cell | 다음 경계 |
| --- | --- | --- | --- |
| .75 | x | (1,0) | x=1.75,y=1.5 |
| 1.5 | y | (1,1) | x=1.75,y=3.5 |
| 1.75 | x | (2,1) | x=2.75,y=3.5 |

방향 d가 정규화되지 않았으므로 t 자체는 world distance가 아닙니다. 길이 L의 ray면 tEnd=L/|d| 또는 segment p0+t*(p1-p0),t∈[0,1]처럼 일관되게 정의합니다. 최대 방문 cell·시간/취소 budget도 둡니다.

```diagram
{"title":"축별 다음 경계 중 가장 이른 것을 선택합니다","caption":"화살표는 위 숫자 예제의 방문 순서입니다. 동점일 때의 추가 접촉 cell은 별도 경계 포함 정책으로 정합니다.","rows":[[{"id":"c00","label":"(0,0) · 시작"}],[{"id":"c10","label":"(1,0) · t=.75"}],[{"id":"c11","label":"(1,1) · t=1.5"}],[{"id":"c21","label":"(2,1) · t=1.75"}]],"edges":[{"from":"c00","to":"c10","label":"x 경계"},{"from":"c10","to":"c11","label":"y 경계"},{"from":"c11","to":"c21","label":"x 경계"}]}
```

## 모서리 동점에서는 어떤 Cell을 포함할지 먼저 정합니다

(0.5,0.5)에서 d=(1,1)로 가면 t=.5에 (1,1) 모서리를 만납니다. 양의 길이로 통과한 내부 cell만 세는 규칙은 (0,0)→(1,1)일 수 있습니다. 닿기만 한 모든 닫힌 cell을 포함하는 supercover는 (1,0),(0,1)도 포함합니다. 한 축을 tie-break로 먼저 처리하는 traversal은 일부 경계 cell만 추가할 수 있어 supercover 전체와 같지 않습니다.

3D 꼭짓점에서 세 축 동점이면 기존 cell과 함께 접촉하는 최대 7개 이웃 조합을 후보로 볼 수 있습니다. 단순 diagonal step만 하면 그 중 face/edge 접촉 cell을 놓칠 수 있습니다. 반대로 시야가 내부 통과만 막는 정책이면 전부 차단하는 것이 과도할 수 있습니다. 물리·시야의 접촉 의미를 분리합니다.

ray가 격자 면 위에 평행하게 놓인 경우는 tMax 동점 순간만 처리해서 충분하지 않습니다. 닫힌-cell supercover는 면 양쪽의 cell을 구간 내내 포함할 수 있습니다. 시작·끝 경계 포함·음수 방향 t=0 진입도 명시하고 고정점/오차 정책을 테스트합니다. 무작정 큰 epsilon은 불필요한 cell을 추가합니다.

## DDA의 Cell 후보는 실제 Shape 충돌이 아닙니다

복셀이 완전 고체 cube라면 첫 고체의 진입 경계가 판정에 직접 쓰일 수 있지만 부분 형상·재질·반경 있는 투사체는 좁은 형상 검사가 필요합니다. 중심선 supercover도 반경이 닿는 옆 cell까지 전부 포함하는 것은 아닙니다. 팽창된 금지 공간·이웃 확장·보수 swept 후보 뒤 정확한 TOI를 계산합니다.

미로딩 chunk는 empty로 반환하지 않고 보류/보수 차단을 사용합니다. 읽는 chunk version·수명을 유지하고 여러 후보의 같은 표면 접촉은 안정 ID·최소 t로 정리합니다. 방문 상한에 걸리면 “충돌 없음”이 아니라 제한/미완료를 반환합니다.

## 작은 기하 기준과 방문 집합을 대조합니다

축 평행·음수·시작 내부·면 위 ray·2축/3축 동점·끝점 경계·긴 ray·chunk 미로딩을 시험합니다. 작은 영역에서 ray와 각 닫힌 cell box의 교차 집합을 독립 계산하면 supercover 포함을 검사할 수 있습니다. 이 노트는 traversal 설계이며 모든 경계 정책의 완전한 3D 구현을 실행한 결과는 아닙니다.
