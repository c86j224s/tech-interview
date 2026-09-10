---
id: keda-hpa-role
title: "CPU는 낮아도 Kafka lag가 쌓이는 소비자 서비스를 확장하려 합니다. KEDA와 HPA는 어떤 지표와 제어를 각각 맡으며 Pod 수를 어떻게 바꾸나요?"
answerMinutes: 5
followups: [{"id":"keda-kafka-partitions","prompt":"KEDA가 lag를 보고 partition 수보다 많은 Pod를 만들었다면 유휴 consumer와 hot partition을 어떤 지표로 구분하겠습니까?"},{"id":"k8s-hpa-scaling","prompt":"KEDA가 desired replica를 늘렸지만 Pod가 Pending인 동안 lag와 메시지 나이를 어떻게 보호하겠습니까?"},{"id":"kafka-lag-interpretation","prompt":"전체 lag는 커졌지만 한 partition만 뜨겁다면 consumer 수를 늘리기 전에 처리 비용과 키 분포를 어떻게 확인하겠습니까?"}]
difficulty: 하
category: 인프라
tags: ["KEDA","HPA","자동 확장"]
related: ["k8s-hpa-scaling","kafka-lag-interpretation"]
---

# CPU는 낮아도 Kafka lag가 쌓이는 소비자 서비스를 확장하려 합니다. KEDA와 HPA는 어떤 지표와 제어를 각각 맡으며 Pod 수를 어떻게 바꾸나요?

## 구두 답변

CPU가 낮은데 Kafka lag가 쌓인다면 이벤트 신호를 확장 입력으로 검토하되, 하위 DB 병목이라면 추가 확장이 오히려 부하를 키울 수 있습니다. HPA는 목표 메트릭과 현재 메트릭을 비교해 workload의 replica 수를 조정하는 Kubernetes controller이고, KEDA는 Kafka lag·큐 길이 같은 외부 이벤트 소스를 읽어 확장 메트릭과 활성화 신호를 제공합니다. 일반적인 `ScaledObject` 구성에서는 KEDA가 HPA를 생성·구성해 함께 동작하므로, 같은 Deployment를 두 autoscaler가 무계획으로 동시에 수정하는 구조와는 다릅니다.

메시지 consumer는 CPU를 많이 계산하지 않고 DB나 외부 API를 기다릴 수 있어 CPU utilization이 낮아도 lag가 증가합니다. 이때 KEDA가 lag를 읽어 desired replica 계산에 반영할 수 있습니다. 다만 lag 1,000이라는 숫자가 항상 같은 처리 시간을 뜻하지는 않습니다. 가벼운 조회 메시지와 결제·백필 메시지는 처리 비용이 다르고, 파티션 수와 하위 DB 용량이 실제 병렬성 상한을 결정합니다. 그래서 lag를 사용하더라도 메시지 나이, 파티션별 lag, 처리율, ACK 지연, 하위 자원 포화를 함께 보겠습니다.

### 이벤트 감지와 replica 제어를 나눕니다

KEDA는 scaler가 Kafka에 접근해 lag를 읽고, 활성화 임계값을 넘으면 0에서 workload를 깨우는 흐름과 HPA가 사용할 메트릭을 연결합니다. HPA는 그 메트릭과 target value, min·max replica, stabilization 정책을 바탕으로 수를 계산합니다. **활성화**(activation)는 0에서 첫 Pod를 시작할지 판단하는 정책이고, **확장 목표**(scaling target)는 이미 실행 중인 Pod 수를 어느 정도로 유지할지 판단하는 정책입니다. 둘을 같은 숫자 하나로 이해하면 짧은 버스트와 steady state를 다르게 다룰 수 없습니다.

예를 들어 활성화 임계값이 50이고 그 이하의 잔여 메시지로 다른 활성화 조건도 없다면 0개 상태에서 깨어나지 않을 수 있습니다. 따라서 작은 잔여 작업도 제때 처리해야 한다면 임계값을 높게 두어서는 안 됩니다. 50을 넘으면 활성화한다는 정책을 선택했다면, 각 consumer가 초당 10개를 처리하며 메시지 나이를 30초 아래로 유지하도록 target을 정할 수 있습니다. 그러나 파티션이 3개면 Pod를 10개로 늘려도 같은 group에서 동시에 일할 consumer는 제한됩니다. KEDA가 유휴 consumer를 미리 띄우는 옵션을 제공하더라도 한 partition을 여러 consumer가 동시에 처리하도록 바꾸지는 않습니다.

### 메트릭 실패와 안정화 정책을 검증합니다

scaler가 Kafka를 읽을 권한, bootstrap 주소, TLS·인증, consumer group 식별자, polling interval을 확인하겠습니다. 메트릭 수집이 실패했을 때 replica를 유지할지, 보수적으로 확장할지, 잘못 축소하지 않을지 시스템의 실제 동작을 시험합니다. 다른 HPA나 수동 배포 파이프라인이 같은 target의 replica를 수정하면 값이 진동할 수 있으므로 단일 제어 소유자를 정합니다.

lag가 잠깐 증가할 때 즉시 scale up하고 곧바로 scale down하면 리밸런싱·Pod 초기화 비용이 반복됩니다. cooldown과 stabilization window를 메시지 burst와 Pod 준비 시간에 맞춥니다. scale-to-zero라면 scaler 감지, Pod 스케줄, 노드 공급, 이미지·consumer 연결, 첫 ACK까지의 cold start도 포함합니다.

검증은 CPU가 낮은 하위 DB 대기, 파티션별 hot spot, 짧은 burst, scaler 권한 오류, Kafka 연결 지연을 나눠 주입합니다. Pod 수가 늘었는지가 아니라 가장 오래된 메시지의 나이와 실제 처리율, 중복·재전달, 하위 시스템 오류율이 개선됐는지 봅니다. KEDA는 처리 코드를 빠르게 하는 기능이 아니라 외부 이벤트를 **자동 확장 제어**(event-driven autoscaling)에 연결하는 계층입니다.

## 득점 포인트

- HPA의 replica 제어와 KEDA의 외부 이벤트 감지·0에서의 활성화를 구분한다.
- lag의 대표성 한계, partition 병렬성, 하위 DB 포화와 메시지 나이를 함께 본다.
- scaler 권한·polling·메트릭 실패·cooldown·stabilization을 실제 검증 항목으로 제시한다.

## 감점 포인트

- KEDA와 HPA가 같은 Deployment를 언제나 독립적으로 동시에 조정한다고 말한다.
- lag가 크면 메시지 비용·partition 수와 무관하게 Pod를 계속 늘리면 된다고 설명한다.
- 활성화 임계값과 steady-state target, scale-to-zero cold start를 구분하지 않는다.

## 더 파고들 거리

- ScaledObject와 ScaledJob을 장수 consumer와 단위 작업의 수명·재처리 기준으로 비교해 보세요.
- 외부 메트릭 수집 실패 때 replica 유지·확대·축소 중 어떤 선택이 안전한지 장애 비용으로 판단해 보세요.
- activation threshold와 HPA target을 짧은 burst와 지속 부하에 맞춰 어떻게 분리할까요.
