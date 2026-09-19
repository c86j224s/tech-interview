---
id: cronjob-starting-deadline
title: controller가 10분 중단됐다가 복구될 때 startingDeadlineSeconds는 어떤 실행을 허용하나요?
difficulty: 중하
category: 인프라
tags:
  - CronJob
  - schedule
  - deadline
related:
  - scheduler-missed-runs
---
# controller가 10분 중단됐다가 복구될 때 startingDeadlineSeconds는 어떤 실행을 허용하나요?

## 구두 답변

`startingDeadlineSeconds`는 missed된 회차를 지금 시작할 수 있는 늦은 시작 창입니다. Pod가 120초 안에 Ready가 되어야 한다는 뜻도, 프로그램을 120초 뒤 죽인다는 뜻도 아닙니다. 12:00 회차를 controller가 12:10에 관찰하고 값이 120초라면 지연은 600초이므로 그 회차는 늦은 실행으로 skip됩니다. 이후 12:11 회차는 별도의 예정 시각과 관찰 지연으로 판단합니다. 이 시각 조건에서는 허용 창 밖입니다.

관측 필드는 `scheduledTime=12:00`, `controllerObservedAt=12:10`, `jobCreatedAt`, `podStartedAt`, `effectCommittedAt`로 나눕니다. 별도로 12:10 예정 Job이 제때 생성돼 Pod가 12:12에 시작해도 starting deadline이 Pod를 취소하지 않으므로 Job active deadline이나 애플리케이션 timeout이 필요합니다. deadline을 생략하면 오래된 회차가 복구 때 몰릴 수 있고 missed schedule 과다 시 보호 조건도 있습니다. 실제 cluster는 실행하지 않았으므로 위는 계약에 따른 계산 trace이며, 적용 시 CronJob status와 controller event를 대조합니다. 12:00 회차를 skip한 뒤 12:11 회차가 정상 생성되더라도 12:00의 결과가 자동으로 대체됐다고 기록하지 않습니다. 정산 시스템이면 누락 ledger row를 별도 상태로 남기고, snapshot이면 최신 회차가 이전 상태를 대체했다는 정책을 저장합니다.

## 득점 포인트

- 600초 지연과 120초 창을 계산해 12:00 회차가 skip임을 결정적으로 답합니다.
- schedule·controller 관찰·Job 생성·Pod 시작 시각을 분리합니다.

## 감점 포인트

- startingDeadlineSeconds를 Pod 실행 timeout으로 해석합니다.
- deadline 미설정이면 backlog가 무한히 안전하게 재생된다고 말합니다.

## 더 파고들 거리

- suspend 중 회차와 controller 중단 회차의 deadline 계산을 어떻게 대조하나요?
- Job 생성 뒤 Pod Pending을 별도 timeout으로 어떻게 관찰하나요?
