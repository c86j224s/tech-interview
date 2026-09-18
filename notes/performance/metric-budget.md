---
id: metric-budget
title: 메트릭 Cardinality·Exemplar·테넌트 SLO 예산
topic: 성능
summary: 라벨 조합과 histogram 시계열 수를 계산하고 route 정규화·개별 trace·exemplar 보관·작은 tenant 오류의 별도 집계를 설명합니다.
questionIds: [metrics-cardinality, metric-exemplar-trace-selection, tenant-slo-cardinality-budget]
---

# 메트릭 Cardinality·Exemplar·테넌트 SLO 예산

이 노트는 관측 신호를 많이 남기는 것과 진단 가능한 시스템을 만드는 것을 같은 일로 보지 않습니다. 라벨 값 조합이 시계열을 만들고, 개별 요청의 원인은 trace·로그·exemplar가 맡으므로, 질문별로 유한한 차원을 배정하고 생성·보관·조회 비용을 함께 제한해야 합니다.

## 사용자 ID와 라벨 조합 Cardinality 증가

**Cardinality**는 라벨 값 조합으로 만들어지는 시계열의 개수이며, 라벨 조합마다 시계열을 만드는 시스템에서 user ID·order ID·원문 URL·자유 오류 문구를 넣으면 새로운 값 조합이 관측될 때마다 새 시계열이 생깁니다. 예를 들어 장애 중 오류 문구가 요청마다 달라지면 수집기 메모리와 전송량뿐 아니라 저장 인덱스·query·대시보드 비용도 함께 늘어 관측 시스템 자체가 포화될 수 있습니다. 그래서 라벨을 추가할 때는 현재 조합 수만 세지 말고 새로운 값 조합의 churn도 비용으로 봅니다.

예를 들어 route 20×status 5×instance 10이면 최대 1000개 조합입니다. bucket 10개(무한 bucket 포함으로 가정)에 sum·count 2개를 가진 classic histogram이면 약 12,000개 시계열이 됩니다. 여기 user 100만 명을 추가하면 잠재 조합이 120억으로 커집니다. 실제 조합은 모두 생기지 않을 수 있지만 새로운 ID의 churn도 비용입니다.

시계열은 보통 metric 이름과 라벨 값 조합별로 하나의 저장 단위를 만듭니다. 따라서 라벨 하나가 값 N개를 가지면 기존 조합 수에 N배 차원을 추가할 수 있고, 값이 계속 새로 생기면 churn도 함께 발생합니다. 계산할 때는 route·status·instance·bucket처럼 각 축의 상한과 실제 발생률을 나누어 적어야 합니다.

## 질문별 Bounded Label 선택

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

선택 절차는 먼저 운영 질문을 한 문장으로 쓰고, 전체 비율·분포 질문이면 bounded metric, 특정 요청 원인 질문이면 trace/log, tenant 계약이면 제한된 집계 모델을 배정하는 것입니다. route 정규화가 서로 다른 동작을 합치지 않는지 샘플 URL을 비교하고, `other`로 보낸 비율도 별도 신호로 남겨 진단 가능성을 잃지 않았는지 확인합니다.

## Exemplar와 부분 표본 보관

**Exemplar**는 histogram의 특정 표본에 trace ID 같은 진단 링크를 붙여, 전체 집계를 개별 요청의 trace로 따라가게 하는 일부 표본입니다. 느린·실패·대표 정상 요청을 골라도 trace가 sampling으로 버려졌거나 보관 기간이 끝나면 링크가 없을 수 있으므로, metric과 trace의 retention·sampling·접근권한을 함께 맞춥니다. 모든 요청을 exemplar로 보관하는 대신 이 제한을 전제로 운영하고, trace ID가 민감 정보와 연결될 수 있다는 점까지 포함해 viewer 권한을 관리합니다.

전체 오류율·p99를 exemplar 몇 개로 계산하지 않습니다. metric은 집계, trace는 원인 분석이라는 역할을 보존합니다. 모든 요청을 exemplar로 넣거나 payload를 붙여 cardinality 문제를 다른 필드로 옮기지 않습니다.

예를 들어 느린 histogram 표본 일부에 trace ID를 연결해도 histogram의 p99 계산은 metric 집계에서 수행되고, trace는 원인 확인에만 쓰입니다. trace sampling이나 retention이 먼저 끝나면 exemplar 링크가 비어 있을 수 있으므로, 링크 존재율을 품질 지표로 보고 모든 요청 ID를 label로 승격하는 우회는 피합니다. trace ID가 민감 데이터와 연결되는 접근권한도 같은 설계에 포함합니다.

## 작은 Tenant 장애와 전체 평균의 분리

큰 tenant가 100만 요청을 성공하고 작은 tenant가 10개 모두 실패하면 전체 성공률은 좋아 보일 수 있습니다. 계약상 필요한 tenant 집단을 제한된 label로 관리하거나 별도 tenant별 집계 저장소·기간별 보고를 사용할 수 있습니다. top tenant만 모니터링하면서 작은 tenant의 SLO 책임을 없애면 안 됩니다.

절대 실패 수·영향 tenant 수·tenant별 최소 표본·오류 이벤트를 보존하고 drill-down 경로를 둡니다. 적은 표본의 비율·p99 불안정성을 드러내고 별도 합성 probe·고객 신고·로그 조회와 보완할 수 있습니다. 고유 ID를 단순 hash해도 cardinality는 그대로이고 재식별 위험이 완전히 사라지지 않습니다.

## 수집·보관·조회의 상한

histogram bucket 수·라벨 수·시계열 생성률·retention·remote write queue·collector buffer를 예산화합니다. native histogram은 저장·오차 모델이 다르지만 무제한 label을 무료로 만들지는 않습니다. 수집 실패·drop 수와 중요한 감사 기록 경로도 분리합니다.

배포 전 예상 조합을 계산하고 가짜 사용자·route·오류 폭증에서 새 series와 collector 지연을 확인합니다. 정규화 뒤에도 원래 진단 질문에 답할 수 있어야 합니다. 본문은 관측 예산 설계이며 실제 메트릭 저장소에 부하를 가한 결과는 아닙니다.

부하 시험에서는 예상 series 수만 아니라 초당 신규 series, collector queue, remote write 지연, drop 수, query latency를 함께 측정합니다. 가짜 user·route·오류 문구를 주입했을 때 bounded 분류가 실제로 새로운 series를 제한하는지 확인하고, 정상 집계와 감사·보안 로그가 수집 포화 때문에 동시에 사라지지 않는지도 별도 경로로 검증합니다.
