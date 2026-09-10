---
id: karpenter-node-provisioning
title: "HPA가 Pod 수를 늘렸지만 배치할 노드 자원이 없어 Pending으로 남았습니다. Karpenter는 무엇을 보고 노드를 만들며 Pod 확장과는 어떻게 연결되나요?"
answerMinutes: 5
followups: [{"id":"k8s-hpa-scaling","prompt":"desired replica는 늘었지만 Node Ready가 늦어지는 동안 응답 지연을 보호하려면 HPA와 요청 대기열에 어떤 상한을 두겠습니까?"},{"id":"k8s-requests-limits","prompt":"실제 사용량보다 낮은 requests로 노드를 고른 뒤 실행 중 압박이 생겼다면 배치 효율과 OOM을 함께 줄이도록 값을 어떻게 재측정하겠습니까?"},{"id":"keda-scale-zero","prompt":"consumer가 0 replica에서 깨어날 때 Pod뿐 아니라 노드도 새로 필요하다면 첫 메시지 지연을 어떤 구간으로 나눠 측정하겠습니까?"}]
difficulty: 하
category: 인프라
tags: ["Karpenter","노드","스케줄링"]
related: ["k8s-hpa-scaling","keda-hpa-role"]
---

# HPA가 Pod 수를 늘렸지만 배치할 노드 자원이 없어 Pending으로 남았습니다. Karpenter는 무엇을 보고 노드를 만들며 Pod 확장과는 어떻게 연결되나요?

## 구두 답변

HPA는 Deployment 같은 workload의 replica 수를 늘리는 역할이고, Karpenter는 이미 생성됐지만 현재 노드에 배치되지 못한 Pod를 수용할 노드 용량을 공급하는 역할입니다. Pod가 Pending인 상태에서 Karpenter는 Pod의 `requests`, node selector·affinity, taint toleration, topology와 NodePool 제약 등을 보고 어떤 인스턴스가 필요한지 판단합니다. 따라서 Pod 수를 결정하는 확장과 그 Pod를 실행할 기계를 공급하는 확장은 서로 다른 제어 루프입니다.

예를 들어 HPA가 replica를 3개에서 10개로 바꿨는데 기존 노드에 CPU·메모리 request를 수용할 여유가 없다고 하겠습니다. 새 Pod는 Pending이 되고, Karpenter가 이를 관찰해 NodeClaim을 만들고 클라우드 인스턴스가 준비되면 scheduler가 Pod를 배치합니다. 그러나 NodeClaim 생성 성공은 Node Ready나 Pod Ready가 아닙니다. 부트스트랩, CNI·CSI, DaemonSet, 이미지 다운로드, 앱 초기화와 readiness가 모두 뒤따릅니다.

### Pod 요구량이 노드 선택의 입력입니다

Karpenter는 일반적으로 실제 순간 사용량보다 Pod가 선언한 requests와 제약을 바탕으로 노드 후보를 찾습니다. 메모리 3GiB가 필요한 Pod가 1GiB만 request로 선언하면 작은 노드도 적합해 보일 수 있지만 실행 중 OOM이나 메모리 경쟁이 생길 수 있습니다. 반대로 request를 지나치게 높이면 큰 노드만 선택하거나 여러 Pod를 함께 배치하지 못해 비용과 Pending이 늘어납니다. 모든 노드에 배치되는 DaemonSet의 requests도 실제 가용 용량에서 빠지므로, Karpenter가 고른 인스턴스의 명목 용량과 Pod가 쓸 수 있는 용량을 분리해 봅니다.

Pod의 affinity·topology spread·taint·toleration이 지나치게 좁으면 인스턴스 유형이 있어도 후보가 없을 수 있습니다. PVC가 특정 영역에 묶여 있는데 NodePool이 다른 영역만 허용하는 경우도 노드가 생겨도 Pod가 계속 Pending인 원인이 됩니다. security group, subnet, IAM 권한, 비용 상한, Spot·on-demand 정책도 노드 공급 성공과 별도로 확인하겠습니다.

### HPA와 노드 공급의 지연을 함께 측정합니다

부하가 늘면 메트릭 수집과 HPA 반영, Pod 생성, Pending 관찰, NodeClaim 생성, 클라우드 인스턴스 부팅, Node Ready, Pod 스케줄, 이미지·초기화, readiness 순으로 시간이 흐릅니다. 이 전체를 **용량 공급 지연**(capacity provisioning latency)으로 보고 단계별 시간을 기록하겠습니다. 노드가 준비됐는데도 Pod가 Pending이면 scheduler 이벤트와 PVC·affinity를 보고, Pod가 Running인데 Ready가 아니면 앱 초기화와 probe를 봅니다.

확장 실패를 CPU가 낮은 앱 문제나 Karpenter 문제로 섞어 말하지 않겠습니다. NodeClaim이 생성되지 않았으면 Pod 요구량·NodePool·권한을, 생성됐지만 실패하면 클라우드 용량·할당량·서브넷을, Node Ready가 늦으면 부트스트랩·플러그인을 조사합니다. Karpenter가 노드를 공급해도 DB 연결 풀이나 단일 파티션 같은 애플리케이션 병목은 그대로일 수 있습니다.

검증은 burst, 여러 인스턴스 유형 허용, 클라우드 용량 부족, PVC 영역 불일치, DaemonSet 자원, 이미지 캐시 유무를 나눠 시험합니다. 성공 기준은 NodeClaim 수가 아니라 Pending 시간이 줄고 Ready 용량이 부하 전에 확보되며 실제 지연과 오류율이 목표에 들어오는지입니다. 이처럼 workload 확장과 기계 용량 공급을 잇는 상태를 **노드 프로비저닝**(node provisioning)이라고 부를 수 있습니다.

## 득점 포인트

- HPA의 replica 결정과 Karpenter의 Pending Pod 수용을 별도 제어 루프로 설명한다.
- requests·NodePool·DaemonSet·PVC 영역·affinity가 노드 후보와 실제 용량에 미치는 영향을 연결한다.
- NodeClaim→Node Ready→Pod Ready→실제 처리까지의 관찰 순서를 제시한다.

## 감점 포인트

- Karpenter가 애플리케이션 replica 수를 직접 결정한다고 말한다.
- NodeClaim이나 인스턴스 생성 완료를 Pod·서비스 준비 완료로 간주한다.
- 잘못된 requests와 좁은 제약, 클라우드 용량 부족을 모두 하나의 원인으로 뭉뚱그린다.

## 더 파고들 거리

- DaemonSet requests가 노드의 실제 가용 용량과 인스턴스 선택에 어떻게 반영되는지 설명해 보세요.
- PVC의 영역 제약과 NodePool 조건이 충돌할 때 scheduler 이벤트와 NodeClaim 상태를 어떻게 읽을까요.
- 클라우드 용량 부족에 인스턴스 유형을 넓힐 때 비용·보안·예측 가능성을 어떻게 관리할까요.
