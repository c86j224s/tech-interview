---
id: "windows-skip-success-completion"
title: "FILE_SKIP_COMPLETION_PORT_ON_SUCCESS를 적용합니다. 즉시 성공과 pending 완료의 정리 경로는 어떻게 달라지나요?"
difficulty: "중하"
category: "네트워크"
tags: ["IOCP","중첩 I/O","즉시 완료","심화 질문"]
related: ["iocp-immediate-completion","io-readiness-vs-completion","iocp-completion-key-overlapped"]
promotedFrom: {"id":"iocp-immediate-completion","prompt":"FILE_SKIP_COMPLETION_PORT_ON_SUCCESS를 적용할 수 있는 핸들·작업 조건은 무엇일까요?"}
---

# FILE_SKIP_COMPLETION_PORT_ON_SUCCESS를 적용합니다. 즉시 성공과 pending 완료의 정리 경로는 어떻게 달라지나요?

## 구두 답변

지원 핸들에서 skip-on-success를 활성화하면 즉시 성공 경로는 완료 포트 패킷 없이 직접 정리해야 할 수 있습니다. pending으로 접수된 작업은 나중 완료 경로를 유지합니다.

지원 조건과 설정 성공을 확인하고 기본 통지 모드와 섞지 않습니다. 즉시 오류·즉시 성공·pending 성공·취소를 모두 시험해 이중 정리와 누락을 막습니다.

## 득점 포인트

- 지원 핸들에서 skip-on-success를 활성화하면 즉시 성공 경로는 완료 포트 패킷 없이 직접 정리해야 할 수 있습니다. pending으로 접수된 작업은 나중 완료 경로를 유지합니다.
- 즉시 오류·즉시 성공·pending 성공·취소를 모두 시험해 이중 정리와 누락을 막습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 지원 핸들에서 skip-on-success를 활성화하면 즉시 성공 경로는 완료 포트 패킷 없이 직접 정리해야 할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: WSARecv가 즉시 성공해서 버퍼를 정리했는데 IOCP 완료 패킷이 다시 왔습니다. 왜 이중 처리가 생기며 어떤 경로가 정리를 맡아야 하나요?](/tech-interview/questions/iocp-immediate-completion/)
