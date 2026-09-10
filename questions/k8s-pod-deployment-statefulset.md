---
id: k8s-pod-deployment-statefulset
title: "Kubernetes에서 API 서버와 고정 식별자·디스크가 필요한 저장 서버를 배포합니다. Pod, Deployment, StatefulSet은 어떤 역할이 다른가요?"
answerMinutes: 5
followups: [{"id":"k8s-stateful-storage","prompt":"StatefulSet의 `db-0`이 같은 PVC를 다시 붙였지만 이전 노드가 살아 있다면 데이터 손상을 막기 위해 어떤 fencing과 attach 상태를 확인하겠습니까?"},{"id":"k8s-service-network","prompt":"StatefulSet Pod마다 DNS 이름을 제공해야 하고 기존 HTTP/2 연결도 드레이닝해야 한다면 Headless Service와 일반 Service를 어떻게 조합하겠습니까?"},{"id":"k8s-reconciliation","prompt":"StatefulSet의 desired replica 변경 요청이 성공했지만 순서대로 Pod가 준비되지 않는다면 어떤 controller 상태와 이벤트를 추적하겠습니까?"}]
difficulty: 하
category: 인프라
tags: ["Kubernetes","Pod","Deployment","StatefulSet"]
related: ["k8s-reconciliation"]
---

# Kubernetes에서 API 서버와 고정 식별자·디스크가 필요한 저장 서버를 배포합니다. Pod, Deployment, StatefulSet은 어떤 역할이 다른가요?

## 구두 답변

Pod는 함께 배치되어 네트워크·스토리지 볼륨·일부 수명을 공유하는 컨테이너 실행 단위입니다. Deployment와 StatefulSet은 Pod 자체가 아니라 Pod 집합을 원하는 상태로 유지하고 교체하는 상위 리소스입니다. 일반적인 API처럼 각 복제본이 대체 가능하고 안정적인 이름이나 전용 디스크가 필요하지 않다면 Deployment가 자연스럽습니다. 반대로 각 인스턴스의 순서 있는 이름, 안정적인 네트워크 식별자, Pod별 저장소가 필요하면 StatefulSet이 도움을 줍니다.

Deployment의 `api-abc123` Pod가 죽으면 새로운 이름의 Pod가 생겨도 서비스가 같은 역할을 수행하면 됩니다. 반면 StatefulSet의 `db-0`, `db-1`은 재생성 뒤에도 ordinal 식별자를 유지하고, 각 Pod에 연결된 PVC를 다시 사용할 수 있습니다. 그러나 이름과 PVC를 유지한다는 것만으로 데이터 복제·리더 선출·트랜잭션 복구가 생기지는 않습니다. 애플리케이션이 각 노드의 역할과 복제 프로토콜을 구현하고, 여러 Pod가 같은 데이터를 동시에 쓰지 않을 조건도 정해야 합니다.

### 실행 단위와 관리자를 나눕니다

하나의 Pod 안 컨테이너는 같은 네트워크 네임스페이스를 사용하고 localhost로 통신할 수 있으며 함께 스케줄되고 함께 종료되는 경향이 있습니다. 그래서 밀접하게 결합된 보조 컨테이너를 넣을 수 있지만, 서로 독립적으로 확장되는 서버를 무조건 한 Pod에 넣으면 자원 단위와 장애 단위가 묶입니다. Deployment는 ReplicaSet을 통해 지정한 수의 교체 가능한 Pod를 유지하고 rolling update를 수행합니다. Service는 이 Pod들 중 Ready endpoint로 트래픽을 보낼 뿐, Pod 내부 상태를 복제하지 않습니다.

StatefulSet은 Pod 이름과 순서, PVC 연결을 안정적으로 유지하는 관리자입니다. Headless Service를 함께 사용하면 각 Pod를 DNS 이름으로 발견할 수 있어 클러스터 멤버 식별에 유용합니다. 하지만 순서 있는 시작이나 종료를 켠다고 DB의 quorum이 자동으로 맞춰지지는 않습니다. 애플리케이션이 `db-0`을 리더로 볼지, 재시작 중 데이터가 최신인지, 오래된 노드가 다시 쓰지 않는지를 별도로 검증해야 합니다.

### 선택 기준은 상태라는 이름보다 계약입니다

메모리 캐시가 있는 API를 StatefulSet으로 바꾼다고 메모리가 유지되지 않습니다. Pod가 죽으면 메모리는 사라지고, PVC에 저장하지 않은 상태는 복구되지 않습니다. 반대로 Deployment도 외부 DB를 사용하는 상태ful 서비스의 프런트엔드로 쓰일 수 있습니다. 중요한 질문은 Pod가 교체되어도 같은 역할을 맡을 수 있는지, 인스턴스별 식별이 프로토콜에 필요한지, 데이터 저장소의 수명이 Pod와 어떻게 연결되는지입니다.

스토리지 서버를 StatefulSet으로 배포한다면 attach·detach 지연, 영역 제약, fencing, 스냅샷과 복구 절차를 점검하겠습니다. API 서버라면 readiness와 무상태성, 세션 저장 위치, rolling update 중 구·신 버전 호환성을 확인합니다. 테스트는 Pod 재시작, 노드 장애, PVC 재연결, 여러 replica 동시 시작을 나누고 실제 상태·데이터·사용자 요청 결과를 관찰합니다. 이처럼 실행 컨테이너를 묶은 단위와 이를 교체·복구하는 선언적 관리자를 분리하는 것이 **워크로드 컨트롤러**(workload controller)의 핵심입니다.

## 득점 포인트

- Pod와 Deployment·StatefulSet의 실행 단위·관리자 역할을 구분한다.
- StatefulSet의 안정적인 식별·PVC 연결과 애플리케이션 복제·합의·데이터 복구를 분리한다.
- 교체 가능성, 인스턴스별 프로토콜 식별, 스토리지 수명과 장애 테스트를 선택 기준으로 제시한다.

## 감점 포인트

- StatefulSet을 사용하면 데이터 복제와 합의가 자동으로 생긴다고 말한다.
- Pod 이름이 같으면 이전 프로세스의 메모리 상태도 보존된다고 가정한다.
- Deployment는 상태를 가질 수 없다고 단정해 외부 DB를 사용하는 프런트엔드 사례를 배제한다.

## 더 파고들 거리

- Headless Service와 StatefulSet ordinal DNS가 클러스터 멤버 발견에 어떻게 쓰이는지 설명해 보세요.
- PVC 보관과 Pod 삭제를 분리할 때 reclaim 정책과 복구 책임을 어떻게 정할까요.
- 순차 시작과 병렬 시작이 데이터 서비스의 quorum·복구 시간에 미치는 영향을 비교해 보세요.
