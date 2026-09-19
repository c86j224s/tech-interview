---
id: cronjob-concurrency-policy-effects
title: >-
  1분 schedule과 3분 작업에서 Allow·Forbid·Replace가 만드는 겹침·누락·중단을 비교하고 멱등성이 왜 별도인지
  설명하세요.
difficulty: 중하
category: 인프라
tags:
  - CronJob
  - schedule
  - deadline
related:
  - scheduler-missed-runs
---
# 1분 schedule과 3분 작업에서 Allow·Forbid·Replace가 만드는 겹침·누락·중단을 비교하고 멱등성이 왜 별도인지 설명하세요.

## 구두 답변

1분마다 회차가 생기고 한 Job이 3분 걸리면 Allow·Forbid·Replace는 서로 다른 손실을 만듭니다. 12:00 Job이 12:03:00까지 실행된다고 놓으면 Allow에서는 12:01, 12:02 Job이 추가돼 정상 상태에서도 약 세 개가 겹칩니다. Forbid에서는 앞선 Job이 active인 동안 뒤 회차의 Job 생성이 생략됩니다. Replace에서는 최신 회차를 위해 이전 Job을 종료시키는 시도가 일어나지만, 종료가 이미 끝난 DB commit이나 외부 HTTP 요청을 되돌리지는 않습니다. 따라서 concurrencyPolicy는 Job 수명과 겹침을 정하고, 외부 효과의 멱등성은 별도 계층입니다.

회차별 정산처럼 12:01의 결과도 보존해야 한다면 Forbid에 기대지 않고 `runKey=invoice/2026-09-19T12:01Z`를 durable row나 queue에 기록합니다. 응답이 timeout되어 재시도할 때 수신 측 unique key가 기존 결과를 반환해야 합니다. Replace를 최신 스냅샷 작업에 쓰더라도 세대 번호를 외부 write에 넣어 늦게 끝난 12:00 결과가 12:02 상태를 덮어쓰지 못하게 합니다. 이 구분이 없으면 Job은 하나만 보이는데 포인트 지급이나 재고 차감은 두 번 되는 상황이 생깁니다. 추가로 실행 수를 평균값으로만 잡지 않습니다. 12:01 Job이 시작되지 않은 채 Pending이면 Forbid의 active 판정과 deadline 판단이 다르게 보일 수 있고, Allow에서는 retryPolicy까지 겹쳐 downstream 호출이 세 배보다 커질 수 있습니다. 운영 로그에는 CronJob의 scheduled annotation, Job ownerReference, Pod 종료 사유, 수신 시스템의 runKey 결과를 함께 묶어 정책 효과와 애플리케이션 실패를 구분합니다.

## 득점 포인트

- Allow·Forbid·Replace를 1분/3분 수치로 비교하고 Job 수명과 외부 효과를 분리합니다.
- runKey·unique 제약으로 응답 유실 재시도의 중복을 막는 경계를 설명합니다.

## 감점 포인트

- Forbid를 exactly-once 또는 모든 missed 회차의 durable queue로 말합니다.
- Replace가 결제·메일·DB commit을 취소하거나 보상한다고 단정합니다.

## 더 파고들 거리

- controller 지연으로 Forbid 회차가 missed가 될 때 deadline과 durable queue를 어떻게 결합하나요?
- 외부 API가 성공했지만 응답이 유실된 뒤 runKey 결과를 어떻게 조회하나요?
