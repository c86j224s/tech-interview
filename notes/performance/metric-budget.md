---
id: metric-budget
title: 메트릭 Cardinality·Exemplar·테넌트 SLO 예산
topic: 성능
summary: 라벨 조합과 histogram 시계열 수를 계산하고 route 정규화·개별 trace·exemplar 보관·작은 tenant 오류의 별도 집계를 설명합니다.
questionIds: [metrics-cardinality, metric-exemplar-trace-selection, tenant-slo-cardinality-budget]
---

# 메트릭 Cardinality·Exemplar·테넌트 SLO 예산

## 사용자 ID 하나가 모든 라벨 조합을 늘릴 수 있습니다

라벨 조합마다 시계열이 생기는 시스템에서 user ID·order ID·원문 URL·자유 오류 문구를 넣으면 계속 새 시계열이 생성됩니다. 수집기 메모리·전송·저장 인덱스·query·대시보드 비용이 늘고 장애 중 오류 문구가 다양해질 때 관측 시스템 자체가 포화될 수 있습니다.

예를 들어 route 20×status 5×instance 10이면 최대 1000개 조합입니다. bucket 10개(무한 bucket 포함으로 가정)에 sum·count 2개를 가진 classic histogram이면 약 12,000개 시계열이 됩니다. 여기 user 100만 명을 추가하면 잠재 조합이 120억으로 커집니다. 실제 조합은 모두 생기지 않을 수 있지만 새로운 ID의 churn도 비용입니다.

## 지표가 답할 질문에 맞는 Bounded Label을 고릅니다

| 필요한 질문 | 적절한 신호 | 피할 기본값 |
| --- | --- | --- |
| 어떤 API가 느린가 | template route·method·status class histogram | 원문 path·query label |
| 어떤 오류 종류가 늘었나 | bounded 오류 코드 counter | 자유 예외 메시지 label |
| 특정 요청은 왜 느린가 | trace·구조화 로그 | request ID 시계열 |
| 특정 tenant SLO | 제한된 집계·별도 저장 모델 | 모든 라벨과 무제한 곱 |

`/users/123/orders`를 `/users/{id}/orders`로 정규화하되 실제 다른 동작을 한 이름으로 합치지 않습니다. 알 수 없는 값은 bounded other로 분류하고 누락 분류·신규 series 생성률을 관찰합니다. 라벨을 전부 지우면 원인 분석이 불가능해지므로 필요한 분해와 최대 조합 수를 함께 설계합니다.

```diagram
{"title":"전체 집계와 개별 원인의 저장 경로를 나눕니다","caption":"화살표는 관측 데이터 분류입니다. exemplar는 일부 집계 표본에서 trace를 찾는 링크이며 모든 요청 ID를 metric label로 넣는 방식이 아닙니다.","rows":[[{"id":"request","label":"요청 관측"}],[{"id":"metric","label":"bounded metric·histogram"},{"id":"trace","label":"제한된 trace·로그"}],[{"id":"exemplar","label":"대표 exemplar 연결"}]],"edges":[{"from":"request","to":"metric","label":"전체 비율·분포"},{"from":"request","to":"trace","label":"개별 진단 표본"},{"from":"metric","to":"exemplar","label":"표본 선택"},{"from":"trace","to":"exemplar","label":"trace 참조"}]}
```

## Exemplar는 모든 요청의 보관을 약속하지 않습니다

느린·실패·대표 정상 요청 일부를 histogram 표본에서 trace로 이어갈 수 있습니다. trace가 sampling으로 버려졌거나 보관 기간이 끝나면 링크가 없을 수 있어 양쪽 retention·sampling·접근권한을 맞춥니다. exemplar의 trace ID도 민감 정보와 연결될 수 있으므로 viewer 권한을 유지합니다.

전체 오류율·p99를 exemplar 몇 개로 계산하지 않습니다. metric은 집계, trace는 원인 분석이라는 역할을 보존합니다. 모든 요청을 exemplar로 넣거나 payload를 붙여 cardinality 문제를 다른 필드로 옮기지 않습니다.

## 작은 Tenant의 장애를 전체 평균에서 잃지 않습니다

큰 tenant가 100만 요청을 성공하고 작은 tenant가 10개 모두 실패하면 전체 성공률은 좋아 보일 수 있습니다. 계약상 필요한 tenant 집단을 제한된 label로 관리하거나 별도 tenant별 집계 저장소·기간별 보고를 사용할 수 있습니다. top tenant만 모니터링하면서 작은 tenant의 SLO 책임을 없애면 안 됩니다.

절대 실패 수·영향 tenant 수·tenant별 최소 표본·오류 이벤트를 보존하고 drill-down 경로를 둡니다. 적은 표본의 비율·p99 불안정성을 드러내고 별도 합성 probe·고객 신고·로그 조회와 보완할 수 있습니다. 고유 ID를 단순 hash해도 cardinality는 그대로이고 재식별 위험이 완전히 사라지지 않습니다.

## 수집·보관·조회 모두의 상한을 확인합니다

histogram bucket 수·라벨 수·시계열 생성률·retention·remote write queue·collector buffer를 예산화합니다. native histogram은 저장·오차 모델이 다르지만 무제한 label을 무료로 만들지는 않습니다. 수집 실패·drop 수와 중요한 감사 기록 경로도 분리합니다.

배포 전 예상 조합을 계산하고 가짜 사용자·route·오류 폭증에서 새 series와 collector 지연을 확인합니다. 정규화 뒤에도 원래 진단 질문에 답할 수 있어야 합니다. 본문은 관측 예산 설계이며 실제 메트릭 저장소에 부하를 가한 결과는 아닙니다.
