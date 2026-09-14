---
id: "iocp-operation-counter-invariants"
title: "I/O 제출과 취소·완료가 겹칩니다. 작업별·연결별 참조 카운터를 어떤 순서로 증감해야 하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["IOCP","CancelIoEx","버퍼 수명","심화 질문"]
related: ["iocp-cancel-drain","deadline-cancellation-propagation","io-readiness-vs-completion"]
promotedFrom: {"id":"iocp-cancel-drain","prompt":"작업별·연결별 참조 카운터와 종료 상태 전이를 어떤 원자적 순서로 갱신할까요?"}
---

# I/O 제출과 취소·완료가 겹칩니다. 작업별·연결별 참조 카운터를 어떤 순서로 증감해야 하나요?

## 구두 답변

완료가 제출 반환 전에 올 수 있으므로 참조와 pending 카운터를 제출 전에 확보합니다. 즉시 실패로 완료 통지가 없다는 계약이면 실패 경로가 그 예약을 rollback합니다.

정상·취소 완료는 단일 정리 경로에서 한 번만 감소합니다. 연결 종료는 신규 제출 차단과 등록을 동기화하고 전역·연결 카운터 및 실제 작업 집합을 대조합니다.

## 득점 포인트

- 완료가 제출 반환 전에 올 수 있으므로 참조와 pending 카운터를 제출 전에 확보합니다. 즉시 실패로 완료 통지가 없다는 계약이면 실패 경로가 그 예약을 rollback합니다.
- 연결 종료는 신규 제출 차단과 등록을 동기화하고 전역·연결 카운터 및 실제 작업 집합을 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 완료가 제출 반환 전에 올 수 있으므로 참조와 pending 카운터를 제출 전에 확보합니다.

## 더 파고들 거리

- [기본 상황과 비교: 연결 종료를 위해 CancelIoEx를 호출했고 성공했습니다. 해당 OVERLAPPED와 수신 버퍼를 바로 풀에 반환해도 되나요?](/tech-interview/questions/iocp-cancel-drain/)
