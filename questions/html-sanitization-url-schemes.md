---
id: "html-sanitization-url-schemes"
title: "일부 HTML 입력을 허용합니다. 태그만 제한하지 않고 URL scheme과 링크 속성도 검사해야 하는 이유는 무엇인가요?"
difficulty: "중하"
category: "보안"
tags: ["CSRF","XSS","쿠키","심화 질문"]
related: ["csrf-vs-xss","jwt-vs-server-session"]
promotedFrom: {"id":"csrf-vs-xss","prompt":"허용 HTML에서 URL scheme과 링크 속성을 제한해야 하는 이유는 무엇일까요?"}
---

# 일부 HTML 입력을 허용합니다. 태그만 제한하지 않고 URL scheme과 링크 속성도 검사해야 하는 이유는 무엇인가요?

## 구두 답변

허용 태그 안의 링크도 javascript 등 실행 가능한 scheme이나 외부 전송 목적지를 가질 수 있습니다. HTML 파서 기반의 검증된 sanitizer로 태그·속성·URL 의미를 함께 제한합니다.

문맥별 출력 인코딩과 안전한 DOM API를 유지하고 정규식 치환만으로 HTML 전체를 해석하지 않습니다. target·rel·이미지·스타일·SVG 지원 범위를 좁힙니다. sanitizer 결과를 다시 문자열 병합해 위험한 문법으로 바꾸는 후속 경로도 검사합니다.

## 득점 포인트

- 허용 태그 안의 링크도 javascript 등 실행 가능한 scheme이나 외부 전송 목적지를 가질 수 있습니다. HTML 파서 기반의 검증된 sanitizer로 태그·속성·URL 의미를 함께 제한합니다.
- sanitizer 결과를 다시 문자열 병합해 위험한 문법으로 바꾸는 후속 경로도 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 허용 태그 안의 링크도 javascript 등 실행 가능한 scheme이나 외부 전송 목적지를 가질 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 쿠키로 로그인 상태를 유지하는 웹 앱에서 요청 위조와 악성 스크립트 실행을 막으려 합니다. CSRF와 XSS의 공격 경로는 어떻게 다르며 쿠키 옵션만으로 충분한가요?](/tech-interview/questions/csrf-vs-xss/)
