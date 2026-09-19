---
id: cronjob-suspend-missed-schedules
title: CronJob을 suspend했다가 재개하면 중단 중 모든 회차가 실행되나요? backlog 정책과 deadline을 어떻게 정하나요?
difficulty: 중하
category: 인프라
tags:
  - CronJob
  - schedule
  - deadline
related:
  - scheduler-missed-runs
---
# CronJob을 suspend했다가 재개하면 중단 중 모든 회차가 실행되나요? backlog 정책과 deadline을 어떻게 정하나요?

## 구두 답변

suspend는 새 Job 생성을 막지만 이미 실행 중인 Job을 취소하지 않습니다. suspend 중 예정된 회차는 missed로 계산되고, 재개 시 deadline이 없는 eligible 회차는 즉시 따라잡을 수 있습니다. `startingDeadlineSeconds`가 있으면 resume 시각에서 창 안에 있는 회차만 허용되고, 100회를 초과한 missed schedule은 catch-up을 막는 보호에 걸릴 수 있습니다. Forbid 때문에 실행 중 Job과 겹치지 못한 회차도 missed 계산에 포함될 수 있으므로 “항상 전부”나 “항상 최신 하나”라고 일반화하면 안 됩니다.

예를 들어 12:00부터 12:05까지 suspend하고 12:06에 resume했다고 하겠습니다. deadline이 120초면 12:00~12:03 회차는 창 밖이고 12:04~12:06 부근만 대상이 될 수 있습니다. 정확한 생성 수는 schedule, 관찰 시각, active Job과 missed 보호를 함께 계산합니다. 시간별 원장이라면 회차별 durable queue와 runKey로 replay하고, 현재 재고 snapshot이라면 오래된 회차를 하나로 접는 별도 애플리케이션 정책을 둡니다. 이 작업에서는 cluster를 실행하지 않았으므로 status와 controller event로 결과를 검증해야 합니다. resume 직후 burst가 예상되면 CronJob을 더 자주 돌리는 식으로 해결하지 않습니다. backlog consumer의 처리량, 최대 동시성, 오래된 회차의 만료 규칙을 별도로 두어 정상 traffic과 복구 작업이 서로 자원을 빼앗지 않게 합니다.

## 득점 포인트

- suspend가 active Job을 멈추지 않고 missed 회차를 만든다는 점을 설명합니다.
- deadline·100회 보호·Forbid skipped run과 제품 backlog를 분리합니다.

## 감점 포인트

- resume이 항상 전부 또는 항상 최신 하나를 실행한다고 단정합니다.
- CronJob 객체가 회차 원장과 durable queue를 대신한다고 말합니다.

## 더 파고들 거리

- 모든 회차가 필요한 정산과 최신 snapshot의 backlog 자료구조를 어떻게 다르게 만들까요?
- 100회 초과 missed 보호가 걸린 뒤 수동 대사 기준은 무엇인가요?
