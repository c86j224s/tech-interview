---
id: "iocp-stop-packets-after-drain"
title: "IOCP worker마다 종료 패킷을 보내려 합니다. 미완료 I/O와 종료 패킷 소비 순서를 어떻게 맞추나요?"
difficulty: "중하"
category: "네트워크"
tags: ["IOCP","오류 처리","GQCS","심화 질문"]
related: ["iocp-gqcs-error-contract","iocp-completion-key-overlapped"]
promotedFrom: {"id":"iocp-gqcs-error-contract","prompt":"종료 패킷 수와 워커 수를 미완료 I/O drain 조건과 어떻게 맞출까요?"}
---

# IOCP worker마다 종료 패킷을 보내려 합니다. 미완료 I/O와 종료 패킷 소비 순서를 어떻게 맞추나요?

## 구두 답변

신규 제출을 막고 이미 등록된 I/O의 완료·취소를 모두 정리한 뒤 worker 종료 신호를 보내는 순서를 사용합니다. 종료 패킷을 먼저 소비해 worker가 사라지면 남은 I/O를 처리하지 못할 수 있습니다.

worker 수와 제어 패킷 규약, 깨어난 worker가 다른 신호를 가로채지 않는 정책을 확인합니다. timeout·즉시 실패·사용자 패킷·취소 완료를 포함해 실제 pending 집합이 비었는지 검사합니다.

## 득점 포인트

- 신규 제출을 막고 이미 등록된 I/O의 완료·취소를 모두 정리한 뒤 worker 종료 신호를 보내는 순서를 사용합니다. 종료 패킷을 먼저 소비해 worker가 사라지면 남은 I/O를 처리하지 못할 수 있습니다.
- timeout·즉시 실패·사용자 패킷·취소 완료를 포함해 실제 pending 집합이 비었는지 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 신규 제출을 막고 이미 등록된 I/O의 완료·취소를 모두 정리한 뒤 worker 종료 신호를 보내는 순서를 사용합니다.

## 더 파고들 거리

- [기본 상황과 비교: GetQueuedCompletionStatus가 FALSE를 반환했습니다. 실패한 I/O 완료를 받은 것인지, 타임아웃으로 아무 패킷도 못 받은 것인지 어떻게 구분하나요?](/tech-interview/questions/iocp-gqcs-error-contract/)
