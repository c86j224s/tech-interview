---
id: "offline-client-snapshot-switch"
title: "오래 오프라인인 client가 이벤트 보관 범위를 벗어났습니다. snapshot과 증분 재생을 어떤 기준으로 전환하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["WebSocket","하트비트","재연결","심화 질문"]
related: ["websocket-heartbeat-reconnect","request-timeout-idempotency"]
promotedFrom: {"id":"websocket-heartbeat-reconnect","prompt":"오래 오프라인인 클라이언트의 이벤트 보관과 스냅샷 전환 기준은 무엇일까요?"}
---

# 오래 오프라인인 client가 이벤트 보관 범위를 벗어났습니다. snapshot과 증분 재생을 어떤 기준으로 전환하나요?

## 구두 답변

마지막 수신 위치가 서버의 보관 시작보다 오래되면 이벤트만 재생해 복구할 수 없습니다. 현재 snapshot과 그 기준 sequence 이후의 증분을 연결해 상태를 재구성합니다.

snapshot 전송 중 생긴 변경을 버퍼링·로그 위치로 보존하고 중복을 version으로 제거합니다. 기기별 cursor·권한·객체 세대를 관리합니다. 부분 snapshot·연결 중단·삭제·재시도를 시험합니다.

## 득점 포인트

- 마지막 수신 위치가 서버의 보관 시작보다 오래되면 이벤트만 재생해 복구할 수 없습니다. 현재 snapshot과 그 기준 sequence 이후의 증분을 연결해 상태를 재구성합니다.
- 부분 snapshot·연결 중단·삭제·재시도를 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 마지막 수신 위치가 서버의 보관 시작보다 오래되면 이벤트만 재생해 복구할 수 없습니다.

## 더 파고들 거리

- [기본 상황과 비교: WebSocket 하트비트로 연결 생존을 확인하고 재연결 뒤 누락·중복 메시지를 복구하려면 어떤 상태를 저장해야 하나요?](/tech-interview/questions/websocket-heartbeat-reconnect/)
