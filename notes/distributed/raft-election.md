---
id: raft-election
title: Raft Term·투표·로그 최신성의 선거 규칙
topic: 분산 시스템
summary: 논리 선거 세대와 내구 vote, last term/index 비교·AppendEntries 일치·고립 leader·timeout·pre-vote의 역할을 설명합니다.
questionIds: [raft-term-election, raft-log-freshness-term-index]
---

# Raft Term·투표·로그 최신성의 선거 규칙

## Term은 시간표가 아니라 선거 세대입니다

A가 term 4의 leader였지만 B·C가 term 5에서 새 leader를 선출한 뒤 A의 옛 메시지가 도착할 수 있습니다. term은 벽시계가 아니라 비교 가능한 논리 세대이며 정상 프로토콜에서 낮은 term 요청은 현재 권위를 덮지 못합니다. 높은 term을 관찰한 candidate·leader는 필요한 상태를 갱신하고 follower로 내려갑니다.

A가 고립되어 term 5를 아직 모르면 자신을 leader라고 생각할 수 있습니다. 하지만 현재 과반을 얻지 못하면 새 쓰기를 commit할 수 없습니다. 단순 역할 플래그가 아니라 quorum·로그 규칙이 충돌 확정을 막습니다.

## 투표 응답 전에 약속을 안정적으로 저장합니다

투표자는 한 term에서 한 후보에게만 표를 주도록 currentTerm·votedFor를 먼저 내구 저장한 뒤 vote 응답을 보냅니다. 예를 들어 응답을 먼저 보내고 저장 전에 죽으면 재시작 후 votedFor가 비어 있는 것처럼 보여 같은 term의 다른 후보에게도 표를 줄 수 있습니다. 그래서 저장 실패를 성공 응답으로 간주하지 않고, log 수락 응답에도 필요한 내구 기록을 같은 순서로 연결해야 합니다.

```text
on RequestVote(term, candidate, lastTerm, lastIndex):
    if term < currentTerm: reject
    if term > currentTerm: advance term and step down
    if already voted for another candidate in this term: reject
    if candidate log is not at least as up-to-date: reject
    durably record currentTerm and votedFor = candidate
    grant vote
```

이는 핵심 검사 순서의 교육용 요약입니다. 메시지 인증·멤버십·timer·동시 이벤트·저장 오류 등은 검증된 구현의 전체 규칙을 따라야 합니다. 이 코드만으로 Raft를 구현할 수 있다고 제시하지 않습니다.

## 마지막 Log Term을 먼저 비교합니다

| 후보 마지막 로그 | 투표자 마지막 로그 | 최신성 비교 |
| --- | --- | --- |
| term 5, index 10 | term 4, index 100 | 후보가 최신 |
| term 5, index 10 | term 5, index 12 | 후보가 뒤처짐 |
| term 5, index 12 | term 5, index 12 | 같은 최신성 |

단순 길이가 아니라 마지막 term을 먼저, 같을 때 index를 비교합니다. 더 많은 옛 term 제안이 최근 term의 로그보다 우선하지 않습니다. 이 규칙 하나만으로 전체 안전성이 생기는 것은 아니며 선거·log matching·현재 term commit 규칙이 함께 필요합니다.

```diagram
{"title":"투표는 후보의 최신성과 내구 약속을 함께 확인합니다","caption":"화살표는 투표 승인 조건입니다. 로그 길이만 크거나 term 숫자만 높다는 이유로 기존 투표·로그 검사를 생략하지 않습니다.","rows":[[{"id":"request","label":"RequestVote 수신"}],[{"id":"term","label":"현재 term·기존 vote 검사"}],[{"id":"log","label":"last log term → index 비교"}],[{"id":"persist","label":"term·vote 내구화"}],[{"id":"reply","label":"투표 승인 응답"}]],"edges":[{"from":"request","to":"term","label":"세대 확인"},{"from":"term","to":"log","label":"후보 자격"},{"from":"log","to":"persist","label":"기록 계승 조건"},{"from":"persist","to":"reply","label":"재시작 뒤도 기억"}]}
```

## AppendEntries도 이전 로그의 일치를 확인합니다

leader의 term이 맞아도 follower는 prevLogIndex·prevLogTerm으로 접두부가 이어지는지 확인합니다. 충돌하는 미커밋 suffix는 프로토콜에 따라 조정될 수 있지만 이미 commit된 entry를 임의로 덮는 것은 허용되지 않습니다. leader 변경 뒤 모든 follower의 log 끝이 즉시 같을 필요는 없지만 확정 접두부는 보존되어야 합니다.

snapshot으로 접두 로그가 압축되어도 lastIncludedIndex·term이 연결 기준으로 남습니다. 해당 index의 term을 기록하지 않고 길이만 맞추면 로그 일치 판단이 깨질 수 있습니다.

## Timeout은 죽음의 증명이 아닙니다

네트워크 RTT·디스크·GC·스케줄 지연 때문에 leader heartbeat를 늦게 받을 수 있습니다. 너무 짧은 election timeout은 불필요한 선거를 늘리고 너무 길면 실제 장애의 leader 공백을 길게 합니다. 무작위 timeout은 후보들의 동시 시작을 줄이며, pre-vote는 일부 구현에서 고립 노드 복귀의 불필요한 term 상승을 줄이는 보조 절차입니다.

pre-vote는 기본 Raft의 모든 배포에 같은 형태로 존재하는 기능이 아니므로 지원 규칙을 확인합니다. 선거 안정화를 위해 vote·로그 안전 규칙을 생략하지 않습니다.

## 늦은 메시지와 저장 실패를 분리해 검증합니다

vote 내구화 전후 재시작, 늦은 낮은 term AppendEntries, 같은 term의 다른 후보, 긴 옛 로그와 짧은 새 로그, 디스크 지연을 시험합니다. 한 term 이중 투표가 없고 과거 commit이 새 leader에 유지되는지 확인합니다. 현재 작업에서는 실제 Raft 구현·네트워크 장애 시험을 실행하지 않았습니다. 본문은 프로토콜 규칙의 학습 설명입니다.
