---
id: raft-linearizable-read
title: "네트워크 단절 뒤에도 이전 Raft 리더가 읽기 요청을 받고 있습니다. 로컬 상태를 바로 반환해도 되며, 최신성을 보장하려면 무엇을 확인해야 하나요?"
answerMinutes: 5
followups: [{"id":"raft-log-commit-apply","prompt":"commit됐지만 apply되지 않은 로그가 있을 때 어디까지 기다려야 하나요?"},{"id":"consistency-linearizability","prompt":"선형화 읽기와 오래된 follower 읽기를 언제 나누나요?"},{"id":"raft-term-election","prompt":"term 변경 뒤 옛 leader 로컬 읽기가 안전하지 않은 이유는 무엇인가요?"}]
difficulty: 중하
category: 분산 시스템
tags: ["Raft","ReadIndex","선형화 가능성"]
related: ["raft-log-commit-apply","consistency-linearizability"]
---

# 네트워크 단절 뒤에도 이전 Raft 리더가 읽기 요청을 받고 있습니다. 로컬 상태를 바로 반환해도 되며, 최신성을 보장하려면 무엇을 확인해야 하나요?

## 구두 답변

고립된 이전 Raft 리더가 로컬 상태 머신을 바로 읽으면 선형화 가능성을 보장하지 못합니다. 새 리더가 더 최신 명령을 commit했어도 옛 리더는 모를 수 있습니다. 선형화 가능한 읽기는 호출과 응답 사이 한 시점에 실행된 것처럼 보이고 완료된 쓰기를 거스르지 않아야 합니다.

### 권위와 적용

ReadIndex 방식은 리더가 현재 term의 권위를 quorum과 확인하고 안전한 commit index를 얻은 뒤 state machine applied index가 그 위치 이상이 될 때 읽습니다. 복제 저장·commit·apply는 다른 상태입니다. 현재 term 엔트리 commit 규칙을 생략하고 heartbeat 하나면 충분하다고 하지 않습니다.

로그 기록 없는 ReadIndex는 비용 절충이고 lease read는 시계 오차·네트워크 가정을 추가합니다. 오래된 follower 읽기는 별도 계약으로 허용할 수 있지만 재고·권한은 권위 경로에서 재확인합니다. 검증은 옛 리더 격리, 새 leader commit 전후, apply 전후를 나눠 읽기 성공·timeout을 확인합니다.

### 리더 확인과 적용 대기

A가 term 4의 리더였지만 분할로 고립되고 B·C가 term 5에서 x=2를 커밋했다고 하겠습니다. A의 메모리에 x=1이 남아 있을 때 자신이 리더였다는 사실만으로 읽기를 성공시키면, x=2 성공 뒤 시작한 읽기가 1을 보아 선형화를 위반할 수 있습니다. 현재 term의 로그 항목을 커밋한 리더가 읽기 요청과 연결된 쿼럼 확인으로 권위를 확인하고 안전한 읽기 위치를 정해야 합니다. 오래전에 받은 heartbeat 응답을 새 읽기의 확인으로 재사용하지 않습니다.

안전한 read index가 100인데 상태 머신은 97까지만 적용했다면 리더 권위가 있어도 로컬 데이터는 충분하지 않습니다. applied index가 최소 100이 될 때까지 기다린 뒤 읽습니다. 확인 중 더 높은 term을 관찰하거나 쿼럼을 잃으면 결과를 성공으로 내보내지 않고 재시도 가능한 실패·대기로 처리합니다. 읽기 자체를 로그에 기록하는 방식도 가능하지만 비용이 더 들 수 있습니다.

### follower와 lease의 범위

follower도 리더에게 안전한 read index를 얻고 자신의 적용 위치가 따라잡은 뒤 읽는 경로를 구현할 수 있습니다. 아무 follower나 로컬 값을 즉시 읽는 stale read와는 다릅니다. 적용 지연이 크면 리더로 우회할지 deadline 안에서 기다릴지 결정하고, 모든 우회가 리더를 포화시키지 않게 제한합니다.

lease read는 유효한 리더 임대 기간 안에서 쿼럼 왕복을 줄일 수 있지만 클록 진행률·정지·선거 시간의 가정과 구현 증명이 필요합니다. 단조 시계를 쓴다는 사실만으로 분산 lease 안전성이 완성되지는 않습니다. 시계 가정을 피하려는 ReadIndex와 비용·실패 조건을 구분합니다.

시험은 리더 고립, 새 리더 쓰기 성공 뒤 옛 리더 읽기, 적용 루프 정지, 읽기 확인 응답 지연을 나눕니다. 호출·응답 이력과 term·read index·applied index를 남겨 완료된 쓰기를 이후 읽기가 거스르지 않는지 확인하겠습니다.

## 득점 포인트

- 옛 리더와 현재 권위를 구분한다.
- ReadIndex와 applied index를 함께 설명한다.
- lease 가정을 명시한다.
- 격리 단계 읽기를 검증한다.

## 감점 포인트

- leader 로컬 읽기가 항상 최신이다.
- commit과 apply를 같은 위치로 본다.
- heartbeat 하나로 보장한다.

## 더 파고들 거리

- follower ReadIndex
- current term commit
- 읽기 배치
