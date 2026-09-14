---
id: "grpc-http-probe-auth-timeout"
title: "gRPC probe와 HTTP probe를 선택합니다. 인증·port·timeout·서비스별 상태의 지원을 무엇으로 확인하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","probe","헬스 체크","심화 질문"]
related: ["k8s-probe-contract","load-balancer-health-draining"]
promotedFrom: {"id":"k8s-probe-contract","prompt":"gRPC probe와 HTTP probe를 보안·타임아웃·실패 의미 기준으로 비교해 보세요."}
---

# gRPC probe와 HTTP probe를 선택합니다. 인증·port·timeout·서비스별 상태의 지원을 무엇으로 확인하나요?

## 구두 답변

probe가 사용할 포트·서비스 이름·TLS·인증·timeout의 지원 범위를 Kubernetes 버전과 endpoint 구현에서 확인합니다. 일반 client의 gRPC 설정이 probe에 그대로 지원된다고 가정하지 않습니다.

가벼운 전용 상태를 제공하고 liveness와 readiness 의미를 나눕니다. 긴 초기화는 startup으로 보호합니다. 인증 실패·연결 실패·실제 서비스 불가를 진단 가능하게 기록합니다.

## 득점 포인트

- probe가 사용할 포트·서비스 이름·TLS·인증·timeout의 지원 범위를 Kubernetes 버전과 endpoint 구현에서 확인합니다. 일반 client의 gRPC 설정이 probe에 그대로 지원된다고 가정하지 않습니다.
- 인증 실패·연결 실패·실제 서비스 불가를 진단 가능하게 기록합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: probe가 사용할 포트·서비스 이름·TLS·인증·timeout의 지원 범위를 Kubernetes 버전과 endpoint 구현에서 확인합니다.

## 더 파고들 거리

- [기본 상황과 비교: 초기화가 오래 걸리는 앱을 Kubernetes가 계속 재시작합니다. startup·readiness·liveness probe를 어떤 역할로 나눠야 하나요?](/tech-interview/questions/k8s-probe-contract/)
