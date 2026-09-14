---
id: "web-layout-shift-reserved-space"
title: "폰트와 이미지가 늦게 로딩되어 화면이 움직입니다. 공간 예약과 CLS 측정으로 무엇을 개선하나요?"
difficulty: "중하"
category: "웹"
tags: ["브라우저 렌더링","DOM","CSSOM","layout","성능","심화 질문"]
related: ["browser-rendering-layout","browser-url-navigation"]
promotedFrom: {"id":"browser-rendering-layout","prompt":"폰트·이미지 로딩과 누적 레이아웃 이동을 어떤 지표로 연결할까요?"}
---

# 폰트와 이미지가 늦게 로딩되어 화면이 움직입니다. 공간 예약과 CLS 측정으로 무엇을 개선하나요?

## 구두 답변

이미지의 크기·aspect ratio와 폰트 fallback의 metrics를 미리 맞추면 자료가 도착할 때 레이아웃 이동을 줄일 수 있습니다. CLS는 이동의 사용자 영향을 측정하는 지표이며 모든 위치 변화가 같은 방식으로 집계되는 것은 아닙니다.

광고·이미지·웹폰트·동적 콘텐츠를 실제 느린 네트워크에서 로딩하며 원인 요소를 추적합니다. 공간을 과하게 예약해 빈 화면을 만들지 않도록 반응형 크기를 검증합니다. 주요 콘텐츠 표시와 입력 지연도 함께 보고 CLS 하나를 개선해 전체 경험을 악화시키지 않습니다.

## 득점 포인트

- 이미지의 크기·aspect ratio와 폰트 fallback의 metrics를 미리 맞추면 자료가 도착할 때 레이아웃 이동을 줄일 수 있습니다. CLS는 이동의 사용자 영향을 측정하는 지표이며 모든 위치 변화가 같은 방식으로 집계되는 것은 아닙니다.
- 주요 콘텐츠 표시와 입력 지연도 함께 보고 CLS 하나를 개선해 전체 경험을 악화시키지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 이미지의 크기·aspect ratio와 폰트 fallback의 metrics를 미리 맞추면 자료가 도착할 때 레이아웃 이동을 줄일 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: DOM을 여러 번 바꾸는 화면에서 layout이 반복되어 느려집니다. 브라우저 렌더링 단계와 레이아웃 스래싱을 설명해 보세요.](/tech-interview/questions/browser-rendering-layout/)
