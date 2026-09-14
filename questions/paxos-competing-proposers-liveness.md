---
id: "paxos-competing-proposers-liveness"
title: "여러 Paxos proposer가 더 높은 ballot을 반복합니다. 안전성은 유지돼도 진행하지 못하는 이유와 완화책은 무엇인가요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Paxos","합의","ballot","심화 질문"]
related: ["paxos-prepare-accept","consensus-vs-replication"]
promotedFrom: {"id":"paxos-prepare-accept","prompt":"경쟁 proposer"}
---

# 여러 Paxos proposer가 더 높은 ballot을 반복합니다. 안전성은 유지돼도 진행하지 못하는 이유와 완화책은 무엇인가요?

## 구두 답변

서로 높은 ballot의 promise를 얻어 상대 accept를 막으면 안전한 값 보존은 유지하면서 진행이 지연될 수 있습니다. 안정 리더·backoff·경쟁 제한은 진행성을 돕습니다.

최고 기존 수락값을 이어받는 안전 규칙은 어떤 경우에도 생략하지 않습니다. 지연·동시 prepare·재시작을 시험하고 chosen·learned·응답을 따로 기록합니다. 모든 노드가 아니라 정한 quorum의 조건을 따릅니다.

## 득점 포인트

- 서로 높은 ballot의 promise를 얻어 상대 accept를 막으면 안전한 값 보존은 유지하면서 진행이 지연될 수 있습니다. 안정 리더·backoff·경쟁 제한은 진행성을 돕습니다.
- 모든 노드가 아니라 정한 quorum의 조건을 따릅니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 서로 높은 ballot의 promise를 얻어 상대 accept를 막으면 안전한 값 보존은 유지하면서 진행이 지연될 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Paxos에서 제안자가 응답을 받기 전에 멈추고 새 제안자가 시작했습니다. 이미 수락된 값과 충돌하지 않도록 prepare와 accept에서 무엇을 확인하고 기록하나요?](/tech-interview/questions/paxos-prepare-accept/)
