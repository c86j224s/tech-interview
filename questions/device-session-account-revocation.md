---
id: "device-session-account-revocation"
title: "기기 하나의 로그아웃과 계정 전체 회수를 지원합니다. 세션 계열·버전·검증 상태를 어떻게 나누나요?"
difficulty: "중하"
category: "보안"
tags: ["JWT","세션","인증","심화 질문"]
related: ["jwt-vs-server-session","authentication-vs-authorization"]
promotedFrom: {"id":"jwt-vs-server-session","prompt":"여러 기기의 로그아웃과 전체 계정 회수를 어떤 상태 모델로 표현할까요?"}
---

# 기기 하나의 로그아웃과 계정 전체 회수를 지원합니다. 세션 계열·버전·검증 상태를 어떻게 나누나요?

## 구두 답변

기기별 session ID·refresh family와 계정 전체 revocation version을 분리합니다. 기기 하나 로그아웃은 그 family를, 계정 침해 대응은 전체 version을 바꾸는 방식으로 표현할 수 있습니다.

모든 검증 경로의 cache·replica·기존 연결이 회수를 반영하는지 확인합니다. access JWT의 만료만 쓰면 즉시 회수가 아닙니다. 재인증·새 기기·동시 refresh·늦은 토큰 응답을 시험합니다.

## 득점 포인트

- 기기별 session ID·refresh family와 계정 전체 revocation version을 분리합니다. 기기 하나 로그아웃은 그 family를, 계정 침해 대응은 전체 version을 바꾸는 방식으로 표현할 수 있습니다.
- 재인증·새 기기·동시 refresh·늦은 토큰 응답을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 기기별 session ID·refresh family와 계정 전체 revocation version을 분리합니다.

## 더 파고들 거리

- [기본 상황과 비교: 여러 서비스에서 로그인 상태를 확인하고 강제 로그아웃도 지원하려 합니다. JWT와 서버 세션은 어떤 기준으로 선택하나요?](/tech-interview/questions/jwt-vs-server-session/)
