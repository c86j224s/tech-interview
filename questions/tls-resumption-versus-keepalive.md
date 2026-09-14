---
id: "tls-resumption-versus-keepalive"
title: "HTTPS 재요청에서 연결 재사용과 TLS session resumption은 어떤 작업을 각각 생략하나요?"
difficulty: "중하"
category: "웹"
tags: ["브라우저","URL","DNS","TCP","TLS","심화 질문"]
related: ["browser-url-navigation","dns-cache-failover","tls-certificate-validation"]
promotedFrom: {"id":"browser-url-navigation","prompt":"TCP 연결 재사용과 TLS session resumption의 시간 절약을 어떻게 비교할까요?"}
---

# HTTPS 재요청에서 연결 재사용과 TLS session resumption은 어떤 작업을 각각 생략하나요?

## 구두 답변

keep-alive는 이미 열린 TCP·TLS 연결을 재사용해 새 연결 절차를 생략합니다. TLS resumption은 새 연결에서도 이전 세션 정보를 활용해 handshake 비용을 줄이는 것으로 TCP 연결 생성까지 자동 없애지는 않습니다.

세션 ticket·키·서버 지원·0-RTT 허용은 별도 계약입니다. 인증서 회전·만료·유휴 연결 종료·다른 backend를 시험하고 fresh·resumed·reused 연결의 지연을 분리합니다. resumption이 실패하면 정상 전체 handshake로 돌아가는 비용도 포함합니다.

## 득점 포인트

- keep-alive는 이미 열린 TCP·TLS 연결을 재사용해 새 연결 절차를 생략합니다. TLS resumption은 새 연결에서도 이전 세션 정보를 활용해 handshake 비용을 줄이는 것으로 TCP 연결 생성까지 자동 없애지는 않습니다.
- resumption이 실패하면 정상 전체 handshake로 돌아가는 비용도 포함합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: keep-alive는 이미 열린 TCP·TLS 연결을 재사용해 새 연결 절차를 생략합니다.

## 더 파고들 거리

- [기본 상황과 비교: 브라우저 주소창에 HTTPS 상품 페이지 주소를 입력했습니다. 이름 조회와 서버 연결부터 화면 표시까지 어떤 과정을 거치며, 캐시가 있으면 무엇이 생략될 수 있나요?](/tech-interview/questions/browser-url-navigation/)
