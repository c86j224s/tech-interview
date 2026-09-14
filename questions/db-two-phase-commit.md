---
id: "db-two-phase-commit"
title: "두 DB에 함께 반영해야 해서 2PC를 검토합니다. prepare와 commit 사이에 조정자가 죽으면 무엇이 남나요?"
answerMinutes: 5
followups: [{"id": "saga-compensation", "prompt": "이미 커밋한 여러 단계 중 뒤 단계가 실패하면 어떤 상태를 보상하고 무엇을 대사로 남기나요?"}, {"id": "consensus-vs-replication", "prompt": "사본을 보관하는 것과 장애 중 하나의 결정을 확정하는 것은 어떤 규칙이 다른가요?"}, {"id": "db-pool-long-transactions", "prompt": "쿼리는 짧은데 연결 보유가 길다면 어떤 대기를 transaction 밖으로 옮겨야 하나요?"}]
difficulty: "중하"
category: "분산 시스템"
tags: ["SQL", "분산 시스템"]
related: ["saga-compensation", "consensus-vs-replication", "db-pool-long-transactions"]
---

# 두 DB에 함께 반영해야 해서 2PC를 검토합니다. prepare와 commit 사이에 조정자가 죽으면 무엇이 남나요?

## 구두 답변

2PC는 참여자가 먼저 커밋할 준비를 내구 기록하고, 조정자의 최종 결정을 따라 commit 또는 abort하게 하는 원자적 커밋 절차입니다. 여러 저장소가 하나의 결과를 갖게 돕지만 장애 중 잠금·복구 대기와 운영 복잡성이 생깁니다.

### 동작 원리와 전제

prepare에 성공한 참여자는 이미 abort할 수 없다는 결정을 한 것이 아니라 최종 결정을 기다릴 준비를 한 것입니다. 조정자와 통신이 끊기면 임의로 commit하거나 rollback하면 다른 참여자와 어긋날 수 있어 in-doubt 상태와 자원이 남을 수 있습니다.

### 선택과 실패 처리

조정 로그와 참여자 기록을 복구하고 동일 transaction ID로 결정을 재전달해야 합니다. 제품의 장애 복구·timeout·heuristic 결정 정책을 확인합니다. 합의 복제된 조정자를 쓸 수 있어도 일반적인 2PC의 원자성 문제와 합의의 역할은 구분합니다.

### 구체적인 사례와 검증

참여자 A와 B가 모두 prepared가 된 뒤 조정자의 commit 결정이 A에만 도착할 수 있습니다. B가 timeout을 이유로 임의 abort하면 원자성이 깨집니다. B는 내구 결정 로그나 복구 프로토콜로 최종 결정을 알아야 합니다. 이 대기 동안 보유한 잠금이 다른 거래를 막을 수 있어 운영에서 in-doubt transaction을 식별·복구할 도구가 필요합니다. saga는 각 단계의 commit과 보상을 허용하므로 이 blocking 비용을 줄이는 대신 중간 상태를 노출합니다. 어느 쪽이 낫다는 일반론보다 원자 확정이 꼭 필요한지, 보상이 실제 가능한지, 장애 복구 시간을 감당할 수 있는지로 선택하겠습니다.

짧은 단일 DB transaction으로 경계를 합칠지, 예약·보상 가능한 saga로 바꿀지 비교합니다. saga는 부분 상태를 허용하는 다른 계약입니다. prepare 전후·최종 결정 기록·일부 commit 뒤 장애를 시험하고 잠금 보유·복구 시간과 실제 최종 상태를 확인합니다.

## 득점 포인트

- 핵심 구분: 2PC는 참여자가 먼저 커밋할 준비를 내구 기록하고, 조정자의 최종 결정을 따라 commit 또는 abort하게 하는 원자적 커밋 절차입니다.
- 선택 조건: 조정 로그와 참여자 기록을 복구하고 동일 transaction ID로 결정을 재전달해야 합니다.
- 검증 기준: 짧은 단일 DB transaction으로 경계를 합칠지, 예약·보상 가능한 saga로 바꿀지 비교합니다.

## 감점 포인트

- prepare 뒤 timeout이면 각 참여자가 마음대로 rollback해도 안전하다고 한다.

## 더 파고들 거리

- 이미 커밋한 여러 단계 중 뒤 단계가 실패하면 어떤 상태를 보상하고 무엇을 대사로 남기나요?
- 사본을 보관하는 것과 장애 중 하나의 결정을 확정하는 것은 어떤 규칙이 다른가요?
- 쿼리는 짧은데 연결 보유가 길다면 어떤 대기를 transaction 밖으로 옮겨야 하나요?
