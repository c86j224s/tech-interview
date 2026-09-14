---
id: "multi-paxos-noop-gap"
title: "Multi-Paxos 로그의 중간 슬롯이 비었습니다. 언제 no-op을 제안하고 이전 수락값은 어떻게 보존하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Paxos","Multi-Paxos","리더","심화 질문"]
related: ["multi-paxos-leader","paxos-prepare-accept"]
promotedFrom: {"id":"multi-paxos-leader","prompt":"no-op"}
---

# Multi-Paxos 로그의 중간 슬롯이 비었습니다. 언제 no-op을 제안하고 이전 수락값은 어떻게 보존하나요?

## 구두 답변

새 리더가 prepare 응답으로 슬롯별 수락값을 확인한 뒤 아무 보존할 값이 없는 빈 슬롯에 no-op을 제안할 수 있습니다. 이미 수락된 값이 있으면 최고 ballot의 값을 이어받는 규칙이 먼저입니다.

슬롯을 그냥 건너뛰면 상태 머신의 순차 적용이 깨질 수 있습니다. no-op도 합의로 선택해야 하며 메모리에만 채우지 않습니다. 리더 변경·늦은 accept·빈 슬롯 복구를 시험합니다.

## 득점 포인트

- 새 리더가 prepare 응답으로 슬롯별 수락값을 확인한 뒤 아무 보존할 값이 없는 빈 슬롯에 no-op을 제안할 수 있습니다. 이미 수락된 값이 있으면 최고 ballot의 값을 이어받는 규칙이 먼저입니다.
- 리더 변경·늦은 accept·빈 슬롯 복구를 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 새 리더가 prepare 응답으로 슬롯별 수락값을 확인한 뒤 아무 보존할 값이 없는 빈 슬롯에 no-op을 제안할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Paxos로 명령 로그를 계속 기록하려고 합니다. Multi-Paxos는 반복 비용을 어떻게 줄이며 리더가 바뀌면 무엇을 이어받나요?](/tech-interview/questions/multi-paxos-leader/)
