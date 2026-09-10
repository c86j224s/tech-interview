---
id: k8s-pdb-eviction
title: "Kubernetes PDB를 설정했는데 노드 장애로 여러 Pod가 중단됐습니다. PDB가 막는 중단과 막지 못하는 중단은 무엇인가요?"
answerMinutes: 5
followups: [{"id":"graceful-shutdown","prompt":"PDB가 eviction을 허용했지만 기존 요청과 메시지 처리가 남아 있다면 새 유입·작업 종료·DB 풀 정리 순서를 어떻게 잡겠습니까?"},{"id":"k8s-rolling-update-capacity","prompt":"Deployment의 rollout 자체는 PDB가 막지 않지만 동시에 노드 drain도 시작되면, 가용 Pod 감소와 eviction 예산은 어떻게 영향을 주고받을까요?"},{"id":"karpenter-consolidation","prompt":"노드 consolidation이 비용을 줄이려 할 때 장기 세션 Pod의 eviction을 허용할 조건과 관측할 사용자 영향을 무엇으로 정하겠습니까?"}]
difficulty: 중하
category: 인프라
tags: ["Kubernetes","PDB","eviction"]
related: ["graceful-shutdown"]
---

# Kubernetes PDB를 설정했는데 노드 장애로 여러 Pod가 중단됐습니다. PDB가 막는 중단과 막지 못하는 중단은 무엇인가요?

## 구두 답변

PDB는 모든 Pod 장애를 막는 방패가 아니라, Kubernetes가 eviction API를 통해 자발적으로 Pod를 내보낼 때 동시에 중단할 수 있는 양을 제한하는 예산입니다. 노드 전원 장애, 하드웨어 고장, 커널 패닉, 컨테이너 크래시, OOM처럼 자발적 eviction 경로를 거치지 않는 사건에는 PDB가 사라진 Pod를 되살리거나 중단을 막지 못합니다. 따라서 PDB를 설정했는데 노드 장애로 여러 Pod가 내려갔다면 먼저 그 사건이 어떤 중단 경로였는지 확인하겠습니다.

예를 들어 replica가 3개이고 `minAvailable: 2`라면 정상적으로 Available인 Pod가 3개일 때 자발적으로 하나를 내보낼 여지가 있습니다. 하나가 이미 준비되지 않아 Available이 2개라면 다른 하나를 eviction하는 요청은 막힐 수 있습니다. 그러나 노드 자체가 꺼져 2개가 동시에 사라지면 PDB가 이를 예방하지 못합니다. 여기서 PDB의 대상은 실행 중인 Pod 수가 아니라 선택자에 맞는 가용 Pod와 disruption budget 계산이라는 점도 확인해야 합니다.

### 보호되는 중단과 보호되지 않는 장애를 나눕니다

`kubectl drain`이나 노드 통합 작업이 eviction API를 사용하면 PDB를 존중하며 진행이 멈출 수 있습니다. 반대로 강제 삭제나 노드 손실은 예산을 기다리지 않습니다. PDB가 엄격할수록 유지보수 작업이 오래 걸릴 수 있고, replica가 하나뿐인 서비스에 중단 불가 정책을 주면 가용성이 높아지는 것이 아니라 노드 교체가 막힐 수 있습니다. 최소 가용 Pod 수를 정할 때는 실제 replica, 장애 영역 분산, 한 Pod의 처리 용량, 새 Pod가 Ready가 되는 시간, 허용 가능한 유지보수 지연을 함께 계산하겠습니다.

Deployment 롤링 업데이트의 `maxUnavailable`과 PDB도 같은 설정이 아닙니다. Deployment는 새 버전으로 교체하는 자체 rollout 예산을 가지고, PDB는 자발적 disruption에 대한 애플리케이션 보호 기준을 제공합니다. Deployment의 자체 rollout은 PDB가 직접 제한하지 않습니다. 다만 rollout으로 가용 Pod가 줄면 동시에 진행하는 drain의 PDB 예산은 부족해질 수 있으므로 각 경로를 구분해야 합니다. PDB 하나로 readiness 오류, 애플리케이션 종료 처리, 영역 장애 복구를 대체할 수 없습니다.

### 예산이 회복되지 않는 이유를 찾습니다

노드 drain이 PDB에서 막혔다면 새 Pod가 아직 Ready가 아니거나, selector가 의도한 Pod를 정확히 잡지 못하거나, replica가 이미 부족한 상태일 수 있습니다. 이벤트, PDB의 `disruptionsAllowed`, currentHealthy·desiredHealthy, Deployment 상태, Pod readiness와 스케줄링 원인을 함께 보겠습니다. 새 Pod가 다른 영역에 배치되지 못하면 복구될 때까지 계속 예산이 부족하게 남습니다. 이때 PDB를 무시하고 강제 drain하면 데이터 처리나 요청이 동시에 끊길 수 있으므로, 대체 용량과 애플리케이션 드레이닝을 먼저 확인합니다.

종료 시에는 readiness를 먼저 실패시키고 새 트래픽 유입을 줄인 뒤, 진행 중인 요청이 끝날 시간을 주고, eviction을 수행하겠습니다. 큐 소비자는 새 메시지를 받지 않고 처리 중인 메시지를 ACK할지 재전달할지 판단해야 합니다. 테스트는 정상 drain, 여러 Pod가 있는 노드 장애, 새 Pod가 Pending인 상태, 종료 유예 초과를 각각 나눠 진행합니다. PDB의 **자발적 중단 예산**(voluntary disruption budget)은 복제·영역 배치·복구 설계가 만든 가용성을 보완할 뿐 그 자체로 보장하지 않습니다.

## 득점 포인트

- eviction API를 통한 자발적 중단과 노드 장애·크래시 같은 비자발적 장애를 구분한다.
- PDB, Deployment rollout, readiness, 종료 유예가 서로 다른 보호와 수명 책임임을 설명한다.
- disruptionsAllowed와 실제 replica·영역 배치·새 Pod 준비 상태를 진단 순서로 연결한다.

## 감점 포인트

- PDB가 전원 장애와 OOM을 포함한 모든 Pod 중단을 막는다고 말한다.
- 단일 replica에 중단 금지를 설정하면 자동으로 고가용성이 된다고 단정한다.
- PDB가 drain을 막을 때 강제로 진행하고 애플리케이션 종료·대체 용량을 확인하지 않는다.

## 더 파고들 거리

- PDB의 selector가 잘못돼 보호 대상이 달라지는 경우를 어떤 명령과 상태로 확인할까요.
- 새 Pod가 준비되지 않아 disruptionsAllowed가 회복되지 않을 때 스케줄링과 readiness를 어떻게 분리 진단할까요.
- 강제 eviction이 필요한 유지보수에서 사용자 영향과 데이터 처리 유실을 어떤 승인 기준으로 판단할까요.
