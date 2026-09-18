---
id: event-autoscaling
title: KEDA 활성화·Lag·파티션 병렬성의 제어
topic: 인프라
summary: KEDA와 HPA의 역할·activation 경계·ScaledJob 선택을 나누고 Kafka assignment·유휴 consumer·커밋 톱니·지표 실패를 설명합니다.
questionIds: [keda-hpa-role, keda-activation-target-boundaries, keda-scaledjob-scaledobject-lifetime, keda-kafka-partitions, keda-idle-consumer-capacity, kafka-commit-interval-scaling-noise]
---

# KEDA 활성화·Lag·파티션 병렬성의 제어

이벤트 기반 확장은 “메시지가 있다”는 신호를 replica 수로 바꾸는 제어 루프입니다. 활성화, 처리 중 용량, 파티션의 병렬성, commit 지연을 구분해야 scale-out이 실제 메시지 나이와 하위 시스템 건강을 개선하는지 판단할 수 있습니다.

## CPU 지표와 메시지 대기 시간의 불일치

consumer가 DB 응답을 기다리면 CPU는 낮지만 backlog는 늘 수 있습니다. 큐 길이·Kafka lag·메시지 나이 같은 외부 수요 지표가 CPU보다 직접적인 신호일 수 있습니다. 그러나 DB 자체가 병목이면 consumer 증가가 오히려 DB 요청을 더 쌓을 수 있어 실제 처리 경로를 먼저 봅니다.

`ScaledObject`로 장수 consumer를 연결한 경우 KEDA는 구성한 scaler에서 큐나 Kafka 수요를 읽어 0 replica에서 활성화할 조건과 HPA가 사용할 메트릭을 제공하고, 그 구성에 맞춰 HPA를 생성·구성합니다. workload가 활성화된 뒤에는 HPA가 target과 `behavior`를 적용해 replica를 조정하므로, KEDA와 HPA가 같은 수를 따로 쓰며 경쟁하는 것이 아니라 0에서 깨우는 신호와 활성 replica 조정의 경계를 나눕니다.

따라서 별도 HPA를 추가하거나 같은 workload의 replica 필드를 수동으로 바꾸기 전에 어느 controller가 각 값을 소유하는지 확인합니다.

DB 대기로 CPU가 20%인 consumer가 lag를 계속 늘릴 수 있으므로 CPU만으로 scale-out하지 않습니다. 먼저 `arrival rate`, `completed rate`, oldest message age, DB wait, connection usage를 같은 시간축에 놓고 replica 추가가 completed rate를 높이는지 하위 오류를 늘리는지 확인합니다.

## Activation threshold와 scaling target의 제어 경계

| 값 | 주된 질문 | 실패 예 |
| --- | --- | --- |
| activation threshold | 0에서 깨울 만큼 활성인가 | 작은 잔여 backlog가 영원히 남음 |
| scaling target | 활성 replica당 어느 정도 수요를 맡길까 | 비용 다른 메시지를 같은 단위로 오인 |
| min/max replica | 유지·확장의 범위 | 하위 DB 용량과 불일치 |
| polling·cooldown·stabilization | 언제 감지하고 얼마나 유지할까 | cold start 반복 또는 늦은 대응 |

scaler의 활성화 조건이 “50을 초과하면 활성”이라면 backlog가 50 이하인 동안에는 조건을 넘지 않으므로, 다른 활성 조건이 없을 때 0 replica에서 깨어나지 않을 수 있습니다. 이때 `>`인지 `>=`인지, 기본값과 복수 trigger의 결합 방식, 최소 replica가 실제 scaler 버전에서 어떻게 정해지는지 구성과 이벤트를 함께 확인합니다.

작은 메시지 하나도 기한 내 처리해야 하는 서비스라면 activation threshold를 비용 절감만 보고 높이지 말고, 0에서 깨어나는 지연을 SLO와 비교합니다.

```diagram
{"title":"외부 수요를 활성화와 Replica 제어로 나눕니다","caption":"화살표는 일반 ScaledObject의 제어 역할입니다. 대상 workload의 replica 소유자는 충돌 없이 구성하고 별도 수동 HPA를 무작정 추가하지 않습니다.","rows":[[{"id":"source","label":"큐·Kafka 외부 수요"}],[{"id":"keda","label":"KEDA scaler·활성화"}],[{"id":"hpa","label":"HPA target·behavior"}],[{"id":"workload","label":"workload replica·실제 처리"}]],"edges":[{"from":"source","to":"keda","label":"인증된 지표 조회"},{"from":"keda","to":"hpa","label":"외부 메트릭 연결"},{"from":"hpa","to":"workload","label":"수량 조정"},{"from":"keda","to":"workload","label":"0에서 활성화 등"}]}
```

backlog가 50일 때 조건이 `>50`이면 0 replica가 그대로일 수 있고, `>=50`이면 깨울 수 있습니다. 이 한 경계와 활성 뒤 target 경계를 별도 테스트하고, cold start 시간을 메시지 SLO에 포함합니다. 복수 trigger 결합과 기본값은 KEDA 버전에 따라 문서와 이벤트로 확인합니다.

## Kafka partition 할당과 Consumer 수의 병렬성 상한

일반 Kafka consumer group에서 한 partition은 한 시점에 한 consumer에게 할당됩니다. partition 4개와 consumer 8개라면 일부는 할당 없이 유휴일 수 있습니다. Pod당 consumer 수가 하나인지 여러 개인지도 구분합니다. KEDA가 Pod를 늘려도 partition 하나가 자동으로 여러 consumer에게 분할되지 않습니다.

한 hot key가 한 partition에 몰리면 다른 consumer를 늘려도 그 순서 처리 상한은 남습니다. partition별 lag·처리율·assignment·DB 대기를 확인합니다. partition을 늘리는 것은 키 라우팅과 기존·신규 이벤트 순서를 바꿀 수 있는 별도 데이터 계약 변경입니다.

allowIdleConsumers 같은 옵션은 partition 수보다 많은 준비 인스턴스를 허용할 수 있지만 정확한 scaler 조건·버전을 확인합니다. 장애 후 프로세스 시작 시간을 줄일 여지가 있어도 group 조정·할당 지연을 없애지는 않습니다. 유휴 메모리·연결·비용과 실제 failover 이득을 측정합니다.

partition 4개에 consumer 8개를 배치해도 한 partition에는 동시에 한 consumer만 처리합니다. hot key가 한 partition에 몰리면 replica를 더해도 해당 순서 스트림의 처리율이 바뀌지 않으므로 partition별 lag와 key 분포를 먼저 봅니다.

## Lag 톱니와 실제 적체의 구분

consumer가 처리 후 offset을 묶어서 커밋하면 committed offset 기준 lag가 증가하다 한 번에 줄어드는 톱니가 될 수 있습니다. 처리 자체가 매번 멈췄다는 뜻은 아닙니다. 실제 완료율·가장 오래된 미완료 작업·커밋 간격·in-flight를 함께 봅니다.

관찰 창과 안정화로 단순 커밋 파도를 과대 해석하는 진동을 줄일 수 있지만 너무 길면 실제 지속 적체를 늦게 감지합니다. batch·commit 주기·DB 지연을 한 번에 하나씩 바꿔 원인을 분리합니다. 새 group의 committed offset 부재와 earliest/latest 초기 정책도 정상 steady lag와 다른 상황입니다.

확장·축소의 rebalance는 처리 중 레코드·offset·소유권 수명을 바꿉니다. 완료 전 offset을 커밋하지 않고 늦은 결과가 새 소유 상태를 덮지 않게 합니다. 중복 재처리는 업무 멱등 경계로 보호합니다.

처리 후 100건씩 commit하면 committed lag는 계단식으로 줄어들지만 in-flight 작업은 계속 진행 중일 수 있습니다. commit 주기만 줄여 그래프를 매끈하게 만드는 대신 oldest age·completed rate·in-flight·DB 지연을 함께 사용해 지속 적체와 표시 톱니를 분리합니다.

## ScaledJob과 단위 작업의 수명 모델

예를 들어 연결을 오래 유지하며 여러 메시지를 처리하는 Deployment consumer라면 `ScaledObject`가 replica 수를 조정하고, 수요에 따라 작업 하나를 별도 실행 단위로 만들고 싶다면 `ScaledJob`이 Job을 준비하는 모델입니다. 선택할 때는 연결 재사용과 초기화 비용, 작업 길이와 종료 정책을 비교하되, Job 하나가 특정 메시지 하나를 자동으로 정확히 한 번 예약·처리한다고 가정하지 않습니다.

큐에서 작업을 claim하는 시점, ACK를 보내는 시점, 외부 효과를 중복 방지하는 `effect key`는 앱과 broker가 별도로 정의해야 합니다.

진행 중 Job을 어떻게 계수하는지·max replica·스케일링 전략·재시도는 KEDA 버전과 trigger 의미를 확인합니다. visible backlog가 0이어도 실행 중 외부 효과가 남을 수 있으므로 drain·checkpoint·중복 방지가 필요합니다.

Deployment consumer는 연결을 유지하며 여러 record를 처리하는 장수 단위이고, ScaledJob은 Job의 생성·실행·재시도를 조정하는 단위입니다. 어느 모델에서도 claim, effect, ACK의 원자성이 자동으로 생기지 않으므로 effect key와 재전달 정책을 애플리케이션 계약으로 둡니다.

## scaler 지표 장애와 Scale 이득의 독립 검증

scaler의 TLS·권한·group ID·offset 정책·polling을 확인하고 지표 조회 실패를 0 부하로 바꾸지 않습니다. 지원되는 fallback·최소 용량·경보와 제어 소유권을 정합니다. 복구 직후 급격한 증감이 하위 시스템을 압박하지 않는지도 봅니다.

테스트는 작은 잔여 backlog·burst·hot partition·유휴 consumer·커밋 톱니·새 group·인증 오류를 나눕니다. replica 증가보다 메시지 나이·처리율·재전달·DB 오류가 개선됐는지가 기준입니다. 현재 작업에서 KEDA·Kafka를 실행하지 않았으므로 본문은 제어 계약과 검증 설계입니다.

scaler 인증 오류를 backlog 0으로 기록하면 가장 위험한 조용한 축소가 됩니다. 지표 조회 실패, 새 group, 작은 backlog, burst, hot partition을 별도 입력으로 넣고 fallback replica·경보·하위 DB 보호가 예상대로 작동하는지 확인합니다. KEDA·Kafka를 이 환경에서 실행하지 않았으므로 본문은 검증 설계입니다.
