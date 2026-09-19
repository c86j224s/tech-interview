---
id: kubernetes-cronjob-time-policy
title: Kubernetes CronJob의 동시성·deadline·시간대
topic: 플랫폼
summary: >-
  CronJob의 schedule 해석, timezone, missed run, startingDeadlineSeconds와
  concurrencyPolicy를 실제 작업 중복·지연 정책으로 연결합니다.
questionIds: []
prerequisites:
  - timing-wheel
  - reconciliation
related: []
reviewedAt: '2026-09-19'
---
# Kubernetes CronJob의 동시성·deadline·시간대

CronJob은 cron 식을 실행하는 단일 프로세스가 아니라 예정 회차를 계산하고 Job 객체를 조정하는 controller입니다. 따라서 `schedule`의 12:01 회차, 그 회차를 위한 Job 생성, Pod의 실제 시작, 프로그램이 외부 DB에 커밋한 시점은 서로 다른 사건입니다. 이 경계를 먼저 기록해야 “실행이 누락됐다”는 말이 controller 계산 실패인지, Job 생성 실패인지, Pod 배치 지연인지, 애플리케이션 재시도 실패인지 구체화됩니다. `concurrencyPolicy`는 주로 Job 간 겹침을 제어하며 외부 결제나 재고 차감의 원자성을 대신하지 않습니다.

## 회차와 실행 수명

`*/1 * * * *`와 3분짜리 작업을 가정하겠습니다. 12:00 회차의 Job이 12:00:20에 시작해 12:03:20에 끝나는 동안 12:01과 12:02라는 예정 회차가 지나갑니다. Allow에서는 세 Job이 동시에 존재할 수 있고, Forbid에서는 앞선 Job이 active인 동안 뒤의 Job 생성이 생략될 수 있으며, Replace에서는 이전 Job을 종료시키는 방향으로 새 Job을 시작합니다. 어느 경우에도 “예정 시각이 있었다”와 “그 회차의 외부 변경이 한 번 반영됐다”는 같은 사실이 아닙니다.

운영 원장에는 `scheduledTime`, `jobCreatedAt`, `podStartedAt`, `effectCommittedAt`, `runKey`를 따로 둡니다. 예를 들어 `runKey=invoice/2026-09-19T12:01:00Z`가 있으면 12:01 회차의 응답이 유실돼 재시도되어도 수신 측 unique 제약이나 inbox가 같은 결과를 반환할 수 있습니다. 반대로 Job 이름만 키로 쓰면 controller 재생성이나 수동 재실행 때 동일 논리 회차를 알아보지 못할 수 있습니다.

## 시간대와 달력

Kubernetes CronJob은 `spec.timeZone`으로 schedule 해석 시간대를 지정할 수 있는 계약을 제공하며, 이를 쓰지 않는 경우 controller가 사용하는 시간대 전제가 중요합니다. Pod의 `TZ` 환경 변수는 애플리케이션 로그와 내부 계산을 바꿀 뿐, 이미 controller가 해석한 CronJob schedule을 바꾸지 않습니다. 지역 업무 시각이 기준이면 manifest의 `timeZone`, cluster의 지원 버전, controller 로그의 예정 회차를 함께 확인해야 합니다.

DST가 있는 `America/New_York`의 오전 9시를 예로 들면 지역 시각을 UTC로 바꾸는 offset이 전환 주간에 달라집니다. “이전 실행 instant에 24시간을 더한다”는 구현은 다음 지역 달력일 오전 9시와 어긋날 수 있습니다. 날짜별로 `localDate + 09:00 + zone rules`를 instant로 변환하고 그 결과를 저장해야 합니다. 반복 시각이 생략되거나 두 번 나타나는 전환일에는 회차별 정산인지 최신 상태 갱신인지에 따라 한 번 처리, 보정, 또는 의도적 skip 정책을 정합니다.

## Missed 회차와 deadline

Controller가 중단되거나 API 접근이 지연되면 예정 시각은 지났지만 Job이 없는 missed 회차가 생깁니다. `startingDeadlineSeconds`는 그 회차를 지금 시작할 수 있는 늦은 시작 창이며 Pod 실행 시간이나 애플리케이션 처리 시간을 제한하는 값이 아닙니다. 12:00 회차를 controller가 12:10에 관찰하고 deadline이 120초라면 지연은 600초이므로 해당 회차는 늦은 실행으로 건너뜁니다. 12:11 회차는 별도의 deadline 계산 대상입니다.

deadline이 없거나 길다고 오래된 회차를 무제한으로 생성해도 안전한 것은 아닙니다. 문서가 설명하는 missed 회차 수 계산에는 과도한 backlog를 막기 위한 100회 초과 보호가 있으며, controller 관찰 시점과 다른 active Job의 영향도 함께 봐야 합니다. 또 `startingDeadlineSeconds`는 Job 생성 이후 이미지 pull, Pod Pending, 프로그램 timeout을 취소하지 않습니다. Job의 active deadline과 애플리케이션 timeout은 별도의 시계입니다.

## 동시성 정책

Allow는 회차가 독립적이고 downstream 용량을 감당할 때 선택합니다. 1분 주기와 3분 처리 시간을 단순한 steady-state로 계산하면 약 3개의 Job이 겹치고, Job당 외부 호출 200회이면 세 Job에서 최대 600회 호출 단위가 한 분에 발생할 수 있습니다. 이는 실제 controller 측정값이 아닌 설명용 예산 계산이며, 실제 peak는 retry와 시작 지연으로 더 커질 수 있습니다.

Forbid는 active Job이 있을 때 다음 Job을 만들지 않지만, 생략된 회차를 내구성 있게 저장해 순서대로 재생하는 큐가 아닙니다. 회차별 청구서처럼 모든 회차가 필요하면 별도 backlog를 둡니다. Replace는 최신 회차가 오래된 실행보다 중요할 때 적합하지만 종료 요청이 이미 완료된 결제·메일·DB commit을 보상하지 않습니다. 종료된 Job의 세대와 외부 `runKey`를 비교해 늦게 도착한 결과가 최신 상태를 덮어쓰지 못하게 해야 합니다.

## Suspend와 backlog

`suspend=true`는 새 Job 생성의 controller 조정만 멈추며 이미 실행 중인 Job을 취소하지 않습니다. suspend 중 발생한 회차는 missed로 계산됩니다. 재개할 때 `startingDeadlineSeconds`가 없으면 eligible missed work가 즉시 생성될 수 있고, deadline이 있으면 그 창에 들어오는 회차만 대상이 됩니다. 100회를 초과한 missed schedule은 catch-up을 막는 보호에 걸릴 수 있으며, Forbid 때문에 건너뛴 회차도 missed 계산에 포함될 수 있습니다.

이 controller 규칙과 제품 backlog는 분리합니다. 시간별 원장을 모두 처리해야 한다면 회차별 row를 durable하게 만들고 CronJob은 큐를 채우는 역할만 맡깁니다. 반대로 현재 재고 스냅샷은 오래된 회차를 하나로 접을 수 있습니다. resume 직후 생성된 Job 수가 제품 계약과 다르면 CronJob을 억지로 조절하기보다 application queue에서 collapse 또는 replay를 구현합니다.

```diagram
{"title":"회차에서 외부 변경까지의 경계","caption":"controller 정책은 Job 생성과 겹침을 다루고, 외부 변경의 중복·보상은 애플리케이션 계약으로 남습니다.","rows":[[{"id":"schedule","label":"예정 회차","detail":["지역 시각·UTC instant"]}],[{"id":"controller","label":"Controller 판단","detail":["deadline·suspend·동시성"]}],[{"id":"job","label":"Job·Pod 실행","detail":["생성·배치·재시도"]}],[{"id":"effect","label":"외부 변경","detail":["runKey·commit·대사"]}]],"edges":[{"from":"schedule","to":"controller","label":"회차 계산"},{"from":"controller","to":"job","label":"생성 또는 생략"},{"from":"job","to":"effect","label":"프로그램 호출"}]}
```

## 구현 관측과 검증

검증 fixture에는 1분 schedule, 3분 처리시간, Allow·Forbid·Replace를 각각 별도 CronJob으로 두고 `scheduledTime`과 Job 생성 이벤트를 수집합니다. 12:00 Job이 살아 있는 12:01에 controller 로그, Job 상태, Pod 종료 시각을 함께 기록합니다. Replace에서는 종료 요청 시각만으로 외부 요청이 취소됐다고 판단하지 말고 수신 시스템의 commit 원장과 대조합니다.

DST 검증은 실제 운영 zone을 고정한 작은 표로 합니다. 전환 전·전환일·전환 후에 지역 09:00, 계산된 UTC instant, Job `creationTimestamp`를 나란히 기록합니다. controller를 10분 중단하는 테스트에서는 deadline 120초 회차가 skip되고 이후 회차가 독립적으로 평가되는지 확인합니다. 이 문서에서는 cluster나 controller를 실행하지 않았으므로 위 결과는 검증 절차와 설명용 trace입니다.

## 실패 비용과 선택 기준

Allow는 downstream 포화와 중복 효과 비용을, Forbid는 회차 손실과 최신성 지연을, Replace는 중간 처리 중단과 보상 비용을 키울 수 있습니다. deadline을 너무 짧게 두면 controller 장애 뒤 정산 회차가 사라지고, 너무 길게 두면 복구 시 burst가 발생합니다. 선택은 “작업이 오래 걸리는가”가 아니라 회차별 결과를 보존해야 하는지, 효과가 멱등인지, 처리 용량과 복구 예산이 얼마인지로 결정합니다.

## 참고자료와 범위

- [Kubernetes CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/) — `schedule`, `timeZone`, missed schedule, `startingDeadlineSeconds`, `concurrencyPolicy`, `suspend`의 공식 계약. 확인일 2026-09-19이며 특정 릴리스는 고정하지 않았습니다.
- [일반 scheduler missed run](/tech-interview/questions/scheduler-missed-runs/) — 제품 backlog와 멱등성의 인접 개념입니다.

Kubernetes cluster, DST 전환 Job, 외부 API를 실제 실행하지 않았습니다. 대상 release의 controller 문서와 이벤트를 통합 전에 다시 고정해야 합니다.
