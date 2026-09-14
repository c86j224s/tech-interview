---
id: "refresh-token-multitab-serialization"
title: "브라우저 여러 탭이 같은 refresh token으로 동시에 갱신합니다. client 직렬화와 서버 회전 상태는 어떻게 나누나요?"
difficulty: "중하"
category: "보안"
tags: ["갱신 토큰","토큰 회전","세션","심화 질문"]
related: ["refresh-token-rotation","jwt-vs-server-session"]
promotedFrom: {"id":"refresh-token-rotation","prompt":"멀티 탭·멀티 기기의 갱신 직렬화 책임을 클라이언트와 서버에 어떻게 나눌까요?"}
---

# 브라우저 여러 탭이 같은 refresh token으로 동시에 갱신합니다. client 직렬화와 서버 회전 상태는 어떻게 나누나요?

## 구두 답변

client는 탭 간 공유 가능한 조정 수단으로 같은 family의 갱신을 합칠 수 있지만 탭 종료·메시지 유실 때문에 서버의 원자 회전 검사가 여전히 필요합니다. 기기별 family는 독립적으로 나눌 수 있습니다.

같은 token의 동시 정상 사용과 탈취 재생을 완벽히 구분할 수 있다고 하지 않습니다. 제한된 결과 재전달·유예·재인증과 위험 정책을 명시합니다. token 원문 cache의 수명·암호화·접근을 제한합니다.

## 득점 포인트

- client는 탭 간 공유 가능한 조정 수단으로 같은 family의 갱신을 합칠 수 있지만 탭 종료·메시지 유실 때문에 서버의 원자 회전 검사가 여전히 필요합니다. 기기별 family는 독립적으로 나눌 수 있습니다.
- token 원문 cache의 수명·암호화·접근을 제한합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: client는 탭 간 공유 가능한 조정 수단으로 같은 family의 갱신을 합칠 수 있지만 탭 종료·메시지 유실 때문에 서버의 원자 회전 검사가 여전히 필요합니다.

## 더 파고들 거리

- [기본 상황과 비교: 갱신 토큰을 회전시키는 서버가 정상 동시 갱신과 탈취 재사용을 어떻게 구분하고 차단하나요?](/tech-interview/questions/refresh-token-rotation/)
