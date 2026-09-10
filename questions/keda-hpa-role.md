---
id: keda-hpa-role
title: "CPU는 낮아도 Kafka lag가 쌓이는 소비자 서비스를 확장하려 합니다. KEDA와 HPA는 어떤 지표와 제어를 각각 맡으며 Pod 수를 어떻게 바꾸나요?"
difficulty: 하
category: 인프라
tags: ["KEDA","HPA","자동 확장"]
related: ["k8s-hpa-scaling","kafka-lag-interpretation"]
---

# CPU는 낮아도 Kafka lag가 쌓이는 소비자 서비스를 확장하려 합니다. KEDA와 HPA는 어떤 지표와 제어를 각각 맡으며 Pod 수를 어떻게 바꾸나요?

## 구두 답변

HPA(메트릭에 따라 workload의 replica 수를 조절하는 Kubernetes 컨트롤러)는 목표 메트릭과 현재 메트릭의 차이를 바탕으로 Pod 수를 바꿉니다. KEDA(외부 이벤트 신호를 Kubernetes 확장에 연결하는 도구)는 Kafka lag·큐 길이·외부 이벤트 소스를 읽어 확장 메트릭을 제공하고, ScaledObject(어떤 workload를 어떤 신호로 확장할지 적는 KEDA 설정)에 따라 0개에서 활성화되는 단계까지 연결합니다. 일반적인 ScaledObject에서는 KEDA가 HPA를 생성·구성해 함께 동작하므로 같은 Deployment를 두 autoscaler가 무계획으로 동시에 수정하는 구조와 다릅니다.

큐 소비자는 CPU 사용률이 낮아도 메시지가 쌓일 수 있어 lag가 직접적인 신호가 될 수 있습니다. 하지만 메시지별 비용·파티션 수·하위 DB 용량이 다르면 단일 lag 목표가 실제 처리 시간을 대표하지 못합니다. 가벼운 메시지 1,000개와 외부 결제를 수행하는 메시지 1,000개는 같은 lag라도 필요한 Pod 수와 회복 시간이 다릅니다. scaler가 메트릭을 읽을 권한, polling 주기, 인증, 실패 시 동작을 확인하고, 다른 HPA가 같은 target을 제어하지 않는지 점검하겠습니다.

설정에서 활성화 임계값, 확장 목표 값, min/max replica, cooldown·stabilization을 분리해 정합니다. 메트릭 소스 장애와 큐 버스트를 따로 시험해 과도한 scale up/down, 0에서의 첫 처리 지연, 지표 실패 시 안전한 fallback(대체 동작)을 확인하겠습니다. 메시지를 처리하고 ACK(처리 완료 확인)를 보내는 시점도 확장 지표와 함께 기록하겠습니다. KEDA는 소비 코드의 처리 속도를 높이는 기능이 아니라 이벤트 신호를 확장 제어로 연결하는 기능입니다.

## 득점 포인트

- HPA의 replica 제어와 KEDA의 이벤트 신호·활성화를 구분한다.
- lag 대표성·권한·polling·동시 autoscaler 충돌을 점검한다.
- 활성화와 확장 목표 및 안정화 설정을 서로 다른 정책으로 설명한다.

## 감점 포인트

- KEDA가 HPA와 무관한 별도 확장기로 항상 동시에 제어한다고 말한다.
- 큐 길이가 메시지별 처리 비용과 회복 시간을 언제나 정확히 대표한다고 말한다.
- 같은 workload에 여러 autoscaler를 무조건 붙인다.

## 더 파고들 거리

- ScaledObject와 ScaledJob은 장수 consumer와 단위 작업의 수명에서 어떻게 다른가요?
- 외부 메트릭 수집 실패 시 replica를 유지·축소·확대 중 어떻게 선택할까요?
- activation threshold와 HPA target value를 버스트와 steady state 관점에서 어떻게 나눌까요?
