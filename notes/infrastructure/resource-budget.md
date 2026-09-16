---
id: resource-budget
title: Kubernetes 자원 요청·상한·노드 여유 계산
topic: 인프라
summary: requests와 CPU·메모리 limits를 나누고 QoS·노드 eviction·sidecar·DaemonSet·allocatable·HPA 분모의 연결을 설명합니다.
questionIds: [k8s-requests-limits, k8s-resource-qos-eviction, sidecar-log-resource-interference, daemonset-node-capacity-overhead]
---

# Kubernetes 자원 요청·상한·노드 여유 계산

## Request는 배치 기준이고 Limit는 성능 보장량이 아닙니다

컨테이너의 CPU request=500m, limit=1이면 scheduler는 요청 자원을 배치 계산에 사용하고 런타임은 설정된 CPU 상한을 집행합니다. request가 최대 사용량이 아니고 limit가 항상 확보되는 CPU도 아닙니다. 노드 경쟁·quota 주기·throttling이 실제 지연에 영향을 줍니다.

메모리는 CPU처럼 실행 시간을 나누어 초과를 해소할 수 없습니다. cgroup의 메모리 한도와 압력에 따라 OOM 종료가 일어날 수 있습니다. 순간 피크·캐시·GC·native 메모리까지 포함하고 평균만으로 limit를 정하지 않습니다.

| 설정·관측 | 역할 | 구분할 실패 |
| --- | --- | --- |
| requests | 배치·자원 경쟁 기준 | 부족하면 Pending 또는 과밀 배치 |
| CPU limit | 사용 시간 quota 상한 | 살아 있지만 throttling으로 느림 |
| memory limit | 메모리 사용 제한 | 컨테이너 OOMKilled 가능 |
| node pressure | 노드 전체 자원 부족 | kubelet eviction·시스템 OOM |
| Pod priority·QoS | 압력·스케줄 정책 요소 | 절대 생존 보장 아님 |

request를 낮추면 scheduler는 같은 노드에 더 많은 Pod를 넣을 수 있지만 정상 피크 때 CPU 경쟁이 커질 수 있고, 높이면 실제 유휴가 있어도 Pending이 될 수 있습니다. CPU utilization 기반 HPA는 사용량을 request로 나누어 비율을 계산하므로, 같은 사용량이어도 request를 바꾸면 확장 입력이 달라집니다. 따라서 request 조정은 배치 가능 수와 HPA가 보는 비율을 함께 다시 계산해야 합니다.

## QoS 이름만으로 종료 순서를 고정하지 않습니다

전통적인 컨테이너별 자원 설정에서 모든 컨테이너의 CPU·메모리 request와 limit가 설정되고 각각 같으면 Guaranteed, 둘 다 전혀 없으면 BestEffort, 그 사이면 Burstable에 해당하는 구성이 일반적입니다. init·sidecar·Pod 수준 자원 기능 등 실제 Kubernetes 버전과 구성의 조건도 확인합니다.

node pressure eviction은 request 대비 초과 사용·priority·상대 사용량 같은 요인과 연결됩니다. QoS가 위험을 설명하는 데 도움되지만 “Guaranteed는 절대 종료되지 않는다”거나 QoS 이름만으로 모든 순서가 결정된다고 말하지 않습니다. Guaranteed 컨테이너도 자기 limit에 걸릴 수 있습니다. OOMKilled·Evicted·node condition·cgroup 지표를 대조합니다.

## 앱 외 자원도 노드 용량에 들어갑니다

노드 capacity가 CPU 8, 메모리 32 GiB이고 시스템 예약·kubelet·eviction 여유를 반영한 allocatable이 CPU 7, 28 GiB라고 합시다. 배치될 DaemonSet이 CPU 1, 3 GiB를 요청하면 앱에 남는 요청 예산은 CPU 6, 25 GiB입니다. 앱 Pod가 CPU 2, 8 GiB씩이면 이 산술에서는 3개가 가능하지만 Pod 수·IP·volume attach 등 다른 상한도 만족해야 합니다.

```diagram
{"title":"노드 총량에서 앱이 쓸 수 있는 배치 예산을 구합니다","caption":"화살표는 자원 예산 차감입니다. allocatable에 이미 반영된 시스템 예약을 다시 빼지 않고, 그 노드에 실제 배치될 DaemonSet과 기존 Pod 요청을 계산합니다.","rows":[[{"id":"capacity","label":"Node capacity"}],[{"id":"allocatable","label":"Node allocatable","detail":["시스템 예약·여유 반영"]}],[{"id":"daemon","label":"DaemonSet·기존 요청 제외"}],[{"id":"apps","label":"새 앱 Pod 배치 가능량"}]],"edges":[{"from":"capacity","to":"allocatable","label":"노드 예약 정책"},{"from":"allocatable","to":"daemon","label":"실제 배치 집합"},{"from":"daemon","to":"apps","label":"CPU·메모리·기타 상한"}]}
```

DaemonSet이 어느 노드에 실제로 들어가는지는 selector·taint toleration·architecture 등 실제 스케줄 조건을 대입해 결정하므로, allocatable에서 모든 DaemonSet을 일괄 차감하지 않고 해당 노드의 실제 배치 집합만 계산합니다. 인스턴스 유형을 넓힐 때는 네트워크·스토리지·GPU·Pod 수 한도를 후보별로 함께 대조합니다.

init container·native sidecar·Pod overhead의 유효 request는 단순 앱 컨테이너 합과 다를 수 있으므로 실제 scheduler 계약으로 계산합니다.

## Sidecar가 로그를 처리해도 비용이 사라지지 않습니다

로그 sink가 느려지면 sidecar의 큐·재시도·디스크 쓰기가 증가할 수 있습니다. 앱 CPU만 낮다고 문제가 없는 것이 아닙니다. 컨테이너별 CPU·메모리·ephemeral storage와 노드 디스크·네트워크를 같이 봅니다. stdout 경로가 막혀 앱의 로그 호출이 느려지는 경우도 있습니다.

로그 큐 바이트·최대 나이·전송률에 상한을 두고 진단 로그의 sampling·drop과 필수 감사 기록의 보존·실패 정책을 구분합니다. 필수 기록을 무조건 버리거나 모든 로그를 무한 메모리 큐에 넣지 않습니다. sidecar를 다른 Pod로 옮겨도 공유 노드·sink 용량은 여전히 제한됩니다.

## 숫자 조정은 실패 원인별 대조 실험으로 합니다

같은 앱 부하에서 CPU quota·노드 CPU 경쟁·메모리 피크·로그 sink 지연을 하나씩 바꿉니다. throttled time·run queue·GC·OOM·eviction 사건과 p99를 대조합니다. request 조정 뒤 Pending·노드 수·HPA 계산까지 함께 확인합니다.

현재 작업에서는 클러스터 자원 설정이나 OOM 실험을 실행하지 않았습니다. 수치 예는 배치 계산을 설명하는 가정이며 실제 인스턴스의 성능·생존 보장이 아닙니다.
