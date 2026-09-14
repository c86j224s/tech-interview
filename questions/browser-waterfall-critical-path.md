---
id: "browser-waterfall-critical-path"
title: "페이지 로딩 waterfall에 redirect·304·하위 자료가 섞여 있습니다. 실제 표시를 지연시키는 의존 경로를 어떻게 찾나요?"
difficulty: "중하"
category: "웹"
tags: ["브라우저","URL","DNS","TCP","TLS","심화 질문"]
related: ["browser-url-navigation","dns-cache-failover","tls-certificate-validation"]
promotedFrom: {"id":"browser-url-navigation","prompt":"redirect·조건부 캐시·서브리소스가 waterfall에 만드는 경계를 분석해 보세요."}
---

# 페이지 로딩 waterfall에 redirect·304·하위 자료가 섞여 있습니다. 실제 표시를 지연시키는 의존 경로를 어떻게 찾나요?

## 구두 답변

waterfall의 긴 막대만 보지 않고 HTML→CSS→폰트·이미지·스크립트의 의존 경로를 찾습니다. redirect와 조건부 요청도 왕복을 만들며 304는 본문 전송을 줄여도 네트워크 대기를 없애지 않습니다.

DNS·연결·TLS·서버 대기·본문 수신·렌더 차단을 구분하고 cold·warm 상태에서 비교합니다. 중요한 리소스 발견이 늦은지, 서버가 느린지에 따라 preload·캐시·API 개선의 처방이 달라집니다. 총 다운로드 완료와 사용자 주요 콘텐츠 표시를 같은 지표로 보지 않습니다.

## 득점 포인트

- waterfall의 긴 막대만 보지 않고 HTML→CSS→폰트·이미지·스크립트의 의존 경로를 찾습니다. redirect와 조건부 요청도 왕복을 만들며 304는 본문 전송을 줄여도 네트워크 대기를 없애지 않습니다.
- 총 다운로드 완료와 사용자 주요 콘텐츠 표시를 같은 지표로 보지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: waterfall의 긴 막대만 보지 않고 HTML→CSS→폰트·이미지·스크립트의 의존 경로를 찾습니다.

## 더 파고들 거리

- [기본 상황과 비교: 브라우저 주소창에 HTTPS 상품 페이지 주소를 입력했습니다. 이름 조회와 서버 연결부터 화면 표시까지 어떤 과정을 거치며, 캐시가 있으면 무엇이 생략될 수 있나요?](/tech-interview/questions/browser-url-navigation/)
