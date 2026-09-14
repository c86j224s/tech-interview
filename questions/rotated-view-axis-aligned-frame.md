---
id: "rotated-view-axis-aligned-frame"
title: "뷰가 회전됐습니다. bounds의 모서리를 부모 좌표로 바꾸어 frame의 축 정렬 경계를 어떻게 계산하나요?"
difficulty: "중하"
category: "모바일"
tags: ["iOS","UIView","frame","bounds","좌표계","심화 질문"]
related: ["ios-frame-bounds"]
promotedFrom: {"id":"ios-frame-bounds","prompt":"회전된 bounds 네 모서리를 부모 좌표로 변환해 축 정렬 경계 상자를 계산해 보세요."}
---

# 뷰가 회전됐습니다. bounds의 모서리를 부모 좌표로 바꾸어 frame의 축 정렬 경계를 어떻게 계산하나요?

## 구두 답변

bounds의 네 모서리를 transform·좌표 변환으로 부모 공간에 보낸 뒤 x·y 최솟값과 최댓값으로 축 정렬 경계를 구할 수 있습니다. 회전된 실제 형상과 frame의 AABB는 다릅니다.

직접 frame을 바꾸는 의미는 transform·Auto Layout 조건에서 주의합니다. anchor·중첩 변환·음수 좌표·회전 각도를 포함해 convert 결과와 화면을 비교합니다.

## 득점 포인트

- bounds의 네 모서리를 transform·좌표 변환으로 부모 공간에 보낸 뒤 x·y 최솟값과 최댓값으로 축 정렬 경계를 구할 수 있습니다. 회전된 실제 형상과 frame의 AABB는 다릅니다.
- anchor·중첩 변환·음수 좌표·회전 각도를 포함해 convert 결과와 화면을 비교합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: bounds의 네 모서리를 transform·좌표 변환으로 부모 공간에 보낸 뒤 x·y 최솟값과 최댓값으로 축 정렬 경계를 구할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 서브뷰의 `frame`을 바꿨는데 예상 위치가 아니거나 회전 뒤 크기가 이상합니다. `frame`과 `bounds`를 어떤 좌표계에서 사용해야 하나요?](/tech-interview/questions/ios-frame-bounds/)
