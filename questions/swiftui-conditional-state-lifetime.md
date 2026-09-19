---
id: swiftui-conditional-state-lifetime
title: 조건부 branch 전환 때 같은 모양의 View @State가 초기화될 수 있는 이유는 무엇인가요?
difficulty: 중하
category: 모바일
tags:
  - SwiftUI
  - identity
  - State
  - diffing
related:
  - ios-navigation-view-retention
---
# 조건부 branch 전환 때 같은 모양의 View @State가 초기화될 수 있는 이유는 무엇인가요?

## 구두 답변

SwiftUI는 같은 픽셀을 그리는지보다 view tree의 identity와 구조로 state storage를 연결합니다. `if editing { Editor() } else { Summary() }`처럼 branch가 바뀌면 두 view가 비슷한 모양이어도 서로 다른 구조로 취급되어 branch 내부 `@State`가 새로 초기화될 수 있습니다. 편집 초안을 보존해야 한다면 branch 내부 임시 state에 기대지 말고 공통 model owner가 초안을 보유해 두 branch에 binding으로 전달합니다.

반대로 모드 전환 때 입력을 비우는 것이 요구사항이면 reset을 의도적으로 기록할 수 있습니다. `.id(mode)`를 상위 container에 붙이는 방법은 subtree 전체 identity를 바꾸므로 한 field뿐 아니라 task, scroll position, animation까지 새로 시작할 수 있습니다. state를 보존할지 reset할지 먼저 정하고, reset이 필요해도 가장 작은 view 범위에만 ID를 적용합니다.

예를 들어 Editor의 draft가 `"초안"`인 상태에서 `editing=false`로 Summary를 보여 주었다가 다시 true로 전환하면, branch 내부 state는 새 Editor identity에서 빈 문자열로 시작할 수 있습니다. 보존이 필요하다면 `draft`를 상위 model에 두고 Editor와 Summary가 같은 값을 참조하게 해야 합니다. 저장 취소처럼 reset이 의도라면 버릴 세대를 명시적으로 증가시키고, 상위 전체 `.id()`를 바꾸는 대신 draft owner만 초기화하는 편이 부수 효과가 작습니다.
또한 branch 내부 state와 서버에 저장할 값은 같은 수명으로 취급하지 않습니다. 사용자가 편집을 취소할 때는 owner의 draft를 버리고, 화면이 잠깐 사라진 것뿐이라면 owner를 유지해 다시 진입했을 때 복원할 수 있게 합니다.
## 득점 포인트

- body 재계산, view 모양, tree identity, `@State` storage를 서로 구분합니다.
- 보존은 공통 owner와 binding, reset은 명시적 범위와 정책으로 구현합니다.
- 상위 `.id(mode)`의 subtree-wide 영향과 task 수명 비용을 말합니다.

## 감점 포인트

- body가 다시 계산될 때마다 모든 `@State`가 초기화된다고 합니다.
- 같은 타입과 레이아웃이면 조건부 branch가 항상 같은 state를 가진다고 단정합니다.
- `.id(UUID())`를 새로고침용으로 붙이면 state 손실과 중복 작업이 해결된다고 봅니다.

## 더 파고들 거리

- 편집 draft와 서버 snapshot을 분리해 branch 취소·저장·재진입을 처리하는 상태 모델을 작성해 보세요.
- 상위 view ID와 row ID의 차이를 초기화 범위·네트워크 task 수명 관점에서 비교해 보세요.
