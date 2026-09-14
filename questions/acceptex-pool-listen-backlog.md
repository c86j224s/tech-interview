---
id: "acceptex-pool-listen-backlog"
title: "AcceptEx를 미리 제출하는 수와 listen backlog는 어떤 서로 다른 연결 대기를 다루나요?"
difficulty: "중하"
category: "네트워크"
tags: ["IOCP","AcceptEx","소켓","심화 질문"]
related: ["iocp-acceptex","iocp-completion-key-overlapped"]
promotedFrom: {"id":"iocp-acceptex","prompt":"AcceptEx 미리 제출 수와 listen backlog가 각각 어떤 단계의 대기를 제한할까요?"}
---

# AcceptEx를 미리 제출하는 수와 listen backlog는 어떤 서로 다른 연결 대기를 다루나요?

## 구두 답변

listen backlog는 커널의 연결 대기와 관련되고 미리 제출한 AcceptEx 수는 앱이 준비한 수락 작업·소켓·버퍼 수입니다. 둘을 같은 큐 크기로 계산하지 않습니다.

accept 이후 인증·초기 수신의 시간 상한도 둡니다. 미리 제출 수 증가가 처리 능력을 늘리지 않으므로 완료 지연·FD·메모리·연결 거절을 함께 측정합니다.

## 득점 포인트

- listen backlog는 커널의 연결 대기와 관련되고 미리 제출한 AcceptEx 수는 앱이 준비한 수락 작업·소켓·버퍼 수입니다. 둘을 같은 큐 크기로 계산하지 않습니다.
- 미리 제출 수 증가가 처리 능력을 늘리지 않으므로 완료 지연·FD·메모리·연결 거절을 함께 측정합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: listen backlog는 커널의 연결 대기와 관련되고 미리 제출한 AcceptEx 수는 앱이 준비한 수락 작업·소켓·버퍼 수입니다.

## 더 파고들 거리

- [기본 상황과 비교: AcceptEx로 연결 수락을 미리 요청했습니다. 클라이언트는 연결됐는데 왜 완료가 늦을 수 있고, 완료 뒤 소켓은 어떻게 초기화하나요?](/tech-interview/questions/iocp-acceptex/)
