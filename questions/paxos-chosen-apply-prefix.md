---
id: "paxos-chosen-apply-prefix"
title: "Paxos 슬롯 12가 11보다 먼저 선택됐습니다. chosen·learned·순차 apply는 어떻게 나누나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Paxos","Multi-Paxos","리더","심화 질문"]
related: ["multi-paxos-leader","paxos-prepare-accept"]
promotedFrom: {"id":"multi-paxos-leader","prompt":"pipeline 적용 순서"}
---

# Paxos 슬롯 12가 11보다 먼저 선택됐습니다. chosen·learned·순차 apply는 어떻게 나누나요?

## 구두 답변

chosen은 쿼럼이 값을 수락한 사실, learned는 관찰자가 그것을 안 상태, apply는 상태 머신 실행입니다. 뒤 슬롯이 먼저 chosen이어도 명령 의미가 순차라면 앞 접두부를 복구한 뒤 적용합니다.

빈 슬롯에는 prepare로 과거 수락을 확인한 뒤 안전하게 no-op이나 새 명령을 제안합니다. client 재시도와 외부 효과는 별도 dedup·outbox가 필요합니다. 선택·학습·응답 유실을 구분해 시험합니다.

## 득점 포인트

- chosen은 쿼럼이 값을 수락한 사실, learned는 관찰자가 그것을 안 상태, apply는 상태 머신 실행입니다. 뒤 슬롯이 먼저 chosen이어도 명령 의미가 순차라면 앞 접두부를 복구한 뒤 적용합니다.
- 선택·학습·응답 유실을 구분해 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: chosen은 쿼럼이 값을 수락한 사실, learned는 관찰자가 그것을 안 상태, apply는 상태 머신 실행입니다.

## 더 파고들 거리

- [기본 상황과 비교: Paxos로 명령 로그를 계속 기록하려고 합니다. Multi-Paxos는 반복 비용을 어떻게 줄이며 리더가 바뀌면 무엇을 이어받나요?](/tech-interview/questions/multi-paxos-leader/)
