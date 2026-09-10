---
id: k8s-requests-limits
title: "Kubernetes에서 컨테이너에 requests와 limits를 설정합니다. 노드 배치와 CPU·메모리 초과 처리에는 각각 어떻게 쓰이나요?"
answerMinutes: 5
followups: [{"id":"k8s-oom-throttling","prompt":"한 컨테이너는 OOMKilled이고 다른 컨테이너는 느려졌다면 메모리 압력과 CPU throttling을 어떤 지표·이벤트로 분리하겠습니까?"},{"id":"k8s-hpa-scaling","prompt":"request를 낮춘 뒤 CPU HPA가 더 자주 확장한다면 실제 처리량과 Pod 경쟁이 좋아졌는지 어떤 기준으로 판정하겠습니까?"},{"id":"bounded-queue-backpressure","prompt":"requests를 높여 Pending Pod가 생기는 대신 실행 대기열을 두려 한다면 노드 비용과 대기 상한을 어떻게 비교하겠습니까?"}]
difficulty: 하
category: 인프라
tags: ["Kubernetes","requests","limits"]
related: ["bounded-queue-backpressure"]
---

# Kubernetes에서 컨테이너에 requests와 limits를 설정합니다. 노드 배치와 CPU·메모리 초과 처리에는 각각 어떻게 쓰이나요?

## 구두 답변

`requests`는 스케줄러가 Pod를 어느 노드에 배치할지 계산할 때 필요한 자원의 기준이고, `limits`는 실행 중 컨테이너가 사용할 수 있는 상한입니다. request를 최대 사용량으로 보면 안 되고, limit를 실제 성능 보장량으로 오해해서도 안 됩니다. CPU와 메모리는 한도에 닿았을 때의 동작이 다르므로 각각 나눠 봐야 합니다.

예를 들어 컨테이너가 CPU request 500m, limit 1이라고 하면 scheduler는 우선 500m를 확보할 수 있는 노드를 찾고, 실행 중에는 구성에 따라 1 CPU까지 사용할 수 있습니다. 다른 Pod와 경쟁하지 않아도 설정된 CPU 할당 주기의 quota를 소진하면 제한을 받을 수 있습니다. CPU가 상한 때문에 실행 시간을 배분받지 못하는 **스로틀링**(throttling)으로 처리량과 지연이 나빠질 수 있습니다. 메모리는 CPU처럼 느리게 나눠 실행할 수 없어서 사용량이 limit를 넘으면 컨테이너가 OOMKilled로 종료될 수 있습니다.

### 배치 기준과 실행 상한을 분리합니다

request를 실제 평균 사용량보다 지나치게 낮추면 많은 Pod가 한 노드에 몰려 정상 피크 때 CPU 경쟁과 메모리 압력이 커집니다. 너무 높이면 실제로는 여유가 있어도 Pending이 되고, Karpenter가 더 큰 노드를 고르거나 확장 비용이 커집니다. request는 평소 평균 하나가 아니라 시작 초기화, 캐시 예열, GC, 배치 작업, 트래픽 피크를 포함한 용량 모델로 정하겠습니다. limit가 없다고 노드 자원이 무한한 것도 아니며, limit가 있다고 request만큼 항상 빠르게 실행된다는 보장도 없습니다.

CPU limit는 짧은 burst를 허용할지, 긴 작업에서 throttling을 어느 정도 감수할지를 보고 정합니다. 메모리 limit는 컨테이너가 정상적으로 필요한 working set과 순간적인 할당·GC·캐시 상한을 포함해야 합니다. 너무 낮으면 정상적인 메모리 피크가 OOM을 만들고, 너무 높으면 한 노드에 배치된 Pod들의 합이 노드 용량을 압박해 eviction과 시스템 장애가 커질 수 있습니다. 컨테이너가 여러 개인 Pod에서는 각 컨테이너의 request와 limit가 Pod의 배치·QoS 판단에 함께 반영됩니다.

### autoscaling과 품질 지표를 함께 봅니다

HPA의 CPU utilization이 request 대비 비율로 계산되면 request 변경은 확장 민감도도 바꿉니다. 동일한 실제 CPU 사용량이라도 request를 낮추면 utilization이 높아져 더 빨리 scale up할 수 있습니다. 따라서 request·limit·HPA target을 독립적으로 숫자만 맞추지 않고, 원하는 Pod 수·처리량·p95 지연과 연결해 검증하겠습니다. CPU quota 소진은 throttling 지표로, 실제 CPU 경쟁은 run queue·스케줄 지연으로 구분하고 p99 지연과 함께, 메모리 압력은 working set·OOMKilled·eviction·GC와 함께 확인합니다.

실제 설정은 컨테이너별로 계산하되, 사이드카가 로그나 프록시를 처리하는 경우 그 자원도 빠뜨리지 않습니다. 테스트에서는 CPU 경쟁을 만드는 다른 Pod를 함께 배치하고, 메모리 피크·GC·캐시 예열·노드 압력을 각각 주입합니다. request가 배치에 어떤 영향을 주고 limit 초과가 어떤 복구 행동을 유발하는지 확인해야 숫자의 의미를 알 수 있습니다. 즉 requests는 **예약 기준**(scheduling request), limits는 **실행 상한**(execution limit)이라는 서로 다른 계약입니다.

## 득점 포인트

- requests의 스케줄링 기준과 limits의 실행 상한을 분리해 설명한다.
- CPU throttling과 메모리 OOM·eviction의 초과 동작 차이를 구체적으로 연결한다.
- 피크·예열·GC·사이드카와 HPA request 기반 지표를 함께 측정한다.

## 감점 포인트

- request를 컨테이너가 사용할 수 있는 최대 자원이라고 말한다.
- CPU와 메모리가 한도 초과 때 동일하게 대기하거나 동일한 방식으로 종료된다고 설명한다.
- 평균 사용량 하나만으로 limit를 정하고 OOM·throttling 검증을 생략한다.

## 더 파고들 거리

- QoS 클래스와 node memory pressure가 eviction 우선순위에 어떤 영향을 주는지 설명해 보세요.
- CPU request가 없거나 부정확할 때 utilization 기반 HPA의 입력이 어떻게 흔들릴까요.
- 사이드카의 로그 폭주가 애플리케이션 Pod의 배치와 OOM에 미치는 영향을 어떻게 측정할까요.
