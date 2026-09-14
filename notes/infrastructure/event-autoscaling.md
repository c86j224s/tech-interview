---
id: event-autoscaling
title: KEDA 활성화·Lag·파티션 병렬성의 제어
topic: 인프라
summary: KEDA와 HPA의 역할·activation 경계·ScaledJob 선택을 나누고 Kafka assignment·유휴 consumer·커밋 톱니·지표 실패를 설명합니다.
questionIds: [keda-hpa-role, keda-activation-target-boundaries, keda-scaledjob-scaledobject-lifetime, keda-kafka-partitions, keda-idle-consumer-capacity, kafka-commit-interval-scaling-noise]
---

# KEDA 활성화·Lag·파티션 병렬성의 제어

## CPU가 낮아도 메시지가 오래 기다릴 수 있습니다

consumer가 DB 응답을 기다리면 CPU는 낮지만 backlog는 늘 수 있습니다. 큐 길이·Kafka lag·메시지 나이 같은 외부 수요 지표가 CPU보다 직접적인 신호일 수 있습니다. 그러나 DB 자체가 병목이면 consumer 증가가 오히려 DB 요청을 더 쌓을 수 있어 실제 처리 경로를 먼저 봅니다.

일반적인 ScaledObject 구성에서 KEDA는 외부 scaler로 이벤트를 읽고 활성화와 HPA 메트릭을 연결하며 HPA를 생성·구성합니다. HPA는 활성 workload의 메트릭 target과 behavior를 바탕으로 replica를 조정합니다. 두 제어기가 무계획으로 독립 경쟁하는 구조가 아니라 역할을 나누는 구성입니다.

## Activation과 Target은 서로 다른 문턱입니다

| 값 | 주된 질문 | 실패 예 |
| --- | --- | --- |
| activation threshold | 0에서 깨울 만큼 활성인가 | 작은 잔여 backlog가 영원히 남음 |
| scaling target | 활성 replica당 어느 정도 수요를 맡길까 | 비용 다른 메시지를 같은 단위로 오인 |
| min/max replica | 유지·확장의 범위 | 하위 DB 용량과 불일치 |
| polling·cooldown·stabilization | 언제 감지하고 얼마나 유지할까 | cold start 반복 또는 늦은 대응 |

scaler가 “50을 초과하면 활성”이라는 계약을 가진 예에서 backlog=50 이하이고 다른 활성 조건도 없으면 0에서 깨어나지 않을 수 있습니다. 비교가 초과인지 이상인지·기본값·복수 trigger 결합·최소 replica는 실제 scaler 버전에서 확인합니다. 작은 메시지 한 개도 기한 내 처리해야 한다면 activation을 비용 최적화 숫자만 보고 높이지 않습니다.

```diagram
{"title":"외부 수요를 활성화와 Replica 제어로 나눕니다","caption":"화살표는 일반 ScaledObject의 제어 역할입니다. 대상 workload의 replica 소유자는 충돌 없이 구성하고 별도 수동 HPA를 무작정 추가하지 않습니다.","rows":[[{"id":"source","label":"큐·Kafka 외부 수요"}],[{"id":"keda","label":"KEDA scaler·활성화"}],[{"id":"hpa","label":"HPA target·behavior"}],[{"id":"workload","label":"workload replica·실제 처리"}]],"edges":[{"from":"source","to":"keda","label":"인증된 지표 조회"},{"from":"keda","to":"hpa","label":"외부 메트릭 연결"},{"from":"hpa","to":"workload","label":"수량 조정"},{"from":"keda","to":"workload","label":"0에서 활성화 등"}]}
```

## Kafka의 할당 단위가 Consumer 수의 이득을 제한합니다

일반 Kafka consumer group에서 한 partition은 한 시점에 한 consumer에게 할당됩니다. partition 4개와 consumer 8개라면 일부는 할당 없이 유휴일 수 있습니다. Pod당 consumer 수가 하나인지 여러 개인지도 구분합니다. KEDA가 Pod를 늘려도 partition 하나가 자동으로 여러 consumer에게 분할되지 않습니다.

한 hot key가 한 partition에 몰리면 다른 consumer를 늘려도 그 순서 처리 상한은 남습니다. partition별 lag·처리율·assignment·DB 대기를 확인합니다. partition을 늘리는 것은 키 라우팅과 기존·신규 이벤트 순서를 바꿀 수 있는 별도 데이터 계약 변경입니다.

allowIdleConsumers 같은 옵션은 partition 수보다 많은 준비 인스턴스를 허용할 수 있지만 정확한 scaler 조건·버전을 확인합니다. 장애 후 프로세스 시작 시간을 줄일 여지가 있어도 group 조정·할당 지연을 없애지는 않습니다. 유휴 메모리·연결·비용과 실제 failover 이득을 측정합니다.

## Lag의 톱니와 진짜 적체를 구분합니다

consumer가 처리 후 offset을 묶어서 커밋하면 committed offset 기준 lag가 증가하다 한 번에 줄어드는 톱니가 될 수 있습니다. 처리 자체가 매번 멈췄다는 뜻은 아닙니다. 실제 완료율·가장 오래된 미완료 작업·커밋 간격·in-flight를 함께 봅니다.

관찰 창과 안정화로 단순 커밋 파도를 과대 해석하는 진동을 줄일 수 있지만 너무 길면 실제 지속 적체를 늦게 감지합니다. batch·commit 주기·DB 지연을 한 번에 하나씩 바꿔 원인을 분리합니다. 새 group의 committed offset 부재와 earliest/latest 초기 정책도 정상 steady lag와 다른 상황입니다.

확장·축소의 rebalance는 처리 중 레코드·offset·소유권 수명을 바꿉니다. 완료 전 offset을 커밋하지 않고 늦은 결과가 새 소유 상태를 덮지 않게 합니다. 중복 재처리는 업무 멱등 경계로 보호합니다.

## ScaledJob은 단위 작업의 수명 모델입니다

ScaledObject는 장수 Deployment consumer 등의 replica를 조정하고, ScaledJob은 수요에 따라 Job 실행 단위를 준비하는 모델입니다. 연결 재사용·초기화 비용·작업 길이·종료 정책으로 고릅니다. Job 하나가 특정 메시지 한 개를 자동으로 정확히 한 번 예약·처리하는 것은 아닙니다. 실제 큐 claim·ACK·effect key는 앱과 broker의 책임입니다.

진행 중 Job을 어떻게 계수하는지·max replica·스케일링 전략·재시도는 KEDA 버전과 trigger 의미를 확인합니다. visible backlog가 0이어도 실행 중 외부 효과가 남을 수 있으므로 drain·checkpoint·중복 방지가 필요합니다.

## 지표 장애와 Scale 이득을 분리해 검증합니다

scaler의 TLS·권한·group ID·offset 정책·polling을 확인하고 지표 조회 실패를 0 부하로 바꾸지 않습니다. 지원되는 fallback·최소 용량·경보와 제어 소유권을 정합니다. 복구 직후 급격한 증감이 하위 시스템을 압박하지 않는지도 봅니다.

테스트는 작은 잔여 backlog·burst·hot partition·유휴 consumer·커밋 톱니·새 group·인증 오류를 나눕니다. replica 증가보다 메시지 나이·처리율·재전달·DB 오류가 개선됐는지가 기준입니다. 현재 작업에서 KEDA·Kafka를 실행하지 않았으므로 본문은 제어 계약과 검증 설계입니다.
