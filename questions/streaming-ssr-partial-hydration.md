---
id: "streaming-ssr-partial-hydration"
title: "스트리밍 SSR과 부분 hydration을 적용합니다. 콘텐츠 표시·상호작용·중간 오류의 경계는 어떻게 달라지나요?"
difficulty: "중하"
category: "웹"
tags: ["SSR","CSR","hydration","React","렌더링","심화 질문"]
related: ["ssr-csr-hydration","browser-rendering-layout"]
promotedFrom: {"id":"ssr-csr-hydration","prompt":"스트리밍 SSR·부분 hydration이 상호작용 경계와 오류 처리를 어떻게 바꿀까요?"}
---

# 스트리밍 SSR과 부분 hydration을 적용합니다. 콘텐츠 표시·상호작용·중간 오류의 경계는 어떻게 달라지나요?

## 구두 답변

스트리밍 SSR은 HTML 일부를 먼저 보내고 부분 hydration은 필요한 영역에만 client 실행을 붙이는 방식입니다. 표시된 영역과 상호작용 준비 영역이 달라질 수 있습니다.

서버·client 초기 데이터·time·random을 맞추고 중간 오류·로딩 상태·이벤트 중복을 처리합니다. 이미 보낸 헤더 뒤 오류 코드 변경이 어려울 수 있어 상태를 명시합니다. LCP·입력 지연·JS 비용을 함께 측정합니다.

## 득점 포인트

- 스트리밍 SSR은 HTML 일부를 먼저 보내고 부분 hydration은 필요한 영역에만 client 실행을 붙이는 방식입니다. 표시된 영역과 상호작용 준비 영역이 달라질 수 있습니다.
- LCP·입력 지연·JS 비용을 함께 측정합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 스트리밍 SSR은 HTML 일부를 먼저 보내고 부분 hydration은 필요한 영역에만 client 실행을 붙이는 방식입니다.

## 더 파고들 거리

- [기본 상황과 비교: 서버가 보낸 HTML은 바로 보이는데 버튼은 잠시 반응하지 않고 hydration 경고도 납니다. SSR·CSR·hydration은 각각 언제 실행되며 무엇을 확인해야 하나요?](/tech-interview/questions/ssr-csr-hydration/)
