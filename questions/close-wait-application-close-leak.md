---
id: "close-wait-application-close-leak"
title: "CLOSE_WAIT가 계속 늘어납니다. 상대 FIN 수신 뒤 앱의 close 누락과 정상 짧은 대기를 어떻게 구분하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["TCP","TIME_WAIT","연결 수명","심화 질문"]
related: ["tcp-time-wait","tcp-stream-message-framing"]
promotedFrom: {"id":"tcp-time-wait","prompt":"CLOSE_WAIT 증가가 TIME_WAIT 증가와 다른 애플리케이션 경로를 어떻게 보여 줄까요?"}
---

# CLOSE_WAIT가 계속 늘어납니다. 상대 FIN 수신 뒤 앱의 close 누락과 정상 짧은 대기를 어떻게 구분하나요?

## 구두 답변

CLOSE_WAIT는 상대의 송신 종료를 받았지만 로컬 앱이 아직 close하지 않은 상태입니다. 잠시 있는 것은 정상일 수 있지만 계속 늘거나 처리 후에도 남으면 자원 정리 누락을 조사합니다.

요청·소켓 owner·예외·EOF 처리·다른 FD 참조를 추적합니다. TIME_WAIT는 정상 종료 후 프로토콜 보호 상태로 앱 FD 누수와 다릅니다. 강제 timeout만 줄여 원인을 숨기지 않습니다.

## 득점 포인트

- CLOSE_WAIT는 상대의 송신 종료를 받았지만 로컬 앱이 아직 close하지 않은 상태입니다. 잠시 있는 것은 정상일 수 있지만 계속 늘거나 처리 후에도 남으면 자원 정리 누락을 조사합니다.
- 강제 timeout만 줄여 원인을 숨기지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: CLOSE_WAIT는 상대의 송신 종료를 받았지만 로컬 앱이 아직 close하지 않은 상태입니다.

## 더 파고들 거리

- [기본 상황과 비교: TCP TIME_WAIT가 정상 종료 상태인 경우와 실제 연결·포트 고갈 문제를 어떻게 구분하고 개선하나요?](/tech-interview/questions/tcp-time-wait/)
