---
id: rollout-capacity
title: Deployment 롤링 교체의 용량·가용성·종료 예산
topic: 인프라
summary: surge·unavailable의 정수 계산과 terminating 자원을 나누고 단일 replica·readiness·혼합 버전·preStop·drain의 전제를 설명합니다.
questionIds: [k8s-rolling-update-capacity, deployment-surge-unavailable-rounding, single-replica-zero-downtime-rollout, k8s-disruption-grace-budget]
---

# Deployment 롤링 교체의 용량·가용성·종료 예산

## 목표 Replica 수와 실제 서비스 용량

replicas=4, maxSurge=1, maxUnavailable=1이면 rollout이 목표보다 하나 더 생성하는 여유와 Available을 목표보다 하나 적게 허용하는 여유를 갖습니다. 계획상 가용 하한은 3개입니다. 하지만 이는 장애가 없어야 유지되는 controller의 교체 예산이지 외부 장애에도 항상 최소 3개가 서비스한다는 보장이 아닙니다.

새 Pod가 Pending이면 객체 수가 5여도 처리 용량은 늘지 않습니다. 종료 중인 옛 Pod는 프로세스·메모리를 아직 보유할 수 있으므로 5를 모든 순간의 총 프로세스·자원 사용 절대 상한으로 해석하지 않습니다.

## maxSurge·maxUnavailable 백분율의 정수 올림·내림

| desired | surge 비율 | 계산 | unavailable 비율 | 계산 |
| --- | --- | --- | --- | --- |
| 1 | 25% | ceil(0.25)=1 | 25% | floor(0.25)=0 |
| 3 | 25% | ceil(0.75)=1 | 25% | floor(0.75)=0 |
| 4 | 25% | ceil(1)=1 | 25% | floor(1)=1 |

표처럼 desired=1이면 25% surge는 ceil(0.25)=1이고 25% unavailable은 floor(0.25)=0입니다. desired=3에서는 각각 ceil(0.75)=1과 floor(0.75)=0, desired=4에서는 ceil(1)=1과 floor(1)=1이 되므로 maxSurge 비율은 올림하고 maxUnavailable 비율은 내림합니다.

두 값을 모두 0으로 만들 수는 없으므로, 설정을 읽을 때 정수 값과 비율을 먼저 구분하고 rollout 중에는 관찰 가능한 desired·updated·Ready·Available 수와 이벤트가 이 계산과 맞는지 대조합니다. terminating replica 수를 어떤 상태 필드나 이벤트로 확인할 수 있는지는 Kubernetes 버전과 기능 조건을 별도로 확인합니다.

replicas=4에서 새 Pod 하나가 생성됐지만 아직 Ready가 아니어도 현재 Available=4라면 옛 것 하나를 줄여 Available=3이 되는 경로가 가능합니다. 따라서 항상 새 Pod가 Ready가 된 뒤 옛 Pod를 하나씩 지운다는 고정 순서를 가정하지 않습니다. 현재 상태와 허용 unavailable에 따라 진행합니다.

```diagram
{"title":"새 객체 수가 아니라 준비된 용량으로 교체를 판단합니다","caption":"화살표는 가능한 rollout 경로입니다. Pending·초기화·readiness 지연이 있으면 추가 Pod가 있어도 실제 처리 용량은 늘지 않습니다.","rows":[[{"id":"old","label":"구버전 Available 4"}],[{"id":"new","label":"신버전 Pod 1 생성","detail":["surge 예산 사용"]}],[{"id":"ready","label":"신버전 Available 확인"}],[{"id":"drain","label":"옛 Pod drain·종료"}]],"edges":[{"from":"old","to":"new","label":"추가 생성"},{"from":"new","to":"ready","label":"배치·초기화"},{"from":"ready","to":"drain","label":"예산 안 교체"}]}
```

그림은 한 정상 경로이며 unavailable 예산이 있으면 옛 Pod 축소가 새 준비보다 앞설 수도 있습니다. Ready와 Available도 minReadySeconds 같은 조건에 따라 다릅니다. progress deadline 초과는 진행 실패 condition을 나타낼 수 있지만 그것만으로 안전한 자동 rollback을 보장하지 않습니다.

## 단일 Replica 무중단과 추가 자원

maxUnavailable=0, surge=1을 줘도 새 Pod를 배치할 노드·quota·IP·DB 연결이 없으면 rollout이 멈춥니다. 단일 attach 볼륨을 두 Pod가 동시에 요구하거나 host port가 충돌하는 경우도 봐야 합니다. 새 Pod가 실제 준비될 때까지 옛 Pod를 유지할 수 있는 환경인지 확인합니다.

메모리 세션·진행 중 작업이 옛 Pod에만 있으면 새 Pod Ready만으로 사용자 세션이 옮겨지지 않습니다. 외부 세션 저장·재연결·작업 인계의 별도 계약이 필요합니다. 한 Pod의 제거와 네트워크 endpoint 전파·기존 연결 수명은 동시에 일어나지 않습니다.

## 구·신 버전 혼합 기간의 읽기·쓰기 호환

새 코드가 필수로 읽는 DB 컬럼은 먼저 준비되어야 하고, 옛 코드가 새 이벤트·데이터를 만났을 때의 호환성도 필요합니다. destructive schema 변경을 rollout 순서만으로 안전하게 만들 수는 없습니다. 확장·백필·읽기 전환·옛 경로 제거를 나누고 rollback 가능한 시점을 정합니다.

앱 이미지를 되돌려도 이미 변환한 DB 데이터·외부 메시지·사용자 효과는 돌아오지 않습니다. rollback은 컨테이너 버전의 복귀와 데이터 복구를 분리해 계획합니다.

## PreStop·Drain과 전체 종료 유예 예산

terminationGracePeriod가 30초인데 preStop이 20초를 쓰고 앱이 이후 30초 drain을 기다리면 총 예산을 넘습니다. grace의 카운트는 preStop 전에 시작되므로 hook·종료 신호·앱 정리·여유가 같은 기간 안에 들어가야 합니다. kubelet의 작은 예외적 연장에 정상 계획을 의존하지 않습니다.

종료를 시작하면 새 요청과 메시지 fetch를 막고, endpoint 전파가 진행되는 동안 기존 연결과 진행 중 작업을 정리합니다. readiness가 실패해도 기존 HTTP/2 스트림은 즉시 끊기지 않으므로, GOAWAY로 이 연결에서 새 스트림을 받지 않겠다는 신호를 보낸 뒤 최대 연결 수명과 끊긴 작업의 재개 위치를 프로토콜 계약으로 정합니다. 새 자식 작업을 수락하는 순간과 진행 중 작업 수를 세는 active 카운터 등록을 맞추고, 실제 종결 전에 DB 연결 풀을 닫지 않습니다.

앱 내부 deadline은 정리·로그·연결 반환 시간을 남기도록 더 짧게 둡니다. 끝낼 수 없는 작업은 checkpoint·재전달·멱등 효과로 복구하고, 작업을 잃지 않으려고 강제 종료 직전에 ACK를 먼저 보내는 방식은 피합니다.

## 연속 요청과 강제 종료 이후 결과 검증

테스트에서는 새 Pod Pending·잘못된 readiness·혼합 버전·긴 preStop·스트림·강제 종료를 나눕니다. desired·updated·Ready·Available·terminating 수와 실제 요청 지연·오류·중복 효과를 함께 봅니다. PDB는 Deployment 자체 rollout을 직접 제어하는 동일 예산이 아니라 별도 eviction 경계입니다.

현재 작업에서는 Kubernetes rollout을 실행하지 않았습니다. 표의 정수 계산과 종료 예산 예제는 설계 산술이며 실제 서비스 무중단을 검증한 결과는 아닙니다.
