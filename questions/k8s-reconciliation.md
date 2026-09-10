---
id: k8s-reconciliation
title: "Kubernetes에 Deployment 복제본 수를 바꾸는 요청은 성공했는데 Pod가 아직 준비되지 않았습니다. 선언은 어떤 과정을 거쳐 실제 상태가 되나요?"
answerMinutes: 5
followups: [{"id":"retry-safe-state-machine","prompt":"외부 클라우드 자원을 만드는 controller가 중간에 재시작됐다면 이미 생성된 결과와 원하는 상태를 어떤 키와 상태 전이로 재조정하겠습니까?"},{"id":"k8s-probe-contract","prompt":"Pod가 Running이지만 readiness가 실패한다면 조정 완료와 Service 유입 가능성을 어떤 상태로 분리하겠습니까?"},{"id":"argocd-gitops-reconcile","prompt":"Argo CD가 같은 Deployment를 다시 적용하는 상황에서 Kubernetes controller와 Git 원하는 상태의 차이를 어떤 관찰 순서로 진단하겠습니까?"}]
difficulty: 하
category: 인프라
tags: ["Kubernetes","컨트롤러","reconciliation"]
related: ["retry-safe-state-machine"]
---

# Kubernetes에 Deployment 복제본 수를 바꾸는 요청은 성공했는데 Pod가 아직 준비되지 않았습니다. 선언은 어떤 과정을 거쳐 실제 상태가 되나요?

## 구두 답변

Kubernetes API 요청이 성공했다는 것은 원하는 상태가 API 서버에 저장됐다는 뜻이지, 그 상태가 이미 실행 중이라는 뜻은 아닙니다. Deployment의 replica를 5로 바꾸면 Deployment controller가 ReplicaSet의 목표를 조정하고, ReplicaSet controller가 부족한 Pod를 만듭니다. 이어 scheduler·kubelet·컨테이너 런타임이 배치·실행을 진행합니다. 이미지 다운로드, 볼륨 연결, readiness 통과까지 끝나야 실제 요청 처리 용량이 생깁니다.

이처럼 시스템이 원하는 상태와 관찰한 실제 상태의 차이를 반복해서 줄이는 과정을 **조정**(reconciliation)이라고 부릅니다. 컨트롤러는 한 번 명령을 실행하고 종료하는 스크립트가 아니라, 이벤트나 주기적 관찰을 통해 현재 상태를 읽고 필요한 조정을 계속 시도합니다. Pod가 중간에 삭제되거나 controller가 재시작돼도 desired replica가 기준으로 남아 있으면 다시 수렴할 수 있어야 합니다.

### 선언 저장부터 준비까지의 경로를 봅니다

사용자가 Deployment를 수정하면 API 서버는 리소스의 `spec`과 resource version을 저장합니다. controller는 해당 Deployment를 관찰해 ReplicaSet의 desired replica를 맞추고, scheduler는 Pod의 requests·affinity·taint 조건에 맞는 노드를 고릅니다. 노드가 부족하면 Pod는 Pending으로 남고, 자동 노드 공급기가 있다면 그 다음에 NodeClaim이나 인스턴스 준비가 추가됩니다. kubelet이 컨테이너를 시작해도 readiness가 실패하면 Service endpoint에는 들어가지 않습니다. 그러므로 `apply`나 `patch`의 종료 코드만 보고 완료라고 하지 않고, Deployment condition의 observed generation, ReplicaSet과 Pod 상태, 이벤트, Ready endpoint, 실제 요청 결과를 순서대로 보겠습니다.

`observedGeneration`은 controller가 최신 spec generation을 관찰해 처리했는지 판단하는 데 도움을 줍니다. 하지만 observed가 바뀌었다고 모든 Pod가 Ready라는 뜻은 아니므로 condition의 의미를 함께 읽어야 합니다. API 서버에서 status가 갱신되는 시간과 실제 노드에서 실행되는 시간이 다를 수 있다는 **수렴 지연**(convergence delay)을 운영 타임아웃에 반영하겠습니다.

### 반복 조정은 멱등적이어야 합니다

controller가 같은 이벤트를 두 번 보거나 처리 중 재시작되면 같은 Pod를 중복 생성하거나 이미 외부에 만든 자원을 또 만들어서는 안 됩니다. 원하는 수와 실제 목록을 비교하고, owner reference와 이름·키를 이용해 기존 자원을 재사용하는 식으로 조정해야 합니다. 커스텀 controller가 DNS 레코드나 클라우드 리소스를 만든다면 Kubernetes 객체만 멱등적으로 보아서는 부족하고 외부 호출의 재시도·부분 성공·삭제 보상도 설계해야 합니다. 선언형이라는 말은 실패가 없다는 뜻이 아니라 실패 뒤에도 다시 읽을 기준과 복구 경로가 있다는 뜻입니다.

삭제도 같은 원리로 즉시 사라지지 않을 수 있습니다. finalizer가 외부 정리를 끝낼 때까지 객체가 남아 있거나, 다른 controller가 finalizer를 처리하지 못해 삭제가 지연될 수 있습니다. 이런 상태에서 finalizer를 무조건 제거하면 외부 자원 누수가 남을 수 있으므로 소유자와 정리 완료를 먼저 확인하겠습니다. 서로 다른 controller가 같은 필드를 수정하면 원하는 상태가 계속 바뀌는 경쟁이 생깁니다.

검증은 replica 변경, Pod 강제 삭제, scheduler 자원 부족, controller 재시작, finalizer 지연을 나눠 재현합니다. 각 경우에 목표가 spec에 저장됐는지, 실제 Pod가 어느 단계에서 멈췄는지, 반복 조정 뒤 정상 상태로 수렴하는지 확인하겠습니다. 명령 성공과 서비스 준비를 분리해 말하는 것이 Kubernetes를 이해하는 출발점입니다.

## 득점 포인트

- API 서버에 원하는 상태가 저장되는 단계와 controller·scheduler·kubelet의 실제 준비 단계를 나눈다.
- observedGeneration·condition·이벤트·Ready endpoint를 이용한 진단 순서를 제시한다.
- 반복 조정의 멱등성과 finalizer·외부 부수 효과·필드 경쟁의 한계를 함께 설명한다.

## 감점 포인트

- apply 성공이나 observedGeneration 변경을 모든 Pod의 Ready와 동일시한다.
- controller는 한 번만 실행되고 재시작하면 desired 상태를 잃는다고 말한다.
- 선언형이면 외부 API 생성·삭제의 중복과 부분 실패까지 자동으로 안전하다고 가정한다.

## 더 파고들 거리

- status가 최신 spec을 관찰했어도 rollout이 진행되지 않는 사례를 어떤 condition으로 구분할까요.
- finalizer가 남은 객체의 소유 외부 자원과 정리 완료를 어떻게 조사할까요.
- 서로 다른 controller가 같은 필드를 변경할 때 server-side apply와 소유권을 어떻게 정리할까요.
