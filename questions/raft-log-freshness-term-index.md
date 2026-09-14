---
id: "raft-log-freshness-term-index"
title: "Raft 후보의 로그 길이가 더 긴데 투표를 못 받습니다. 마지막 log term과 index의 비교는 왜 그 순서인가요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Raft","선거","term","심화 질문"]
related: ["raft-term-election","consensus-vs-replication"]
promotedFrom: {"id":"raft-term-election","prompt":"log term/index"}
---

# Raft 후보의 로그 길이가 더 긴데 투표를 못 받습니다. 마지막 log term과 index의 비교는 왜 그 순서인가요?

## 구두 답변

후보의 마지막 log term을 먼저 비교하고 같을 때 index를 비교합니다. 더 긴 옛 term 로그보다 더 최근 term의 짧은 로그가 최신으로 판단될 수 있으며 전체 안전성은 선거·로그 일치·commit 규칙이 함께 만듭니다.

단순 길이 최대 후보를 고르지 않습니다. 투표 기록은 응답 전에 내구화하고 한 term 이중 투표를 막습니다. 부분 복제·리더 교체·재시작의 성공 로그 보존을 검증합니다.

## 득점 포인트

- 후보의 마지막 log term을 먼저 비교하고 같을 때 index를 비교합니다. 더 긴 옛 term 로그보다 더 최근 term의 짧은 로그가 최신으로 판단될 수 있으며 전체 안전성은 선거·로그 일치·commit 규칙이 함께 만듭니다.
- 부분 복제·리더 교체·재시작의 성공 로그 보존을 검증합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 후보의 마지막 log term을 먼저 비교하고 같을 때 index를 비교합니다.

## 더 파고들 거리

- [기본 상황과 비교: Raft 리더가 응답하지 않아 새 선거가 시작됐는데 이전 리더의 메시지가 뒤늦게 도착합니다. term과 투표 기록은 충돌을 어떻게 막으며 어떤 기록을 영속화해야 하나요?](/tech-interview/questions/raft-term-election/)
