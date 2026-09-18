---
id: reconciliation
title: Kubernetes 선언·관찰·조정·삭제의 상태
topic: 인프라
summary: API 저장부터 Ready까지의 비동기 경로와 generation·condition·멱등 외부 조정·finalizer·필드 manager의 책임을 설명합니다.
questionIds: [k8s-reconciliation, k8s-observed-generation-conditions, k8s-finalizer-external-cleanup, server-side-apply-field-ownership]
---

# Kubernetes 선언·관찰·조정·삭제의 상태

Kubernetes의 선언형 동작은 요청을 받자마자 최종 상태를 반환하는 함수가 아니라, 저장된 spec과 관찰된 실제 상태의 차이를 반복해서 줄이는 비동기 제어 루프입니다. 진단의 기본 순서는 원하는 상태가 저장됐는지, 어느 controller가 관찰했는지, 실제 workload가 어디에서 멈췄는지, 트래픽 경로까지 준비됐는지를 분리하는 것입니다.

## Apply 성공과 원하는 상태 저장

Deployment replica를 3에서 5로 바꾸는 요청이 성공해도 Pod 두 개가 즉시 서비스하는 것은 아닙니다. API 서버가 원하는 spec을 저장한 뒤 Deployment controller·ReplicaSet controller·scheduler·kubelet·컨테이너 런타임이 각각 상태를 맞춥니다. 이미지 다운로드·볼륨 연결·초기화·readiness가 끝나야 실제 용량이 생깁니다.

조정은 현재 관찰 상태와 원하는 상태의 차이를 줄이도록 현재 상태를 다시 읽고 필요한 작업을 반복하는 과정입니다. 예를 들어 replica를 3에서 5로 바꾼 뒤 controller가 중간에 재시작하거나 같은 이벤트를 두 번 받아도, 현재 Pod 수와 원하는 replica 수의 차이를 다시 계산해 조정해야 합니다. 따라서 이벤트 한 번마다 정확히 한 번 실행하는 스크립트가 아니라 재시작·중복 관찰 뒤에도 상태가 수렴하는 제어 루프입니다.

```diagram
{"title":"선언 저장에서 실제 처리 용량까지 여러 단계가 있습니다","caption":"화살표는 개념적 준비 순서입니다. 각 단계는 독립적으로 지연·실패할 수 있어 API 성공만으로 최종 준비를 판정하지 않습니다.","rows":[[{"id":"api","label":"spec 저장"}],[{"id":"controller","label":"ReplicaSet·Pod 목표 조정"}],[{"id":"schedule","label":"노드 배치·볼륨·이미지"}],[{"id":"ready","label":"프로세스 초기화·Ready"}],[{"id":"traffic","label":"endpoint 전파·실제 요청"}]],"edges":[{"from":"api","to":"controller","label":"controller 관찰"},{"from":"controller","to":"schedule","label":"Pod 생성"},{"from":"schedule","to":"ready","label":"kubelet 실행"},{"from":"ready","to":"traffic","label":"서비스 수용"}]}
```

replicas=5 apply가 성공한 직후에는 API 객체의 spec만 바뀌었을 수 있습니다. 이후 ReplicaSet과 Pod 수, scheduler 배치, kubelet 실행, readiness, EndpointSlice 전파가 각각 다른 시각에 도착합니다. 따라서 사용자가 실제 요청을 성공시키는 시각은 apply 응답 시각이 아니라 서비스가 요구하는 Ready·endpoint 조건의 시각으로 정의해야 합니다.

## Generation·Condition과 관찰 시점의 의미

| 상태 | 의미 | 의미하지 않는 것 |
| --- | --- | --- |
| metadata.generation | 해당 객체의 spec 세대 | 모든 status 최신 |
| observedGeneration | controller가 관찰한 spec 세대 | rollout 성공 |
| updatedReplicas | 새 template에 해당하는 replica | Ready·Available 전체 충족 |
| Available·Progressing 등 condition | 해당 controller가 정의한 상태 | 모든 제품에서 같은 조건 의미 |
| resourceVersion | API 객체 동시성·watch 관련 버전 | 숫자 크기로 범용 업무 순서 추정 |

최신 generation을 관찰했어도 quota·Pending·ImagePullBackOff·readiness 실패가 남을 수 있습니다. condition의 status·reason·message·시각과 관련 generation을 확인합니다. 객체 종류마다 status 구조가 다르므로 Deployment 규칙을 모든 CRD에 적용하지 않습니다. 오래된 condition을 최신 spec의 성공 증거로 사용하지 않습니다.

읽기 전용 진단에서는 Deployment→ReplicaSet→Pod→이벤트→EndpointSlice→실제 요청 순서로 멈춘 경계를 찾습니다. Pending이면 자원·affinity·taint·볼륨 topology를 보고, 실행됐는데 Ready가 아니면 초기화·probe·앱 의존성을 봅니다.

generation=12, observedGeneration=12라도 updatedReplicas=5와 Available=5가 아닐 수 있습니다. 이 상태는 controller가 최신 spec을 읽었다는 증거이지 rollout 성공의 증거가 아닙니다. 장애 진단에서는 generation과 condition transition time을 함께 보아 오래된 성공 condition이 현재 spec에 재사용되지 않았는지 확인합니다.

## 반복 실행 외부 작업의 멱등성

커스텀 controller가 클라우드 리소스를 만들고 status를 저장하기 전에 죽으면 다음 조정에서 같은 생성을 반복할 수 있습니다. 안정된 외부 ID·요청 키로 기존 결과를 찾고, 상태 기록과 실제 외부 결과를 대사할 수 있어야 합니다. Kubernetes owner reference가 클라우드 API의 중복 생성을 자동 방지하지는 않습니다.

현재 목록을 읽고 필요한 차이만 적용하며, conflict에는 최신 객체를 다시 읽어 계산합니다. 무제한 즉시 재시도는 API 장애를 증폭하므로 backoff·작업 큐 상한·오류 관측을 둡니다. 선언형이라는 말은 외부 부수 효과가 자동 거래가 된다는 뜻이 아닙니다.

외부 리소스 생성 후 status 저장 전에 controller가 죽는 trace에서는 다음 reconcile이 같은 외부 ID를 조회해 기존 결과를 채택해야 합니다. 매번 임의 이름으로 생성하면 Kubernetes 객체는 하나여도 외부 리소스가 여러 개가 됩니다. conflict 후에는 최신 객체를 다시 읽어 원하는 차이를 재계산해야 하며, 즉시 무제한 retry는 장애를 증폭시킵니다.

## Finalizer와 삭제 전 잔여 책임

삭제 요청 후 deletionTimestamp가 찍혔는데 finalizer가 남으면 객체가 Terminating에 머무를 수 있습니다. 그 finalizer를 처리할 controller, 외부 리소스 ID, controller 권한·연결·로그·정리 상태를 대조합니다. 외부 삭제가 성공했는데 status 반영이 실패한 재시도도 안전해야 합니다.

그냥 finalizer 문자열을 지우면 API 객체는 사라져도 클라우드 리소스·볼륨·데이터가 고아로 남을 수 있습니다. 강제 제거는 실제 정리·데이터 보존·대체 소유자와 승인 근거를 확인한 뒤의 별도 운영 결정입니다. 이 노트는 강제 삭제를 실행하지 않습니다.

deletionTimestamp가 있는데 finalizer가 남은 경우, 문자열을 지우기 전에 controller가 외부 ID를 읽고 삭제 결과를 확인할 수 있는지 봅니다. 외부 삭제 성공 후 status 반영 실패라면 같은 삭제를 재시도해도 안전해야 합니다. 강제 제거 뒤 orphan이 남을 수 있다는 예측을 실제 외부 목록과 대조하지 않고 “Terminating 해결”만 성공으로 기록하지 않습니다.

## 동일 필드의 manager별 소유권 충돌

GitOps가 replicas=3을 계속 쓰고 HPA가 replicas=5를 쓰면 두 조정자가 서로 되돌릴 수 있습니다. server-side apply의 managedFields에서 어느 manager가 어떤 필드를 관리하는지 확인하고 필드 책임을 나눕니다. apply conflict를 force로 덮는 것은 소유권 이전이지 올바른 설계를 자동 선택하는 기능이 아닙니다.

같은 값을 공유하는 manager·defaulting·mutating webhook·update와 apply의 차이도 실제 객체에서 확인합니다. managedFields는 모든 API 수정자를 막는 보안 잠금이 아니므로 인가와 운영 규칙도 필요합니다. 필드를 diff에서 제외하면 그 필드의 수동 drift까지 숨길 수 있어 별도 감사·상한 검증을 둡니다.

GitOps와 HPA가 replicas를 각각 원하는 값으로 쓰면 한 controller의 성공이 곧 안정 상태가 아닙니다. managedFields와 실제 apply 주기를 함께 보고 단일 owner 또는 명확한 필드 분할을 정합니다. force apply는 충돌 메시지를 없애는 조작이 아니라 다른 manager의 소유권을 넘기는 변경이므로 승인과 회귀 확인이 필요합니다.

## 관찰 지연과 실패 복구의 단계별 시험

테스트 클러스터에서 replica 변경·노드 부족·잘못된 이미지·controller 재시작·외부 정리 실패를 각각 재현합니다. 목표 저장 시각·관찰 세대·Ready·실제 요청 성공 시각을 분리해 수렴 시간을 측정합니다. 삭제·생성 재시도에서는 외부 자원이 중복되거나 사라지지 않는지 확인합니다.

현재 작업에서는 클러스터를 실행하지 않았습니다. 본문은 controller 상태 해석과 검증 절차이며 apply·rollout·finalizer 정리를 실제 수행한 결과가 아닙니다.

각 실습의 예측값을 목표 저장, observedGeneration, Pod Ready, EndpointSlice, 실제 요청 성공으로 나눕니다. 예를 들어 이미지가 잘못되면 apply와 observedGeneration은 진행되어도 Pod가 Ready가 되지 않아 Endpoint와 요청이 늘지 않아야 합니다. 이 차이를 기록하면 “API 성공인데 서비스 불능”의 멈춘 단계를 찾을 수 있습니다.
