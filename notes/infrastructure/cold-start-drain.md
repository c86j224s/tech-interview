---
id: cold-start-drain
title: Scale-to-zero의 첫 처리와 마지막 작업 종료
topic: 인프라
summary: 감지부터 첫 ACK까지의 cold start·warm node와 Pod 비용·visible와 in-flight·축소 drain·진동의 관계를 설명합니다.
questionIds: [keda-scale-zero, warm-pod-versus-warm-node, queue-visible-inflight-scale-down]
---

# Scale-to-zero의 첫 처리와 마지막 작업 종료

## 첫 메시지는 Polling 뒤 바로 처리되지 않을 수 있습니다

consumer가 0개일 때 메시지가 도착하면, 먼저 scaler가 이벤트를 감지해 workload 활성화를 요청하고, Pod를 생성한 뒤 노드에 배치해야 합니다. 이어 이미지·앱 초기화·broker 연결·assignment를 거쳐야 첫 처리를 시작할 수 있습니다.

노드도 줄어 있다면 인스턴스 공급과 Node Ready 외에 CNI(네트워크 플러그인), CSI(스토리지 플러그인), DaemonSet(노드별 에이전트) 준비가 더해집니다. 따라서 첫 ACK 시각은 polling interval 하나가 아니라 각 단계의 소요 시간과 의존 관계로 계산해야 하며, 단계가 겹칠 수 있는지도 타임라인으로 확인해야 합니다.

```diagram
{"title":"첫 효과와 ACK까지 전체 준비 경로를 측정합니다","caption":"화살표는 단계별 시간 경계입니다. 일부 단계는 겹칠 수 있으므로 단순 추정 합뿐 아니라 실제 타임라인을 측정합니다.","rows":[[{"id":"event","label":"이벤트 도착·scaler 감지"}],[{"id":"node","label":"Pod·노드 배치 준비"}],[{"id":"app","label":"이미지·앱 초기화"}],[{"id":"broker","label":"연결·assignment·fetch"}],[{"id":"ack","label":"처리·효과 커밋·ACK"}]],"edges":[{"from":"event","to":"node","label":"활성화"},{"from":"node","to":"app","label":"실행 자원 준비"},{"from":"app","to":"broker","label":"소비 준비"},{"from":"broker","to":"ack","label":"첫 작업 실행"}]}
```

Pod 상태가 Running으로 바뀌어도 필수 설정을 읽고 broker assignment를 받은 뒤라는 뜻은 아니므로, 메시지를 바로 처리할 준비가 됐다고 세지 않습니다. readiness 실패만으로 pull consumer의 fetch가 자동 중단되지 않는다면, 앱이 초기화와 assignment를 끝낸 뒤에만 소비를 시작하고 종료 신호를 받으면 새 fetch를 먼저 멈추도록 구현합니다. 그래야 종료 중 새 작업이 계속 들어오는 것을 막으면서 실제 처리 준비와 상태 표시를 같은 기준으로 맞출 수 있습니다.

## Warm Node와 Warm Pod가 없애는 비용은 다릅니다

| 유지 대상 | 줄일 수 있는 지연 | 남는 비용·지연 |
| --- | --- | --- |
| warm node | 인스턴스 공급·부팅 | Pod 배치·이미지·앱 예열·연결 |
| image pre-pull | 이미지 다운로드 일부 | 버전별 이미지·앱 시작·초기화 |
| warm Ready Pod | 앱 준비·연결 비용 일부 | 실제 메시지 처리·할당·부하 확장 |
| 항상 최소 consumer | 첫 처리 준비 | 상시 CPU·메모리·연결·운영비 |

warm이라고 이름 붙인 Pod가 실제 Ready·broker 연결 상태가 아니면 준비 용량으로 세지 않습니다. 유휴 consumer도 Kafka assignment를 얻기 위한 group 조정이 필요할 수 있습니다. core controller·scaler·node provisioning 경로 자체가 scale-to-zero된 앱 노드에 의존해 순환 기동이 되지 않는지도 확인합니다.

허용 메시지 지연이 긴 배치와 즉시 응답해야 하는 사용자 요청은 다른 정책이 필요합니다. 긴 유휴 뒤 첫 메시지와 짧은 반복 burst의 비용을 따로 측정해 최소 용량을 정합니다.

## Visible이 0이어도 진행 중 변경은 남습니다

worker가 큐에서 메시지를 가져간 뒤에는 visible backlog에서 사라져도 DB 쓰기나 외부 효과가 끝나지 않은 in-flight 작업일 수 있습니다. 예를 들어 visible backlog=0인 시점에 축소를 완료하면 아직 확정하지 않은 작업을 끊을 수 있으므로, broker가 in-flight를 어떻게 정의하는지와 지표 지연을 확인하고 ACK 또는 commit이 어느 단계에서 발생하는지 함께 기록합니다.

Kafka에서는 committed lag가 마지막 커밋을 기준으로 하므로 처리 중 레코드 수와 항상 같은 값으로 보지 않습니다.

축소 요청이 오면 먼저 새 fetch와 자식 작업 수락을 막고, 이미 시작한 작업은 실제로 끝나면서 효과가 확정될 때까지 기다립니다. grace 안에 끝나면 효과를 확정한 뒤 ACK하고, 끝나지 않으면 checkpoint를 남기거나 안전하게 재전달해 새 worker가 이어서 처리하게 합니다. 효과가 이미 적용됐는지 응답만으로 알 수 없을 때는 같은 논리 키로 조회하고 멱등 처리해야 하며, replica 수를 0으로 만들려고 ACK부터 보내면 그 작업이 재전달되지 않아 누락될 수 있습니다.

## 제어기의 Cooldown과 앱의 Drain은 대체 관계가 아닙니다

cooldown은 짧은 수요 변동마다 0으로 줄었다 깨어나는 진동을 줄일 수 있습니다. HPA stabilization은 활성 replica 조정의 다른 경계에 작용할 수 있으므로 사용하는 KEDA 구성의 역할을 확인합니다. 어느 창도 앱의 진행 중 작업을 자동으로 완료하거나 보상하지 않습니다.

준비에 40초가 걸리는데 20초 간격 burst마다 완전히 내려가면 매번 cold start를 치를 수 있습니다. 창을 늘리면 비용이 늘지만 반복 예열·rebalance를 줄일 수 있습니다. 이 예는 설계 가정이며 적절한 시간은 실제 분포·SLO·비용으로 정합니다.

## 첫 이벤트와 마지막 실행을 같은 수명으로 관측합니다

이벤트 도착·감지·desired 변경·Node Ready·container 시작·assignment·첫 커밋·ACK 시각을 기록합니다. 축소에서는 fetch 중단·마지막 수락·마지막 효과·ACK·프로세스 종료를 분리합니다. 지표 API가 실패할 때도 작은 작업이 영원히 남지 않는 fallback과 경보를 검토합니다.

격리 환경에서 긴 유휴·반복 burst·노드 부족·처리 중 visible=0·종료 유예 초과를 시험합니다. 현재 작업에서 scale-to-zero를 실행하지 않았으므로 실제 첫 처리 p99나 비용 절감 수치를 제시하지 않습니다.
