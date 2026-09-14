---
id: "css-containment-content-visibility"
title: "긴 화면에서 화면 밖 영역의 렌더링 비용을 줄이려 합니다. contain과 content-visibility는 레이아웃·접근성에 어떤 영향을 주나요?"
difficulty: "중하"
category: "웹"
tags: ["브라우저 렌더링","DOM","CSSOM","layout","성능","심화 질문"]
related: ["browser-rendering-layout","browser-url-navigation"]
promotedFrom: {"id":"browser-rendering-layout","prompt":"contain과 content-visibility가 영향 범위와 초기 표시를 어떻게 바꾸는지 비교해 보세요."}
---

# 긴 화면에서 화면 밖 영역의 렌더링 비용을 줄이려 합니다. contain과 content-visibility는 레이아웃·접근성에 어떤 영향을 주나요?

## 구두 답변

contain은 레이아웃·페인트·크기 영향의 범위를 제한하고 content-visibility는 조건에 따라 하위 렌더링 작업을 건너뛸 수 있게 합니다. 어떤 containment가 적용되는지와 자리 크기를 어떻게 유지하는지 확인해야 합니다.

화면 밖 영역에 contain-intrinsic-size 등으로 적절한 공간을 제공하면 스크롤 점프를 줄일 수 있습니다. 무조건 숨겨 접근성 트리·검색·포커스를 깨지 않는지 실제 브라우저에서 확인합니다. 콘텐츠를 아직 렌더링하지 않아도 DOM·데이터·JS 비용이 모두 사라지는 것은 아닙니다.

## 득점 포인트

- contain은 레이아웃·페인트·크기 영향의 범위를 제한하고 content-visibility는 조건에 따라 하위 렌더링 작업을 건너뛸 수 있게 합니다. 어떤 containment가 적용되는지와 자리 크기를 어떻게 유지하는지 확인해야 합니다.
- 콘텐츠를 아직 렌더링하지 않아도 DOM·데이터·JS 비용이 모두 사라지는 것은 아닙니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: contain은 레이아웃·페인트·크기 영향의 범위를 제한하고 content-visibility는 조건에 따라 하위 렌더링 작업을 건너뛸 수 있게 합니다.

## 더 파고들 거리

- [기본 상황과 비교: DOM을 여러 번 바꾸는 화면에서 layout이 반복되어 느려집니다. 브라우저 렌더링 단계와 레이아웃 스래싱을 설명해 보세요.](/tech-interview/questions/browser-rendering-layout/)
