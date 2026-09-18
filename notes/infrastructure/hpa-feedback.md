---
id: hpa-feedback
title: HPA 지표 계산과 실제 용량의 피드백 지연
topic: 인프라
summary: request 기반 utilization·replica 비율 계산·초기 Pod·누락 지표·복수 지표를 설명하고 안정화·준비 지연·하위 병목을 연결합니다.
questionIds: [k8s-hpa-scaling, k8s-hpa-metric-lag, hpa-cpu-utilization-request-denominator, hpa-startup-cpu-window, hpa-external-metric-failure]
---

# HPA 지표 계산과 실제 용량의 피드백 지연

## Desired Replica와 실제 Ready 용량의 차이

HPA가 desired=10을 계산해도 Ready가 3이면 실제 서비스는 준비된 세 Pod 기준으로 봐야 합니다. scheduler 자원 부족·이미지 다운로드·초기화·readiness·client 연결 분산이 모두 용량 적용을 늦출 수 있습니다. replica 숫자와 실제 완료율·사용자 지연을 연결해야 합니다.

HPA는 메트릭을 주기적으로 읽어 목표와 비교하고 대상 workload의 replica를 조정하는 제어기입니다. 처리 코드를 빠르게 만들거나 단일 파티션·DB 잠금을 나눠 주는 기능이 아닙니다.

## Utilization 비율의 분모와 단위

단순화한 기본 계산은 현재 replica 수에 현재 측정값과 목표값의 비율을 곱한 뒤 올림하는 `ceil(currentReplicas × currentMetric / desiredMetric)`입니다. 예를 들어 4개 Pod에서 현재 metric이 80이고 목표가 50이면 `4 × 80 / 50 = 6.4`이므로 단순 추천은 `ceil(6.4) = 7`입니다.

실제 HPA는 tolerance·누락 지표·초기 Pod·min/max·behavior 제한을 함께 적용하므로 이 식은 방향과 기본 추천을 이해하는 용도이지 모든 결과를 예측하는 식은 아닙니다.

| 가정 | 계산 | 해석 |
| --- | --- | --- |
| 4 Pod, CPU 이용률 80%, 목표 50% | ceil(4×80/50)=7 | 단순 비율 추천 |
| Pod CPU 사용 400m, request 500m | 80% | request 기준 utilization |
| 같은 사용 400m, request 1000m | 40% | 실제 사용이 같아도 입력 변화 |

request는 CPU utilization 분모와 scheduler 배치 기준을 동시에 바꿉니다. 확장을 막으려고 request를 키우면 실제 노드 요구도 커져 Pending이 늘 수 있습니다. request 누락·sidecar를 포함한 Pod 자원 집계·특정 container 메트릭 선택의 계약도 확인합니다. 원시 CPU 값 target과 utilization target을 구분합니다.

## 메트릭 측정과 용량 적용 사이의 지연

```diagram
{"title":"메트릭 감지부터 처리 용량까지의 지연","caption":"화살표는 제어 신호의 전달 순서입니다. 각 지연 동안 backlog가 쌓일 수 있어 warm 용량과 진입 상한이 필요합니다.","rows":[[{"id":"load","label":"실제 수요 증가"}],[{"id":"metric","label":"지표 수집·집계·조회"}],[{"id":"desired","label":"HPA 목표 replica 계산"}],[{"id":"pod","label":"노드·Pod 시작·준비"}],[{"id":"capacity","label":"실제 완료율 증가"}]],"edges":[{"from":"load","to":"metric","label":"관찰 지연"},{"from":"metric","to":"desired","label":"제어 주기"},{"from":"desired","to":"pod","label":"배치·시작 시간"},{"from":"pod","to":"capacity","label":"트래픽·할당 전환"}]}
```

metrics pipeline이 30초 늦고 Pod 준비에 40초가 더 걸린다고 단순히 직렬로 보면, 수요가 늘어난 뒤 실제 용량이 따라오기까지 `30 + 40 = 70초`가 걸릴 수 있으므로 그동안 backlog를 흡수할 여유가 필요합니다. 평균 CPU는 I/O 대기·hot partition·전역 lock을 대표하지 못할 수 있으므로, queue age와 실제 처리율, 하위 시스템 대기를 같은 시간축에서 확인합니다. 그 결과에 맞춰 min capacity·bounded queue·빠른 거절 중 어떤 경계가 필요한지 정합니다.

## 초기 Pod·누락 지표와 평균 계산

JIT·class loading·cache warmup의 CPU는 정상 요청당 CPU와 다릅니다. HPA의 CPU initialization period·initial readiness delay와 준비되지 않은 Pod의 메트릭 처리 규칙은 Kubernetes 버전·controller 설정을 확인합니다. startup·readiness를 실제 준비와 맞추고 예열을 숨기려 허위 0 메트릭을 보내지 않습니다.

누락된 지표를 0 부하로 채우면 실제로는 측정하지 못한 Pod를 한가한 것으로 세어 잘못 축소할 수 있습니다. HPA는 일부 누락이나 `not-yet-ready` Pod가 있을 때 scale 방향을 보수적으로 다시 계산할 수 있으므로, 화면에 보이는 평균만으로 최종 추천을 추정하지 않습니다. 조건·이벤트·현재 메트릭·추천 replica를 같은 시각에 읽어 왜 그 방향이 선택됐는지 확인합니다.

## 복수 지표와 지표 오류의 처리 정책

여러 메트릭이 각각 추천을 만들면 일반적으로 가장 큰 replica 추천을 선택합니다. 일부 메트릭 조회가 실패하고 나머지가 축소를 추천하면 축소를 건너뛰는 보수적 동작이 있을 수 있으며, 정상 메트릭이 확장을 추천하면 확장이 가능할 수 있습니다. 실제 버전·metric type·오류 reason으로 확인하고 무조건 0 또는 무조건 증가라고 외우지 않습니다.

외부 adapter의 누락·인증 오류·stale 값·진짜 0을 별도로 관측합니다. 최소 핵심 용량과 수동 제어 소유권·KEDA 등의 fallback 지원 범위를 정합니다. 마지막 정상값을 쓴다면 그 값의 나이·허용 기한을 드러내고 신규 권한이나 실제 수요로 오인하지 않습니다.

## 안정화 정책과 진동·대응 지연의 절충

짧은 burst마다 축소·확장하면 이미지·캐시·리밸런싱 비용이 반복됩니다. scale down stabilization과 증감 속도 제한은 이를 줄일 수 있지만 비용과 실제 수요 감소 대응을 늦춥니다. scale up에도 지표 잡음·하위 DB 용량을 고려합니다. 긴 관찰 창이 모든 문제의 해결은 아니며 실제 burst를 늦게 감지할 수 있습니다.

Pod를 5에서 20으로 늘리면서 각자 DB 풀 20개를 유지하면 최대 연결 요구가 100에서 400으로 늘 수 있습니다. DB 예산이 고정이면 대기만 악화될 수 있습니다. Pod별 상한과 전체 하위 상한을 같이 정합니다. 같은 workload의 replicas를 여러 autoscaler·GitOps·운영자가 무계획으로 조정하지 않게 소유권을 나눕니다.

## 제어기 추천과 사용자 결과의 동시 검증

부하 step·짧은 burst·지속 증가·지표 누락·초기화 지연·노드 부족·DB 포화를 따로 주입합니다. desired·current·scheduled·Ready와 처리율·가장 오래된 작업·p99·오류를 시간축으로 비교합니다. 현재 작업에서는 HPA를 실행하지 않았으므로 본문은 계산과 실패 정책의 설명이며 실제 확장 성능 보고가 아닙니다.

재현 연습은 4개 Pod, request 500m, 사용량 400m, 목표 50%에서 시작해 단순 추천 7을 계산한 뒤, 새 Pod가 Ready가 되기 전까지 queue age를 기록하는 것입니다. request를 1000m로 바꾸면 같은 400m 사용량의 utilization은 40%로 바뀌므로, 수요가 같아도 HPA 입력과 scheduler 배치가 동시에 달라진다는 결과를 확인할 수 있습니다. 지표 조회 실패를 추가했을 때는 이벤트와 추천값을 함께 읽어 축소 억제 여부를 실제 controller 계약으로 판정해야 합니다.
