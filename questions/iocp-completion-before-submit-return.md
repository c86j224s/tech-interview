---
id: "iocp-completion-before-submit-return"
title: "완료 worker가 WSARecv 호출 반환보다 먼저 실행됩니다. 작업 참조 획득과 제출 실패 rollback은 어떤 순서를 지켜야 하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["IOCP","중첩 I/O","즉시 완료","심화 질문"]
related: ["iocp-immediate-completion","io-readiness-vs-completion","iocp-completion-key-overlapped"]
promotedFrom: {"id":"iocp-immediate-completion","prompt":"완료 워커가 제출 함수 반환 전에 실행될 때 참조 획득 순서를 어떻게 증명할까요?"}
---

# 완료 worker가 WSARecv 호출 반환보다 먼저 실행됩니다. 작업 참조 획득과 제출 실패 rollback은 어떤 순서를 지켜야 하나요?

## 구두 답변

제출 전에 작업·연결 참조와 카운터를 확보해야 완료 worker가 먼저 실행돼도 유효합니다. 호출 뒤 증가시키면 완료가 먼저 감소·해제하는 경쟁이 생깁니다.

즉시 오류에 완료 패킷이 오지 않는 경우만 제출자가 예약을 되돌립니다. 즉시 성공 통지 생략 설정과 기본 모드를 명확히 나눕니다. 반환 전 완료·취소·종료 진입을 barrier로 재현해 한 번 정리되는지 검사합니다.

## 득점 포인트

- 제출 전에 작업·연결 참조와 카운터를 확보해야 완료 worker가 먼저 실행돼도 유효합니다. 호출 뒤 증가시키면 완료가 먼저 감소·해제하는 경쟁이 생깁니다.
- 반환 전 완료·취소·종료 진입을 barrier로 재현해 한 번 정리되는지 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 제출 전에 작업·연결 참조와 카운터를 확보해야 완료 worker가 먼저 실행돼도 유효합니다.

## 더 파고들 거리

- [기본 상황과 비교: WSARecv가 즉시 성공해서 버퍼를 정리했는데 IOCP 완료 패킷이 다시 왔습니다. 왜 이중 처리가 생기며 어떤 경로가 정리를 맡아야 하나요?](/tech-interview/questions/iocp-immediate-completion/)
