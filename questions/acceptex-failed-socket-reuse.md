---
id: "acceptex-failed-socket-reuse"
title: "AcceptEx가 실패했습니다. 수락용 소켓을 재사용할지 새로 만들지 어떤 상태와 완료 수명을 확인하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["IOCP","AcceptEx","소켓","심화 질문"]
related: ["iocp-acceptex","iocp-completion-key-overlapped"]
promotedFrom: {"id":"iocp-acceptex","prompt":"AcceptEx 실패 뒤 소켓 재사용과 새 생성 중 어떤 조건을 비교해야 할까요?"}
---

# AcceptEx가 실패했습니다. 수락용 소켓을 재사용할지 새로 만들지 어떤 상태와 완료 수명을 확인하나요?

## 구두 답변

AcceptEx 실패의 원인·소켓 상태·지원 재사용 절차를 확인합니다. 단순히 실패했으니 같은 소켓과 OVERLAPPED를 즉시 다시 쓰면 이전 작업의 수명이 남아 충돌할 수 있습니다.

완료를 drain하고 필요한 close·새 생성·context 초기화를 수행합니다. 연결 취소·초기 데이터 지연·부족한 자원·즉시 오류를 나누어 시험하고 새 연결 세대에 옛 완료가 적용되지 않게 합니다.

## 득점 포인트

- AcceptEx 실패의 원인·소켓 상태·지원 재사용 절차를 확인합니다. 단순히 실패했으니 같은 소켓과 OVERLAPPED를 즉시 다시 쓰면 이전 작업의 수명이 남아 충돌할 수 있습니다.
- 연결 취소·초기 데이터 지연·부족한 자원·즉시 오류를 나누어 시험하고 새 연결 세대에 옛 완료가 적용되지 않게 합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: AcceptEx 실패의 원인·소켓 상태·지원 재사용 절차를 확인합니다.

## 더 파고들 거리

- [기본 상황과 비교: AcceptEx로 연결 수락을 미리 요청했습니다. 클라이언트는 연결됐는데 왜 완료가 늦을 수 있고, 완료 뒤 소켓은 어떻게 초기화하나요?](/tech-interview/questions/iocp-acceptex/)
