---
id: disruption-budget
title: PDB의 자발적 중단 예산과 장애 영역 용량
topic: 인프라
summary: Eviction API 보호·비자발 장애·selector·healthy 회복을 구분하고 topology spread·anti-affinity·장애 후 잔여 용량을 설명합니다.
questionIds: [k8s-pdb-eviction, pdb-selector-target-verification, pdb-budget-readiness-recovery, k8s-topology-spread]
---

# PDB의 자발적 중단 예산과 장애 영역 용량

PDB는 장애를 없애는 설정이 아니라 특정 중단 경로에서 동시에 잃을 수 있는 Pod 수를 조정하는 정책입니다. 보호 대상, 현재 Ready 상태, 대체 Pod를 배치할 독립 영역과 잔여 용량을 함께 봐야 하며, 숫자가 맞아도 공통 노드 장애나 readiness 실패를 막지는 못합니다.

## PDB와 Eviction API의 자발적 중단 보호 범위

PodDisruptionBudget은 주로 Eviction API를 사용하는 자발적 중단에서 동시에 중단할 수 있는 범위를 제한합니다. 노드 전원 장애·OOM·프로세스 crash·강제 삭제처럼 그 승인 경계를 거치지 않는 사건을 막는 방패가 아닙니다. 이미 사라진 Pod를 복구하는 것도 replica controller와 앱의 책임입니다.

replica 3, minAvailable=2이고 모두 healthy이면 한 개를 내보낼 여지가 있습니다. 이미 하나가 Ready가 아니면 예산이 없을 수 있습니다. 그러나 두 개가 같은 노드 장애로 동시에 사라지는 것을 PDB가 예방하지는 못합니다.

상태 추적은 `selector 결과 집합→Ready 대상→삭제 진행 대상→currentHealthy·desiredHealthy→disruptionsAllowed` 순서로 합니다. replica가 세 개라는 선언만으로 여유를 계산하지 않고, 한 Pod가 NotReady이면 같은 minAvailable 설정에서도 eviction 여유가 줄어드는지 실제 상태 객체와 대조합니다.

## PDB 대상 집합과 건강 상태 집계

| 확인 값 | 의미 | 함께 볼 상태 |
| --- | --- | --- |
| namespace·selector | 보호 대상으로 고른 Pod 집합 | 실제 라벨·owner |
| currentHealthy | 현재 건강하다고 센 대상 | Pod Ready·삭제 진행 |
| desiredHealthy | 정책이 요구하는 건강 수 | minAvailable 또는 maxUnavailable |
| disruptionsAllowed | 현재 허용 가능한 eviction 여유 | 최신 관찰·진행 중 중단 |

`policy/v1` PDB를 읽을 때는 `selector: {}`를 적은 경우와 selector 필드를 생략한 경우를 먼저 구분하고, 대상 Kubernetes API 버전에서 각각 어떤 Pod 집합을 뜻하는지 확인합니다. 정책 객체가 존재한다는 사실만으로 의도한 세 Pod를 보호한다고 보지 말고, 실제 Pod 라벨과 owner를 selector 결과와 대조합니다.

`minAvailable`과 `maxUnavailable`을 수·비율로 계산할 때는 Deployment의 반올림 규칙을 그대로 가져오지 않으며, PDB 비율이 요구 건강 수 또는 허용 중단 수를 올림하는 방식이라 작은 replica 수에서 결과가 크게 달라질 수 있습니다.

## Rollout 예산과 Eviction 예산의 분리

Deployment 자체의 롤링 교체는 maxSurge·maxUnavailable로 진행하며 PDB가 직접 그 교체를 제한하는 것은 아닙니다. 다만 rollout 때문에 Ready가 줄어들면 동시에 수행하는 node drain의 PDB 여유도 줄어듭니다. 두 작업이 같은 서비스에 주는 합산 영향을 봐야 합니다.

엄격한 PDB를 단일 replica에 적용하면 자동 고가용성이 생기는 대신 유지보수가 막힐 수 있습니다. unhealthy Pod eviction 정책과 drain 도구의 실제 경로도 사용하는 버전에서 확인합니다. 예산 때문에 멈췄다는 이유로 바로 강제 삭제하지 말고 대체 용량·사용자 영향·데이터 복구를 먼저 판단합니다.

```diagram
{"title":"예산 회복은 새 Pod의 실제 건강 회복을 기다립니다","caption":"화살표는 자발적 중단 후 대체 경로입니다. Pending과 readiness 실패는 다른 원인이며 숫자만 강제로 늘려 예산을 회복시키지 않습니다.","rows":[[{"id":"evict","label":"예산 안 eviction"}],[{"id":"create","label":"대체 Pod 생성"}],[{"id":"schedule","label":"배치·시작 성공"}],[{"id":"healthy","label":"Ready·healthy 회복"}],[{"id":"budget","label":"다음 중단 여유 회복"}]],"edges":[{"from":"evict","to":"create","label":"목표 replica 조정"},{"from":"create","to":"schedule","label":"자원·영역 조건"},{"from":"schedule","to":"healthy","label":"초기화·probe"},{"from":"healthy","to":"budget","label":"PDB 재관찰"}]}
```

예산이 회복되지 않으면 먼저 대체 Pod가 Pending인 이유로 scheduler가 맞는 노드를 찾지 못했는지 확인하고, 다음으로 이미지 pull이나 볼륨 연결에서 막혔는지, 프로세스는 실행됐지만 readiness가 실패했는지를 사건과 상태로 좁힙니다. Pod가 Ready가 된 뒤에도 PDB가 세는 집합이 맞는지, 특히 잘못된 selector가 새 revision을 제외하고 있지 않은지 실제 라벨과 대조합니다.

## Replica 수와 독립 장애 영역의 차이

세 Pod가 한 노드나 한 영역에 몰리면 replica 수가 3이어도 공통 장애로 함께 사라질 수 있으므로, 배치 결과에서 실제 영역을 먼저 확인합니다. topology spread는 topology key로 나눈 영역 사이의 차이를 `maxSkew` 안에 두도록 selector와 eligible domain 조건을 함께 사용하고, anti-affinity는 특정 Pod와 같은 영역(또는 지정된 topology)에 놓지 않는 제약으로 동작합니다.

`required`는 조건을 만족하지 못하면 새 Pod를 배치하지 못하게 하고 `preferred`는 가능한 배치를 선호하는 수준이므로, 강한 제약이 Pending을 만들 수 있는지 자원 여유와 함께 판단합니다.

scheduler의 배치 제약은 이미 실행 중인 Pod를 언제나 자동 재균형하는 기능은 아닙니다. 라벨·노드 추가·revision 변화에서 실제 배치를 확인합니다. selector가 다른 Pod를 세거나 PVC zone 제약이 이동을 막으면 기대한 분산을 얻지 못할 수 있습니다.

## 장애 후 잔여 영역의 부하 여유

세 영역의 Pod 하나씩이 평소 용량의 80%를 쓰면 총 수요는 Pod 2.4개 분량입니다. 한 영역을 잃고 두 개만 남으면 각각 120%를 요구해 포화됩니다. 균등 배치는 실패의 상관을 줄이지만 장애 후 처리량을 늘리지 않습니다.

장애 시 최소 용량·새 Pod 준비 시간·다른 영역 node 공급·스토리지 접근·quorum을 함께 계산합니다. PDB·topology·복제·앱 drain은 서로 보완하는 별도 계약입니다. 정상 유지보수만이 아니라 알림 없는 노드 손실에서도 데이터 재처리·세션 복구가 안전해야 합니다.

진단에서 eviction 거절만 보면 PDB가 고장 났다고 결론 내릴 수 없습니다. 대상 집합이 비었는지, 대체 Pod가 Pending인지, readiness가 실패했는지, 다른 drain이 이미 예산을 사용했는지를 사건 시간순으로 확인해야 합니다. 강제 삭제는 예산을 통과한 성공 사례가 아니라 보호 경계를 우회한 별도 결과로 기록합니다.

## 허용·차단·강제 장애의 검증 범위

격리 클러스터에서 정상 drain, 이미 하나 unhealthy인 drain, selector 오류, Pending 대체 Pod, 영역 손실을 각각 시험합니다. Eviction 응답과 PDB 상태·Pod 사건·실제 성공 요청 수를 함께 확인합니다. 장애 후 재처리의 중복·누락도 따로 검사합니다.

현재 작업에서는 PDB나 영역 장애 시험을 실행하지 않았습니다. 수치 예제와 설정 의미를 설명한 것이며 실제 가용성을 검증했다는 보고는 아닙니다.
