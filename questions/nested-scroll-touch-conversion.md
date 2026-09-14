---
id: "nested-scroll-touch-conversion"
title: "중첩 스크롤 뷰의 터치 좌표를 자식 로컬 좌표로 바꿉니다. content offset·transform을 어떻게 반영하나요?"
difficulty: "중하"
category: "모바일"
tags: ["iOS","UIView","frame","bounds","좌표계","심화 질문"]
related: ["ios-frame-bounds"]
promotedFrom: {"id":"ios-frame-bounds","prompt":"중첩된 스크롤 뷰에서 터치 점을 로컬 좌표로 바꾸는 convert 호출을 구성해 보세요."}
---

# 중첩 스크롤 뷰의 터치 좌표를 자식 로컬 좌표로 바꿉니다. content offset·transform을 어떻게 반영하나요?

## 구두 답변

프레임 값을 수동으로 더하기보다 UIKit의 convert API 등 좌표 변환 계약을 이용해 현재 view hierarchy·bounds origin·transform을 반영합니다. contentOffset 변화는 로컬 좌표 해석에 영향을 줍니다.

중첩 스크롤·확대·회전·레이아웃 전후를 시험합니다. 화면에 보이는 애니메이션 위치와 model 좌표는 다를 수 있어 hit test 목적에 맞는 기준을 선택합니다. 같은 숫자가 다른 좌표 공간이면 직접 비교하지 않습니다.

## 득점 포인트

- 프레임 값을 수동으로 더하기보다 UIKit의 convert API 등 좌표 변환 계약을 이용해 현재 view hierarchy·bounds origin·transform을 반영합니다. contentOffset 변화는 로컬 좌표 해석에 영향을 줍니다.
- 같은 숫자가 다른 좌표 공간이면 직접 비교하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 프레임 값을 수동으로 더하기보다 UIKit의 convert API 등 좌표 변환 계약을 이용해 현재 view hierarchy·bounds origin·transform을 반영합니다.

## 더 파고들 거리

- [기본 상황과 비교: 서브뷰의 `frame`을 바꿨는데 예상 위치가 아니거나 회전 뒤 크기가 이상합니다. `frame`과 `bounds`를 어떤 좌표계에서 사용해야 하나요?](/tech-interview/questions/ios-frame-bounds/)
