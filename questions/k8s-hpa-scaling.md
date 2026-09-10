---
id: k8s-hpa-scaling
title: "Kubernetes HPA의 목표 replica 수는 늘었는데 응답 지연이 그대로입니다. 새 Pod의 준비 상태와 실제 병목을 어떻게 확인하나요?"
answerMinutes: 5
followups: [{"id":"k8s-requests-limits","prompt":"CPU 기반 HPA의 request를 절반으로 낮추자는 제안이 나왔을 때 배치·QoS·확장 판단에 어떤 변화를 예상하겠습니까?"},{"id":"bounded-queue-backpressure","prompt":"HPA가 준비되기 전 요청이 계속 유입된다면 대기열의 실행 수와 대기 상한을 어떻게 정해 장애 전파를 막겠습니까?"},{"id":"keda-hpa-role","prompt":"CPU는 낮고 Kafka lag만 증가한다면 HPA 입력을 이벤트 메트릭으로 바꾸고도 확인해야 할 병목은 무엇입니까?"}]
difficulty: 중하
category: 인프라
tags: ["Kubernetes","HPA","자동 확장"]
related: ["k8s-requests-limits","bounded-queue-backpressure"]
---

# Kubernetes HPA의 목표 replica 수는 늘었는데 응답 지연이 그대로입니다. 새 Pod의 준비 상태와 실제 병목을 어떻게 확인하나요?

## 구두 답변

HPA의 desired replica 수가 늘었다는 것은 컨트롤러가 더 많은 복제본을 원한다는 뜻이지, 그 수만큼 즉시 요청 처리 용량이 생겼다는 뜻은 아닙니다. 새 Pod가 스케줄되지 않았거나 이미지 다운로드·초기화·readiness를 통과하지 못하면 current와 ready replica는 낮게 남습니다. 먼저 desired·current·ready를 분리해 보고, CPU나 메모리 같은 입력 지표가 실제 병목과 연결되는지 확인하겠습니다.

CPU 이용률이 높고 처리량이 Pod 수에 비례하는 무상태 API라면 CPU 기반 HPA가 적절할 수 있습니다. 그러나 DB 연결 풀 대기, 외부 API 대기, 단일 파티션, 특정 캐시 키, 전역 락이 병목이면 CPU가 낮은데도 지연이 커질 수 있습니다. 이때 Pod를 계속 늘리면 DB 연결과 하위 요청만 폭증시킬 수 있습니다. 요청 지연을 큐 대기·애플리케이션 계산·DB·외부 호출으로 나누고, 어느 구간이 replica 증가에도 줄지 않는지 보겠습니다.

### 제어 신호와 실제 용량을 나눕니다

HPA는 주기적으로 메트릭을 읽어 목표와 현재 비율을 비교하고 replica를 조정하는 **제어 루프**(control loop)입니다. 메트릭 수집, replica 반영, 스케줄링, 컨테이너 시작, readiness 전파에 시간이 걸립니다. 부하가 급증하는 동안 desired가 10이어도 ready가 3이면 실제 서비스가 감당할 수 있는 요청은 3개 기준으로 봐야 합니다. Pending Pod라면 `kubectl describe pod`의 스케줄링 이유, 노드 여유, requests, affinity·taint를 확인하고, 노드가 없으면 Karpenter나 다른 노드 공급의 준비 시간도 분리해 측정합니다. 이미지가 크거나 캐시 예열이 길면 새 Pod 수보다 준비 지연이 병목입니다.

CPU utilization이 request 대비 비율로 계산되는 구성에서는 request를 바꾸는 것만으로 HPA 입력이 달라질 수 있습니다. request를 실제 필요한 용량보다 작게 잡으면 같은 CPU 사용량이 높은 비율로 보이고 확장이 과해질 수 있으며, 크게 잡으면 반대로 확장이 늦어질 수 있습니다. 외부 메트릭을 함께 쓰면 메트릭 누락·오류 시 HPA가 어떤 보수적 동작을 하는지와 여러 메트릭 결과를 어떻게 합치는지도 확인하겠습니다.

### 확장이 병목을 옮기지 않는지 봅니다

DB가 최대 50개의 동시 쿼리만 안정적으로 처리하는데 Pod를 5개에서 20개로 늘리면 연결 풀이 먼저 포화될 수 있습니다. 이 경우 Pod별 동시성, 전체 큐 상한, DB 연결 수, 쿼리 대기, 오류율을 함께 제한해야 합니다. CPU가 낮은 대기형 소비자는 CPU HPA보다 queue length나 Kafka lag 같은 처리 수요 신호가 더 직접적일 수 있지만, 메시지별 처리 비용이 다르면 단순 lag 하나로 용량을 계산해서는 안 됩니다.

scale down은 비용과 안정화의 균형 문제입니다. 짧은 부하 변동마다 Pod를 줄였다 늘리면 이미지·캐시 예열을 반복하고 지연이 튈 수 있으므로 stabilization window, 확장·축소 속도 정책, minReplicas를 부하 패턴과 준비 시간에 맞춥니다. 검증은 부하 증가 속도, 노드 부족, DB 포화, readiness 지연, 메트릭 장애를 각각 재현하고 desired부터 실제 처리량·p95/p99 지연·오류율까지 연결해 봅니다. HPA 성공 기준은 replica 숫자가 아니라 병목 구간이 완화되고 준비된 용량이 사용자 목표를 만족하는지입니다.

## 득점 포인트

- desired·current·ready replica를 분리하고 Pending·초기화·readiness 지연을 실제 용량과 연결한다.
- CPU 신호가 DB·외부 호출·단일 키 병목을 대표하지 못할 수 있음을 설명한다.
- HPA 제어 지연과 scale down 안정화, 전체 대기열·하위 자원 한도를 함께 검증한다.

## 감점 포인트

- desired replica가 늘면 같은 순간 처리 용량도 늘어난다고 말한다.
- CPU가 낮다는 이유만으로 확장이 불필요하다고 단정한다.
- HPA를 빠르게 scale down하면 비용과 지연이 항상 개선된다고 가정한다.

## 더 파고들 거리

- 외부 메트릭 수집이 끊겼을 때 HPA의 실제 replica 변화와 안전한 fallback을 어떻게 확인할까요.
- 예열 중 Pod의 CPU가 높아 목표 계산을 흔들 때 initialization과 측정 창을 어떻게 분리할까요.
- 동일 Deployment에 수동 replica 변경과 여러 autoscaler가 붙었을 때 필드 책임을 어떻게 정리할까요.
