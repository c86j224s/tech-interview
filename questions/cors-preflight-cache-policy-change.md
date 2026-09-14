---
id: "cors-preflight-cache-policy-change"
title: "CORS 정책을 바꿨지만 브라우저에 이전 preflight 허용이 남아 있습니다. 실제 요청의 안전성을 어떻게 유지하나요?"
difficulty: "중하"
category: "웹"
tags: ["CORS","출처","OPTIONS","preflight","credentials","심화 질문"]
related: ["cors-preflight","csrf-vs-xss","authentication-vs-authorization"]
promotedFrom: {"id":"cors-preflight","prompt":"preflight cache가 정책 변경 뒤 남아 있는 동안 안전하게 전환하는 방법은 무엇일까요?"}
---

# CORS 정책을 바꿨지만 브라우저에 이전 preflight 허용이 남아 있습니다. 실제 요청의 안전성을 어떻게 유지하나요?

## 구두 답변

preflight cache는 브라우저가 실제 요청을 보낼지에 영향을 주지만 서버의 현재 인가를 대신하지 않습니다. 이전 허용으로 요청이 도착해도 원본 API는 새 권한과 상태 규칙을 적용해야 합니다.

정책 전환 중 정상 client가 얼마나 오래 이전 허용을 사용하는지 max-age·구현을 확인합니다. 응답 노출의 CORS 설정과 변경 자체의 CSRF·인가를 구분합니다. OPTIONS만 차단하고 실제 endpoint를 느슨하게 두는 설계는 사용하지 않습니다.

## 득점 포인트

- preflight cache는 브라우저가 실제 요청을 보낼지에 영향을 주지만 서버의 현재 인가를 대신하지 않습니다. 이전 허용으로 요청이 도착해도 원본 API는 새 권한과 상태 규칙을 적용해야 합니다.
- OPTIONS만 차단하고 실제 endpoint를 느슨하게 두는 설계는 사용하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: preflight cache는 브라우저가 실제 요청을 보낼지에 영향을 주지만 서버의 현재 인가를 대신하지 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: 웹 앱에서 다른 출처의 API에 요청했더니 OPTIONS가 먼저 전송되고 본 요청은 막힙니다. 브라우저는 무엇을 확인하며, 이 검사와 API 인증은 어떻게 다른가요?](/tech-interview/questions/cors-preflight/)
