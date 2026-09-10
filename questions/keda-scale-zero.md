---
id: keda-scale-zero
title: "KEDA로 consumer Deployment를 0 replica까지 줄였다가 첫 메시지를 처리할 때 지연은 어디에서 생기나요?"
answerMinutes: 5
followups: [{"id":"karpenter-node-provisioning","prompt":"scale-to-zero 상태에서 Pod를 깨우려면 새 노드도 필요할 때 NodeClaim부터 첫 ACK까지 어떤 상태와 시간을 계측하겠습니까?"},{"id":"k8s-probe-contract","prompt":"consumer 프로세스는 실행됐지만 broker assignment가 끝나지 않았다면 startup과 readiness의 성공 조건을 어떻게 나누겠습니까?"},{"id":"keda-hpa-role","prompt":"대기 lag와 처리 중 메시지를 구분할 수 있다면 KEDA의 활성화·scale-down 조건을 어떤 방식으로 바꾸겠습니까?"}]
difficulty: 중하
category: 인프라
tags: ["KEDA","scale to zero","콜드 스타트"]
related: ["keda-hpa-role","k8s-hpa-scaling"]
---

# KEDA로 consumer Deployment를 0 replica까지 줄였다가 첫 메시지를 처리할 때 지연은 어디에서 생기나요?

## 구두 답변

consumer Deployment가 0 replica이면 메시지를 처리할 Pod가 없으므로, 첫 이벤트를 감지한 뒤 replica를 활성화하고 Pod를 스케줄·시작·준비시키는 시간이 필요합니다. 노드도 0으로 줄어든 상태라면 NodeClaim 생성과 인스턴스 부팅, CNI·CSI·DaemonSet 준비까지 추가됩니다. 따라서 첫 메시지 지연은 polling interval 하나가 아니라 감지, Pod·노드 준비, 이미지 다운로드, 애플리케이션 초기화, Kafka 연결과 첫 ACK까지의 합으로 측정해야 합니다. 이 유휴 상태에서 첫 작업을 시작하기까지의 지연을 **콜드 스타트**(cold start)라고 부릅니다.

예를 들어 메시지가 큐에 남아 있어 KEDA가 다음 polling에서 lag를 확인했다고 하겠습니다. KEDA가 desired replica를 1로 바꿔도 Pod는 Pending일 수 있고, 노드가 준비돼도 consumer가 브로커 인증과 partition assignment를 끝내지 못할 수 있습니다. 프로세스가 떠 있다는 이유만으로 readiness를 성공시키면 첫 메시지가 준비 전 처리되어 실패하거나 곧바로 재전달될 수 있습니다. readiness에는 실제 준비 상태를 반영하되, readiness 실패가 브로커의 pull 소비를 자동으로 막지는 않습니다. 소비 코드 자체가 초기화와 assignment 완료 후 fetch·처리를 시작하게 해야 합니다.

### 지연 구간을 각각 측정합니다

관찰할 시각을 이벤트가 큐에 들어온 시점, scaler가 lag를 감지한 시점, HPA·Deployment desired 변경, Pod 생성, Pending 해소, Node Ready, 컨테이너 시작, consumer 연결·assignment 완료, readiness 성공, 메시지 처리 시작, 외부 효과 커밋과 ACK로 나누겠습니다. 이 타임라인이 있어야 polling이 느린지, 노드 공급이 느린지, 이미지·초기화가 느린지, 첫 처리 자체가 느린지 구분할 수 있습니다. 단일 평균보다 긴 유휴 후 첫 메시지, 짧은 burst, 여러 메시지의 동시 활성화를 각각 측정합니다.

노드가 이미 따뜻하면 Pod와 앱 초기화만 비용으로 남고, 노드도 scale-to-zero라면 Karpenter 같은 공급기의 지연이 추가됩니다. 이미지 pre-pull, 최소 warm Pod, 최소 warm node, 더 빠른 초기화, 항상 1개 consumer 유지 중 어떤 것이 필요한지는 메시지 허용 지연과 비용으로 결정하겠습니다. 실시간 사용자 요청과 수 초 지연을 허용하는 비동기 작업에 같은 정책을 적용하지 않습니다.

### scale down은 처리 중 상태를 고려합니다

lag가 0이 됐다는 것만 보고 즉시 0으로 줄이면 아직 처리 중인 메시지나 커밋 전 외부 효과가 남아 있을 수 있습니다. 대기 메시지와 처리 중 메시지, 마지막 ACK 시각, consumer heartbeat를 분리해 종료 조건을 정하겠습니다. 종료 중에는 새 fetch를 멈추고 진행 중 작업의 완료·재전달·checkpoint를 처리해야 합니다. 긴 작업은 Deployment consumer를 강제로 줄이는 것보다 ScaledJob 같은 단위 작업 모델이 적합할 수 있지만, 어느 경우에도 외부 효과의 멱등성과 종료 유예가 필요합니다.

짧은 burst가 반복되면 scale-to-zero와 재기동이 진동해 cold start가 매번 발생합니다. cooldown, stabilization window, minReplica를 burst 간격과 초기화 시간에 맞춰 둡니다. scaler가 Kafka를 읽지 못하면 큐가 쌓여도 깨우지 못할 수 있으므로 인증·권한·메트릭 장애 경보와 보수적인 fallback을 검증합니다. 성공 기준은 비용 절감만이 아니라 첫 메시지의 p95/p99 처리 지연, 재전달·유실, readiness 전 오류, 노드 공급 실패와 회복 시간을 함께 만족하는 것입니다.

## 득점 포인트

- 0 replica에서 첫 ACK까지 감지·Pod·노드·초기화의 지연을 단계별로 설명한다.
- Pod scale-to-zero와 node scale-to-zero, warm capacity·pre-pull의 비용을 구분한다.
- 처리 중 메시지·ACK·readiness·cooldown을 scale-down 안전 조건과 연결한다.

## 감점 포인트

- 0에서 첫 처리가 polling interval 뒤 즉시 시작된다고 말한다.
- Pod가 Running이면 consumer assignment와 메시지 처리 준비도 끝났다고 가정한다.
- 실시간 요청과 비동기 consumer에 같은 scale-to-zero 지연 정책을 적용한다.

## 더 파고들 거리

- 대기 메시지와 처리 중 메시지를 분리한 지표가 scale-down과 종료 유예를 어떻게 바꾸는지 설명해 보세요.
- 노드 공급이 느릴 때 warm Pod와 warm node 중 무엇을 유지할지 비용·지연으로 비교해 보세요.
- ScaledJob의 단위 작업 수명과 Deployment consumer의 장수 연결을 종료·재처리 기준으로 비교해 보세요.
