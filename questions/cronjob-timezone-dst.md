---
id: cronjob-timezone-dst
title: 지역 9시 schedule이 DST 주간에 달라질 때 timeZone과 controller timezone을 어떻게 검증하나요?
difficulty: 중하
category: 인프라
tags:
  - CronJob
  - schedule
  - deadline
related:
  - scheduler-missed-runs
---
# 지역 9시 schedule이 DST 주간에 달라질 때 timeZone과 controller timezone을 어떻게 검증하나요?

## 구두 답변

지역 오전 9시가 계약이면 CronJob의 schedule 해석 zone과 Pod 내부 시간대를 분리해 검증합니다. 지원되는 Kubernetes 환경에서는 `spec.timeZone`을 명시하고, 생략했다면 controller가 사용하는 시간대 전제를 확인합니다. 애플리케이션의 `TZ`만 바꾸는 것은 이미 controller가 계산한 회차를 바꾸지 않습니다. DST가 있는 zone에서는 지역 09:00을 해당 날짜의 zone 규칙으로 instant로 변환해야 하며 이전 instant에 24시간을 더하는 방식은 다음 달력일 09:00을 보장하지 않습니다.

검증 표에는 DST 전·전환일·전환 후의 지역 날짜, 예정 UTC instant, Job creationTimestamp를 함께 기록합니다. 예를 들어 offset이 -04:00에서 -05:00으로 바뀌면 같은 지역 09:00의 UTC 시각도 달라집니다. controller가 UTC로 해석하도록 두고 Pod만 현지 TZ로 표시하면 로그가 맞아 보이면서 실제 회차가 어긋날 수 있습니다. 전환일의 생략·중복 가능성은 “무조건 두 번”으로 정하지 않고, 회차별 정산이면 logical key와 대사 정책을, 최신 snapshot이면 collapse 정책을 별도로 둡니다. 지역 시각으로 표시한 Job 이름과 UTC instant를 같은 키로 취급하지 않습니다. 재시도와 대사는 `zone/local-date/occurrence` 같은 논리 키와 실제 시작 instant를 함께 보존해야 offset 변경 뒤에도 같은 회차를 두 번 지급하지 않습니다.

## 득점 포인트

- spec.timeZone과 Pod TZ를 다른 계층으로 구분합니다.
- 지역 09:00을 zone rule로 UTC instant에 변환하고 DST trace를 제시합니다.

## 감점 포인트

- 이전 instant+24시간이 다음 지역 달력일을 보장한다고 합니다.
- controller timezone과 애플리케이션 TZ가 자동으로 일치한다고 합니다.

## 더 파고들 거리

- DST 전환일의 논리 회차 key를 지역 날짜와 UTC 중 무엇으로 만들까요?
- timeZone 지원 버전과 controller timezone을 어떤 fixture로 검증하나요?
