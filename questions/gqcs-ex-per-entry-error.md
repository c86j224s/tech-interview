---
id: "gqcs-ex-per-entry-error"
title: "GetQueuedCompletionStatusEx가 여러 항목을 반환했습니다. 함수의 오류와 항목별 I/O 상태는 어떻게 나누어 해석하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["IOCP","오류 처리","GQCS","심화 질문"]
related: ["iocp-gqcs-error-contract","iocp-completion-key-overlapped"]
promotedFrom: {"id":"iocp-gqcs-error-contract","prompt":"GetQueuedCompletionStatusEx에서 항목별 오류와 마지막 오류 코드를 어떻게 분리할까요?"}
---

# GetQueuedCompletionStatusEx가 여러 항목을 반환했습니다. 함수의 오류와 항목별 I/O 상태는 어떻게 나누어 해석하나요?

## 구두 답변

함수 실패는 항목을 얻지 못한 timeout·API 오류일 수 있고 반환 항목은 각 작업 상태를 따로 가집니다. GQCSEx 성공과 모든 I/O 성공을 동일시하지 않습니다.

OVERLAPPED_ENTRY의 상태와 byte·포인터를 해당 API 계약에 맞게 해석합니다. GetLastError 하나를 모든 항목의 오류로 복사하지 않고 혼합 성공·실패 배치를 시험합니다.

## 득점 포인트

- 함수 실패는 항목을 얻지 못한 timeout·API 오류일 수 있고 반환 항목은 각 작업 상태를 따로 가집니다. GQCSEx 성공과 모든 I/O 성공을 동일시하지 않습니다.
- GetLastError 하나를 모든 항목의 오류로 복사하지 않고 혼합 성공·실패 배치를 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 함수 실패는 항목을 얻지 못한 timeout·API 오류일 수 있고 반환 항목은 각 작업 상태를 따로 가집니다.

## 더 파고들 거리

- [기본 상황과 비교: GetQueuedCompletionStatus가 FALSE를 반환했습니다. 실패한 I/O 완료를 받은 것인지, 타임아웃으로 아무 패킷도 못 받은 것인지 어떻게 구분하나요?](/tech-interview/questions/iocp-gqcs-error-contract/)
