---
id: bulkhead-fairness
title: 기능·Tenant 격리와 우선순위의 실제 실행 예산
topic: 설계
summary: 논리 분리와 자원 격리·공용 차용을 구분하고 계층 한도·최소 진행·aging·비선점·공유 lock·실제 종료 후 permit 반환을 설명합니다.
questionIds: [bulkhead-isolation, tenant-resource-bulkheads, reserved-shared-capacity-borrowing, priority-queue-starvation, nonpreemptive-priority-blocking]
---

# 기능·Tenant 격리와 우선순위의 실제 실행 예산

## 추천의 대기가 로그인 Worker까지 점유할 수 있습니다

worker 10개를 공유하고 추천 요청 10개가 외부 응답을 기다리면 로그인 계산이 가벼워도 실행하지 못합니다. **벌크헤드**는 기능/tenant가 점유할 실행·queue·connection·memory 예산을 나눠 장애 영향 범위를 제한합니다. class·service를 나눈 것만으로 자원이 분리되지는 않습니다.

worker를 나눠도 공용 HTTP pool·DB CPU·disk·host memory는 남습니다. 실제 간섭 자원을 그린 뒤 중요한 경로의 최소 용량과 느린 경로 상한을 정합니다. 추천은 생략/유효 cache로 저하할 수 있지만 권한 조회 실패를 임의 허용으로 바꾸면 안 됩니다. 선택 누락률은 따로 관측합니다.

## Tenant마다 물리 Pool을 만드는 것이 유일한 답은 아닙니다

tenant별 논리 permit·queue bytes·rate와 service 전체 hard limit을 조합할 수 있습니다. 물리 pool을 무한 분할하면 유휴 낭비·connection 총량·관리 비용이 커집니다. CPU·큰 buffer·DB 대기 중 무엇을 제한하는지 구분하고 instance 증설 후 모든 pool의 합도 하위 시스템 한도 안에 있어야 합니다.

| 예산 | 지키는 범위 |
| --- | --- |
| 기능 예약 | 핵심 기능 최소 용량 |
| tenant 상한 | noisy neighbor 영향 |
| 공용 여유 | 유휴 용량 활용 |
| 전체 physical limit | host·DB 실제 총량 |
| queue 수/bytes/age | 기다리는 작업의 메모리·유효성 |

## 빌린 Permit을 장부에서 지워도 실행은 남습니다

핵심 예약 3·추천 예약 2·공용 5라면 전체 실행 예산은 10이고, 추천이 공용 5를 빌려 쓰더라도 핵심 예약 3은 보호할 수 있습니다. 장애가 시작되면 새 차용을 막고 기존 차용은 deadline·협력 취소·실제 작업 완료에 따라 줄어듭니다. 긴 비선점 작업을 핵심 예약까지 빌려준 상태라면 필요한 순간 즉시 회수할 수 없으므로, 그 예약은 ‘최소 즉시 보장’이 아닙니다.

```diagram
{"title":"예약분과 공용분을 물리 총량 안에서 관리합니다","caption":"화살표는 예산 배분입니다. 이미 실행 중인 차용은 실제 종료 전 재배정하지 않고 보호할 예약분을 침범하지 않게 합니다.","rows":[[{"id":"total","label":"전체 physical capacity 10"}],[{"id":"reserved","label":"핵심 3 · 추천 2 예약"},{"id":"shared","label":"공용 여유 5 · 제한된 차용"}],[{"id":"active","label":"실제 실행·대기·차용량 관측"}]],"edges":[{"from":"total","to":"reserved","label":"보호된 최소"},{"from":"total","to":"shared","label":"탄력 사용"},{"from":"reserved","to":"active","label":"실제 점유"},{"from":"shared","to":"active","label":"완료 후 반환"}]}
```

## Queue 우선순위는 이미 실행 중인 일을 선점하지 않습니다

낮은 작업 하나가 1초 동안 worker를 점유할 때 높은 작업이 도착하면, 선점하지 않는 queue에서는 높은 작업도 다음 선택 시점까지 기다릴 수 있습니다. 작업을 작은 chunk로 나누고 안전한 취소 지점에서 멈추게 하며, 별도 실행·connection 예산으로 영향을 줄입니다. 별도 worker도 낮은 작업의 shared lock·DB connection을 기다릴 수 있으므로, 이를 queue starvation과 다른 우선순위 역전으로 구분해 두 대기 원인을 따로 측정합니다.

고우선순위 작업이 계속 들어오면 낮은 작업은 영원히 밀려 선택될 기회를 잃을 수 있습니다. 클래스별 최소 슬롯을 남기고 가중 round-robin/deficit·aging(기다린 시간에 따라 우선순위를 올리는 방식)을 적용하되, 만료된 작업은 먼저 제거합니다. aging에 상한을 둔 결과 낮은 작업이 절대 높은 작업보다 앞설 수 없다면, 그 정책만으로 진행을 보장했다고 볼 수 없습니다.

## 요청 건수 비율과 자원 공정성은 다릅니다

1ms 작업 9개와 1초 작업 1개를 번갈아 실행하면 건수는 9:1이어도 총 실행 시간은 9×1ms+1×1s=1.009s이므로 긴 작업이 거의 전부를 차지합니다. 그러므로 요청 수 대신 CPU·bytes·connection 보유 같은 비용을 budget에 반영하고, 추정 오차는 다음 budget에서 보정하거나 작업을 더 작은 단위로 나눕니다. 개별 실행이 무한히 길어질 수 있으면 최소 슬롯만으로는 대기 상한을 보장할 수 없습니다.

전체 도착이 용량보다 크면 모든 클래스에 무제한 성공을 약속할 수 없습니다. 거절·만료·deadline·정직한 부분 결과를 정합니다. 낮은 작업의 p99 대기·완료·만료율과 핵심 SLO를 동시에 확인합니다. tenant ID를 무제한 metric label로 곱하지 않고 제한된 집계와 trace로 진단합니다.

## 부분 장애에서 격리의 경계를 확인합니다

추천만 지연시키며 로그인 유입을 유지하고 특정 tenant의 큰 요청·차용 회수·긴 lock·동시 instance 증설을 시험합니다. 실제 remaining 작업·memory·하위 DB·재시도까지 확인해야 합니다. 이 노트는 자원 배분 설계이며 부하 실험으로 특정 예약 비율을 검증한 결과는 아닙니다.
