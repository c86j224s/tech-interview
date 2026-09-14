---
id: "http-strong-weak-etag"
title: "HTTP 응답의 바이트는 바뀌었지만 의미는 같습니다. strong·weak ETag를 재검증·범위 전송에 어떻게 구분하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["HTTP","캐시","Cache-Control","ETag","304","심화 질문"]
related: ["http-cache-validation","http-get-post-semantics","cache-aside-consistency"]
promotedFrom: {"id":"http-cache-validation","prompt":"강한 ETag와 약한 ETag를 표현 동일성·의미 동일성 요구에 어떻게 매핑할까요?"}
---

# HTTP 응답의 바이트는 바뀌었지만 의미는 같습니다. strong·weak ETag를 재검증·범위 전송에 어떻게 구분하나요?

## 구두 답변

strong ETag는 표현 바이트의 동일성 요구에, weak validator는 의미상 동등한 표현 재검증에 사용됩니다. W/ 표시는 같은 검증 규칙을 뜻하지 않습니다.

Range·If-Range와 If-Match 등 요청별 비교 계약을 확인합니다. gzip·언어별 표현에 올바른 validator를 제공하고 의미가 같다는 이유로 다른 파일 조각을 합치지 않습니다.

## 득점 포인트

- strong ETag는 표현 바이트의 동일성 요구에, weak validator는 의미상 동등한 표현 재검증에 사용됩니다. W/ 표시는 같은 검증 규칙을 뜻하지 않습니다.
- gzip·언어별 표현에 올바른 validator를 제공하고 의미가 같다는 이유로 다른 파일 조각을 합치지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: strong ETag는 표현 바이트의 동일성 요구에, weak validator는 의미상 동등한 표현 재검증에 사용됩니다.

## 더 파고들 거리

- [기본 상황과 비교: 개인정보가 포함된 HTTP 응답을 캐시하면서 최신 여부도 확인하려면 Cache-Control, ETag, 304를 어떻게 조합하나요?](/tech-interview/questions/http-cache-validation/)
