---
id: ios-frame-bounds
title: "서브뷰의 `frame`을 바꿨는데 예상 위치가 아니거나 회전 뒤 크기가 이상합니다. `frame`과 `bounds`를 어떤 좌표계에서 사용해야 하나요?"
answerMinutes: 5
followups: [{"id":"ios-view-lifecycle","prompt":"Auto Layout 화면이 다시 나타날 때 frame을 읽어 데이터를 갱신하려면 어느 생명주기와 레이아웃 시점을 선택하고 왜 그래야 합니까?"},{"id":"path-smoothing-validation","prompt":"변환된 좌표로 경로 코너를 직선화했을 때 캐릭터 반경과 동적 장애물을 어떤 좌표계에서 다시 검사하겠습니까?"},{"id":"browser-rendering-layout","prompt":"DOM의 위치를 읽고 곧바로 스타일을 바꾸는 패턴이 반복 레이아웃을 만드는 과정은 iOS 레이아웃 측정과 어떻게 비교됩니까?"}]
difficulty: 하
category: 모바일
tags: ["iOS","UIView","frame","bounds","좌표계"]
related: []
---

# 서브뷰의 `frame`을 바꿨는데 예상 위치가 아니거나 회전 뒤 크기가 이상합니다. `frame`과 `bounds`를 어떤 좌표계에서 사용해야 하나요?

## 구두 답변

`frame`과 `bounds`는 둘 다 사각형처럼 보이지만 기준 좌표계와 책임이 다릅니다. `frame`은 변환이 없는 일반적인 경우 부모 뷰의 좌표계에서 자식의 위치와 크기를 나타내고, `bounds`는 뷰 자신의 좌표계에서 그릴 영역을 나타냅니다. 따라서 부모가 자식을 배치할 때는 자식의 frame을, 자식 내부 콘텐츠를 배치하거나 그릴 때는 자기 bounds를 기준으로 생각하겠습니다. 먼저 어느 뷰의 좌표인지, Auto Layout·transform·스크롤이 개입했는지 확인하지 않고 숫자만 고치면 위치 문제를 재현하기 어렵습니다.

### 좌표계와 bounds origin을 분리합니다

부모의 bounds가 `(0, 0, 300, 200)`이고 자식의 frame이 `(20, 30, 100, 40)`이라면 자식의 사각형은 부모 좌표에서 그 위치에 놓입니다. 반면 자식의 bounds는 자식 내부에서 그릴 영역이므로 보통 `(0, 0, 100, 40)`처럼 시작하지만 반드시 원점이 0인 것은 아닙니다. `bounds.origin`을 `(10, 0)`으로 바꾸면 자식 내부 좌표계가 이동해 같은 콘텐츠를 다른 부분에서 보게 됩니다. `UIScrollView`가 콘텐츠를 이동시키는 핵심도 콘텐츠의 frame을 매번 다시 배치하는 것이 아니라 bounds origin을 바꾸는 데 있습니다. 커스텀 뷰에서 bounds origin을 0으로 강제하면 스크롤, 확대, 내부 좌표 변환을 깨뜨릴 수 있습니다.

서로 다른 뷰 사이의 좌표를 비교해야 한다면 숫자를 직접 더하지 않고 `convert(_:to:)` 또는 `convert(_:from:)`으로 변환하겠습니다. 예를 들어 화면 좌표의 터치 지점을 뷰 내부 좌표로 바꾼 뒤 `bounds`와 비교해야 하며, 중첩된 부모의 위치나 스크롤 offset을 수동으로 합산하지 않습니다. 좌표계 사이를 명시적으로 변환하는 규칙을 두는 방식을 **좌표 공간 변환**(coordinate-space conversion)이라고 부릅니다.

### transform이 있으면 frame을 근거로 삼지 않습니다

회전·확대·기울임처럼 UIView의 `transform`이 항등 변환이 아니면 UIKit에서 `frame`은 정의되지 않은 값으로 취급해야 합니다. 화면에 보이는 경계 상자처럼 보인다는 이유로 그 값을 읽어 레이아웃하거나 다시 대입하면 회전 전후의 위치와 크기가 어긋날 수 있습니다. 이때는 `center`, `bounds`, `transform`을 각각 원하는 의미에 맞게 조정하고, 보이는 영역이 필요하면 bounds의 모서리나 원하는 사각형을 좌표 변환해 대상 좌표계에서 구하겠습니다. 변환된 네 모서리의 축 정렬 bounding box가 필요하다고 해서 변환된 뷰의 `frame`을 대체 근거로 사용하지 않는 것이 안전합니다.

Auto Layout이 제약을 관리하는 뷰라면 `frame`은 제약을 계산한 결과이지 지속적으로 덮어쓸 상태가 아닙니다. 제약을 바꾸고 레이아웃 패스가 끝난 뒤 `layoutIfNeeded()`나 적절한 레이아웃 콜백에서 결과를 관찰하겠습니다. 애니메이션 중에는 모델 레이어의 값과 실제 화면에 보이는 presentation layer가 다르므로, 측정 목적이 모델 상태인지 현재 표시 상태인지도 구분해야 합니다.

검증은 transform 없음·회전·스크롤·Auto Layout·중첩 컨테이너를 각각 재현해 `frame`, `bounds`, `center`, 변환된 점의 좌표를 로그로 비교하는 방식으로 하겠습니다. 결론은 `frame`이 항상 위치와 크기의 정답이라는 것이 아니라, 변환이 없는 부모-자식 배치에서만 그 의미가 직관적이며 transform이 있으면 `frame`이 정의되지 않는다는 조건까지 포함하는 것입니다.

## 득점 포인트

- frame은 부모 좌표계, bounds는 자기 좌표계라는 차이를 bounds origin과 UIScrollView 사례로 설명한다.
- transform이 있는 UIView의 frame을 정의된 값으로 취급하지 않고 center·bounds·transform과 convert를 사용한다.
- Auto Layout 결과와 애니메이션 presentation 상태를 수동 frame 변경과 구분해 측정 시점을 정한다.

## 감점 포인트

- frame과 bounds를 같은 좌표계의 위치·크기 값으로 설명한다.
- 모든 bounds origin이 항상 0이라고 단정해 스크롤과 커스텀 좌표계를 깨뜨린다.
- 회전된 뷰의 frame을 읽고 수정하면 표시 영역을 정확히 얻을 수 있다고 말한다.

## 더 파고들 거리

- 회전된 bounds 네 모서리를 부모 좌표로 변환해 축 정렬 경계 상자를 계산해 보세요.
- 중첩된 스크롤 뷰에서 터치 점을 로컬 좌표로 바꾸는 convert 호출을 구성해 보세요.
- Auto Layout 레이아웃 전후와 애니메이션 중 모델·presentation 값을 각각 측정해 보세요.
