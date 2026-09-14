---
id: "iocp-generation-not-memory-safety"
title: "OVERLAPPED 주소를 풀에서 재사용합니다. 세대 번호가 막는 논리 오류와 막지 못하는 해제 후 접근은 무엇인가요?"
difficulty: "중하"
category: "네트워크"
tags: ["IOCP","CancelIoEx","버퍼 수명","심화 질문"]
related: ["iocp-cancel-drain","deadline-cancellation-propagation","io-readiness-vs-completion"]
promotedFrom: {"id":"iocp-cancel-drain","prompt":"세대 번호나 작업 ID가 컨텍스트 주소 재사용을 어떻게 방지할까요?"}
---

# OVERLAPPED 주소를 풀에서 재사용합니다. 세대 번호가 막는 논리 오류와 막지 못하는 해제 후 접근은 무엇인가요?

## 구두 답변

세대 번호는 같은 주소가 다른 논리 작업으로 재사용됐는지 판정하는 데 도움되지만 이미 해제된 context를 읽는 행위를 안전하게 만들지 않습니다. 비교할 메모리 자체가 살아 있어야 합니다.

완료 참조를 유지하고 모든 I/O가 종료된 뒤 pool로 반환합니다. 재사용 세대·연결 ID를 결과에 묶어 옛 결과 적용을 거절합니다. 빠른 재사용·취소·지연 완료를 시험해 논리 오류와 use-after-free를 각각 확인합니다.

## 득점 포인트

- 세대 번호는 같은 주소가 다른 논리 작업으로 재사용됐는지 판정하는 데 도움되지만 이미 해제된 context를 읽는 행위를 안전하게 만들지 않습니다. 비교할 메모리 자체가 살아 있어야 합니다.
- 빠른 재사용·취소·지연 완료를 시험해 논리 오류와 use-after-free를 각각 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 세대 번호는 같은 주소가 다른 논리 작업으로 재사용됐는지 판정하는 데 도움되지만 이미 해제된 context를 읽는 행위를 안전하게 만들지 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: 연결 종료를 위해 CancelIoEx를 호출했고 성공했습니다. 해당 OVERLAPPED와 수신 버퍼를 바로 풀에 반환해도 되나요?](/tech-interview/questions/iocp-cancel-drain/)
