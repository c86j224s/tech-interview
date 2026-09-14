---
id: "removed-consensus-node-rejoin"
title: "합의 구성에서 제거한 노드가 오래된 로그로 돌아왔습니다. 투표·메시지·재등록을 어떻게 처리해야 하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["합의","구성 변경","Raft","심화 질문"]
related: ["consensus-membership-change","consensus-quorum-failure"]
promotedFrom: {"id":"consensus-membership-change","prompt":"제거된 노드 메시지 처리"}
---

# 합의 구성에서 제거한 노드가 오래된 로그로 돌아왔습니다. 투표·메시지·재등록을 어떻게 처리해야 하나요?

## 구두 답변

제거된 노드가 돌아왔다고 자동 투표자나 쓰기 owner가 되어서는 안 됩니다. 현재 구성·노드 신원·term·로그를 검증하고 지원하는 재가입 절차에 따라 따라잡기와 승격을 분리합니다.

옛 노드가 높은 term을 계속 보내는 영향과 멤버십 검사·pre-vote 규칙은 구현별로 확인합니다. 로컬 디스크가 최신처럼 보여도 현재 구성의 결정을 독자적으로 확정할 수 없습니다. 강제 복구한 별도 클러스터와 재연결되면 원래 cluster ID와 fencing도 대조합니다.

## 득점 포인트

- 제거된 노드가 돌아왔다고 자동 투표자나 쓰기 owner가 되어서는 안 됩니다. 현재 구성·노드 신원·term·로그를 검증하고 지원하는 재가입 절차에 따라 따라잡기와 승격을 분리합니다.
- 강제 복구한 별도 클러스터와 재연결되면 원래 cluster ID와 fencing도 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 제거된 노드가 돌아왔다고 자동 투표자나 쓰기 owner가 되어서는 안 됩니다.

## 더 파고들 거리

- [기본 상황과 비교: 합의 클러스터의 노드를 교체하려고 합니다. 각 서버의 노드 목록만 새 목록으로 바꾸면 왜 위험한가요?](/tech-interview/questions/consensus-membership-change/)
