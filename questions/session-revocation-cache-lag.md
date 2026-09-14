---
id: "session-revocation-cache-lag"
title: "세션을 회수했지만 검증 캐시에 남아 접근이 됩니다. 허용 회수 지연과 캐시·실행 경계는 어떻게 정하나요?"
difficulty: "중하"
category: "보안"
tags: ["JWT","세션","인증","심화 질문"]
related: ["jwt-vs-server-session","authentication-vs-authorization"]
promotedFrom: {"id":"jwt-vs-server-session","prompt":"세션 상태 캐시가 권한 회수 지연을 만드는 조건을 어떻게 측정할까요?"}
---

# 세션을 회수했지만 검증 캐시에 남아 접근이 됩니다. 허용 회수 지연과 캐시·실행 경계는 어떻게 정하나요?

## 구두 답변

회수 상태를 cache하면 그 cache 수명만큼 옛 세션을 허용할 수 있습니다. 즉시 회수가 필요한 변경은 권위 조회·짧은 cache·push invalidation과 실패 정책을 조합하되 보장 범위를 명시합니다.

cache hit 경로·replica lag·기존 연결·토큰 만료를 함께 시험합니다. 짧은 access token은 지연 상한을 줄일 뿐 즉시 회수가 아닙니다. 권한 없음과 상태 조회 장애를 무조건 정상 허용으로 바꾸지 않습니다.

## 득점 포인트

- 회수 상태를 cache하면 그 cache 수명만큼 옛 세션을 허용할 수 있습니다. 즉시 회수가 필요한 변경은 권위 조회·짧은 cache·push invalidation과 실패 정책을 조합하되 보장 범위를 명시합니다.
- 권한 없음과 상태 조회 장애를 무조건 정상 허용으로 바꾸지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 회수 상태를 cache하면 그 cache 수명만큼 옛 세션을 허용할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 여러 서비스에서 로그인 상태를 확인하고 강제 로그아웃도 지원하려 합니다. JWT와 서버 세션은 어떤 기준으로 선택하나요?](/tech-interview/questions/jwt-vs-server-session/)
