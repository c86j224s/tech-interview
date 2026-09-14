---
id: "cors-safelisted-request-boundary"
title: "교차 출처 fetch 중 어떤 요청은 OPTIONS 없이 전송됩니다. safelisted 조건과 본 요청의 인가는 어떻게 다른가요?"
difficulty: "중하"
category: "웹"
tags: ["CORS","출처","OPTIONS","preflight","credentials","심화 질문"]
related: ["cors-preflight","csrf-vs-xss","authentication-vs-authorization"]
promotedFrom: {"id":"cors-preflight","prompt":"어떤 safelisted 조건을 벗어날 때 preflight가 생기는지 분류해 보세요."}
---

# 교차 출처 fetch 중 어떤 요청은 OPTIONS 없이 전송됩니다. safelisted 조건과 본 요청의 인가는 어떻게 다른가요?

## 구두 답변

safelisted 메서드·헤더·Content-Type 등의 조건을 만족하면 브라우저가 preflight 없이 실제 요청을 보낼 수 있습니다. 그러므로 OPTIONS가 없었다는 사실은 인증·CSRF 방어가 필요 없다는 뜻이 아닙니다.

서버는 모든 실제 요청에 인가·상태 변경 규칙을 적용하고 credential 정책과 응답 CORS 헤더를 맞춥니다. preflight는 브라우저의 접근 허용 절차이지 서버 간 호출을 차단하는 방화벽이 아닙니다. 정상·비허용 origin과 간단한 폼 요청을 함께 시험합니다.

## 득점 포인트

- safelisted 메서드·헤더·Content-Type 등의 조건을 만족하면 브라우저가 preflight 없이 실제 요청을 보낼 수 있습니다. 그러므로 OPTIONS가 없었다는 사실은 인증·CSRF 방어가 필요 없다는 뜻이 아닙니다.
- 정상·비허용 origin과 간단한 폼 요청을 함께 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: safelisted 메서드·헤더·Content-Type 등의 조건을 만족하면 브라우저가 preflight 없이 실제 요청을 보낼 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 웹 앱에서 다른 출처의 API에 요청했더니 OPTIONS가 먼저 전송되고 본 요청은 막힙니다. 브라우저는 무엇을 확인하며, 이 검사와 API 인증은 어떻게 다른가요?](/tech-interview/questions/cors-preflight/)
