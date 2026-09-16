---
id: raft-commit-read
title: Raft Commit·Apply·ReadIndex와 요청 결과
topic: 분산 시스템
summary: 로그 복제와 현재 term commit·결정적 apply를 분리하고 응답 유실 dedup·외부 outbox·고립 leader 읽기·follower 적용 대기를 설명합니다.
questionIds: [raft-log-commit-apply, raft-client-request-result-dedup, replicated-state-machine-outbox, raft-linearizable-read, raft-follower-readindex-wait]
---

# Raft Commit·Apply·ReadIndex와 요청 결과

## 디스크에 있는 마지막 로그까지 모두 확정된 것은 아닙니다

leader의 last index=105, commit index=100, applied index=97일 수 있습니다. 101~105는 아직 확정되지 않은 제안이고, 98~100은 확정됐지만 로컬 상태 머신에 아직 반영되지 않은 명령입니다. 저장·commit·apply의 차이를 지워 버리면 응답과 읽기 시점을 틀리게 잡습니다.

| 위치 | 의미 | 성공의 범위 |
| --- | --- | --- |
| log 저장 | 해당 노드가 entry 보유 | 리더 교체 뒤 확정 보존과 다름 |
| commit | 이후 리더가 보존해야 할 결정 | 로컬 결과 계산이 늦을 수 있음 |
| apply | 상태 머신에 순차 반영 | 외부 API 효과와 다름 |
| client 응답 | 호출자가 결과를 받음 | 응답 유실이면 호출자에게 불확정 |

## 현재 Term의 Entry를 기준으로 Commit을 전진시킵니다

일반 Raft에서 leader는 현재 term entry가 필요한 과반에 복제된 조건을 이용해 commit index를 전진시킵니다. 그 앞의 이전 term entry는 접두부로 함께 commit될 수 있습니다. 이전 term entry의 복제 수만 세어 직접 commit하는 단순 규칙은 리더 변경 시 안전성을 잃을 수 있습니다.

새 leader가 현재 term의 no-op을 commit하는 방식은 현재 term에서 이전 접두부의 확정 기준을 확보하는 데 쓰일 수 있습니다. 실제 프로토콜의 match index·현재 구성·저장 응답 규칙을 따라야 합니다. no-op을 로컬 메모리에 넣는 것만으로 commit되는 것은 아닙니다.

```diagram
{"title":"저장·확정·적용·응답의 경계를 나눕니다","caption":"화살표는 일반 상태 변경 결과 응답의 순서입니다. 단순 로그 접수 API는 다른 응답 계약을 가질 수 있지만 잔액·조건부 변경 결과에는 apply가 필요합니다.","rows":[[{"id":"replicate","label":"leader·follower 로그 저장"}],[{"id":"commit","label":"현재 term 규칙으로 commit"}],[{"id":"apply","label":"순차·결정적 state apply"}],[{"id":"reply","label":"요청별 실제 결과 응답"}]],"edges":[{"from":"replicate","to":"commit","label":"쿼럼·구성 조건"},{"from":"commit","to":"apply","label":"확정 접두부"},{"from":"apply","to":"reply","label":"업무 결과 생성"}]}
```

## Apply는 같은 명령에서 같은 상태를 만들어야 합니다

각 replica가 자기 현재 시각·난수·외부 API 결과를 apply 안에서 임의로 읽으면 로그가 같아도 결과가 다를 수 있습니다. 필요한 시각·난수 결과·외부 관측을 명령 데이터에 넣거나 검증된 결정적 규칙으로 처리합니다. 상태 변경과 논리 요청 ID별 결과 기록을 같은 적용 단위에 둡니다.

요청 R의 포인트 +10이 commit·apply됐지만 응답이 유실되면 R이 다른 log index에 다시 들어올 수 있습니다. 상태 머신은 R의 fingerprint·결과를 찾아 같은 입력이면 재사용하고 다른 입력이면 충돌로 거절합니다. 로그 위치가 다르다고 다른 사용자 요청이라는 뜻은 아닙니다. dedup 상태는 snapshot에도 포함하고 최대 재시도·client sequence 확인과 맞는 보관 규칙을 둡니다.

## 모든 Replica가 결제를 호출하면 외부 효과가 중복됩니다

apply마다 메일·결제를 직접 호출하면 replica 수·재시작 재생만큼 반복될 수 있습니다. leader만 호출해도 효과 성공 후 기록 전에 leader가 바뀌면 중복이 남습니다. 상태 머신은 내구 실행 의도·outbox를 기록하고 외부 worker가 안정된 효과 키·소유 세대·결과 조회로 수행하게 합니다.

합의된 의도와 외부 API 성공은 다른 확정 지점입니다. 외부 제공자가 멱등성을 지원하지 않으면 불확정 상태·대사·수동 복구가 필요할 수 있습니다. Raft가 그 경계까지 exactly-once로 바꾼다고 주장하지 않습니다.

## 고립된 옛 Leader의 로컬 읽기는 최신이 아닐 수 있습니다

A가 term 4에서 x=1을 적용한 뒤 고립되고 B·C가 term 5에서 x=2를 commit·apply했습니다. 그 성공 뒤 시작한 읽기를 A가 1로 반환하면 선형화 읽기를 위반할 수 있습니다. A의 로컬 leader 플래그나 옛 heartbeat만으로 현재 권위를 증명할 수 없습니다.

ReadIndex는 leader가 현재 term의 commit 기준을 확보한 뒤, 이번 읽기에 연결된 quorum 확인을 받아 자신이 아직 권위가 있는지 확인하고 read index를 정하는 방식입니다. 그 다음 로컬 state machine의 applied index가 read index 이상이 될 때까지 기다린 뒤 값을 읽습니다. 예를 들어 안전 index=100인데 apply=97이면 quorum 확인이 끝났어도 98~100의 적용을 기다려야 하며, 과거 heartbeat 하나를 재사용하는 것과는 다릅니다.

## Follower도 안전 위치와 로컬 Apply를 연결해야 합니다

follower는 현재 leader에서 그 읽기에 유효한 read index를 얻고 자신의 applied index가 그 이상인지 확인한 뒤 읽을 수 있습니다. log 수신·저장만 따라잡은 것은 상태 적용 완료가 아닙니다. leader 변경·높은 term·기한 초과·늦은 응답에 요청 문맥을 검증합니다.

stale follower read는 비용을 줄일 수 있지만 별도 API 계약으로 표시하고 재고·권한 확정에 그대로 사용하지 않습니다. lease read는 quorum 왕복을 줄이는 대신 시계 진행률·정지·선거·임대 불중첩의 추가 가정이 필요합니다. 단조 시계 하나로 분산 lease 안전성이 완성되지는 않습니다.

## 지연된 Apply와 응답 유실을 각각 시험합니다

복제 후 commit 전, commit 후 apply 전, apply 후 응답 전 중단을 나누어 상태·결과 ID를 확인합니다. 옛 leader 고립 뒤 새 leader 성공 쓰기와 읽기의 호출·응답 이력, follower apply 정지·read index 지연을 기록합니다. 현재 작업에서는 Raft cluster 실행·선형화 checker 검증을 수행하지 않았습니다. 본문은 프로토콜과 외부 효과의 설계 설명입니다.
