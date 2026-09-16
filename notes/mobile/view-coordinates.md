---
id: view-coordinates
title: UIView 좌표계와 변환된 경계 계산
topic: 모바일
summary: frame·bounds·center의 기준을 나누고 스크롤·회전·중첩 변환에서 convert와 축 정렬 경계를 사용하는 방법을 설명합니다.
questionIds: [ios-frame-bounds, rotated-view-axis-aligned-frame, nested-scroll-touch-conversion]
---

# UIView 좌표계와 변환된 경계 계산

## 같은 숫자라도 어느 뷰의 좌표인지가 다릅니다

변환이 없는 단순한 경우, 부모 좌표에서 자식이 `(20,30)`에 놓이고 크기가 `100×40`이면 자식의 `frame`은 `(20,30,100,40)`입니다. 자식 내부에서 그리는 영역은 보통 `bounds=(0,0,100,40)`이므로, `frame`의 첫 좌표쌍은 부모 기준 위치이고 `bounds`는 자기 내부의 기준과 크기를 나타냅니다. 따라서 같은 `100`이나 `(20,30)`을 보더라도 어느 뷰의 좌표인지 먼저 구분해야 합니다.

bounds.origin이 반드시 0일 필요는 없습니다. `(10,0)`으로 바꾸면 같은 내부 점을 보는 기준이 이동합니다. UIScrollView의 content offset도 이런 로컬 좌표 해석과 연결됩니다. 숫자를 그대로 비교하기 전에 각 값의 좌표 공간을 먼저 표시해야 합니다.

## 변환이 없을 때의 점 하나를 계산합니다

`frame=(20,30,100,40)`이고 `bounds.origin=(0,0)`이면 내부 점 `(5,7)`은 부모에서 `(20+5,30+7)=(25,37)`입니다. `bounds.origin=(10,0)`인 같은 배치에서는 부모의 `(20,37)`에 대응하는 내부 점이 `(10,7)`입니다. 즉 부모 점을 구할 때 단순히 frame 위치에 내부 좌표를 더하는 것이 아니라 bounds 원점까지 반영해야 하며, anchor·transform·중첩 스크롤이 들어가면 `convert`로 계산하는 편이 안전합니다.

| 값 | 기준 공간 | 대표 용도 |
| --- | --- | --- |
| frame | 변환 없는 경우 부모 좌표 | 자식 배치 결과 |
| bounds | 자기 좌표 | 내부 그리기·레이아웃 |
| center | 부모 좌표 | 중심 배치 |
| convert 결과 | 지정한 대상 좌표 | 터치·중첩 뷰·경계 비교 |

## 회전된 frame을 직접 수정하지 않습니다

UIView의 transform이 항등 변환이 아니면 UIKit 계약상 frame을 정의된 배치 값처럼 사용하지 않아야 합니다. 보이는 AABB처럼 보이는 숫자가 나온다는 이유로 읽어 다시 대입하면 기대한 회전·크기 관계를 깨뜨릴 수 있습니다. center·bounds·transform을 목적에 맞게 사용합니다.

```diagram
{"title":"자기 경계를 대상 좌표로 옮깁니다","caption":"화살표는 좌표 변환과 집계입니다. 네 모서리로 계산한 AABB는 분석용 경계이며 transform이 있는 UIView의 frame 속성을 안전하게 대입하는 규칙이 아닙니다.","rows":[[{"id":"bounds","label":"bounds의 네 모서리"}],[{"id":"convert","label":"대상 뷰 좌표로 convert","detail":["부모 이동 · 회전 · 스크롤"]}],[{"id":"box","label":"x·y 최소와 최대","detail":["축 정렬 경계 AABB"]}]],"edges":[{"from":"bounds","to":"convert","label":"각 점 변환"},{"from":"convert","to":"box","label":"최솟값·최댓값"}]}
```

## 45도 회전의 외접 상자를 구합니다

중심이 원점이고 폭 100, 높이 40인 사각형을 45도 회전한다고 합시다. 축 정렬 외접 폭은 `|100 cosθ|+|40 sinθ|`, 높이는 `|100 sinθ|+|40 cosθ|`이므로, θ=45도에서 `cosθ=sinθ≈0.7071`을 넣으면 두 값이 `100×0.7071+40×0.7071≈98.995`가 됩니다. 이 98.995는 회전한 도형을 감싸는 부모 좌표상의 상자 크기이고, 원래 사각형의 내부 `bounds` 높이 40이 99로 바뀐다는 뜻은 아닙니다.

```text
corners = [(bounds.minX,bounds.minY), (bounds.maxX,bounds.minY),
           (bounds.minX,bounds.maxY), (bounds.maxX,bounds.maxY)]
points = corners.map(point => convert_to_target_view(point))
box = (min(points.x), min(points.y),
       max(points.x)-min(points.x), max(points.y)-min(points.y))
```

외접 상자는 회전 사각형 밖의 빈 모서리 영역도 포함합니다. 정밀 hit test가 필요하면 AABB 포함만으로 실제 형상 내부라고 판정하지 않습니다. 역변환한 점을 원래 bounds에서 검사하는 등 목적에 맞는 기하를 사용합니다.

## 중첩 스크롤에서는 변환 API를 사용합니다

터치를 받은 뷰의 점을 자식에서 쓰려면 `convert(_:to:)` 또는 `convert(_:from:)`에 대상 뷰를 지정해 그 좌표 공간으로 변환합니다. 부모의 `frame`과 `contentOffset`을 차례로 더하는 방식은 `bounds.origin`·`zoom`·`transform` 중 하나를 빠뜨리기 쉬워 중첩 스크롤에서 틀린 점을 만들 수 있습니다. 변환을 적용하기 전에 두 뷰가 같은 윈도우·뷰 계층에서 지원되는 관계인지 확인합니다.

스크롤 위치가 바뀌어도 자식의 로컬 점 의미와 화면에 보이는 위치는 달라질 수 있습니다. 로그에는 숫자만 아니라 원본 뷰·대상 뷰·레이아웃 버전도 남기는 편이 진단에 도움이 됩니다.

## 레이아웃과 애니메이션의 측정 시점을 나눕니다

Auto Layout이 관리하는 frame은 제약 계산의 결과입니다. 수동 frame 수정이 다음 패스에서 다시 덮일 수 있으므로 제약을 바꾸고 적절한 레이아웃 완료 시점에 읽습니다. `layoutIfNeeded()`를 무조건 반복 호출하면 불필요한 계산 비용이 생길 수 있습니다.

애니메이션 중 모델 레이어의 목표값과 화면의 presentation 값은 다를 수 있습니다. 현재 보이는 위치를 추적하는지 최종 배치 상태를 읽는지 먼저 정해야 합니다. UIKit 화면 실험 없이 계산 예 하나로 모든 애니메이션·hit test 계약을 검증했다고 말하지 않습니다.

## 좌표 변환은 왕복과 경계로 확인합니다

항등 변환·90도·45도 회전, 음수 원점, 중첩 스크롤·확대, 레이아웃 전후를 비교합니다. 지원되는 가역 변환에서 점을 부모로 보냈다가 다시 원래 공간으로 돌렸을 때 허용 오차 안에 일치하는지 확인합니다. 특이 행렬처럼 역변환이 없는 경우도 별도 처리해야 합니다.

이 노트의 수치 예는 평면 기하 검산이며 실제 UIKit의 frame·convert·presentation 동작은 대상 iOS 버전에서 확인해야 합니다. 좌표 숫자를 고치는 것보다 공간과 시점의 계약을 맞추는 것이 먼저입니다.
