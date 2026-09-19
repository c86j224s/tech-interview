---
id: kubernetes-endpointslice-termination
title: Kubernetes EndpointSlice의 readiness·terminating·serving
topic: 플랫폼
summary: >-
  EndpointSlice의 endpoint condition과 topology·계층화가 Service 트래픽 선택에 미치는 영향,
  terminating endpoint의 drain 의미를 설명합니다.
questionIds: []
prerequisites:
  - service-connections
  - probe-contracts
related: []
reviewedAt: '2026-09-19'
---
# Kubernetes EndpointSlice의 readiness·terminating·serving

EndpointSlice는 Service backend 주소를 여러 API 객체로 게시하는 표현입니다. 주소가 Slice에 있다는 사실, 신규 요청의 후보라는 사실, 이미 열린 연결이 그 주소를 계속 사용한다는 사실은 분리해야 합니다. 특히 Pod 삭제 중에는 `ready`, `serving`, `terminating`이 건강 점수처럼 합쳐지는 값이 아니라 서로 다른 lifecycle과 serving 의미를 전달합니다.

## Slice 집합과 주소 분할

한 Service에는 Slice가 하나만 존재한다는 보장이 없습니다. 기본 endpoint 수 제한을 100으로 놓고 101개 backend를 게시하면 최소 두 Slice가 필요합니다. `slice-a={pod-1...pod-100}`, `slice-b={pod-101}`인데 client가 a만 읽으면 pod-101은 발견되지 않습니다. 따라서 consumer는 Service를 가리키는 label을 기준으로 모든 Slice를 list/watch하고, 추가·수정·삭제를 반영해 `E = ⋃ Ei`라는 현재 집합을 유지해야 합니다.

append만 하는 집계기는 삭제 event와 watch 재연결에서 오류가 납니다. endpoint의 주소와 조건을 stable key로 갱신하고, resourceVersion이 오래되어 watch를 재개할 수 없으면 전체 list로 다시 동기화합니다. 같은 endpoint의 중복 event를 두 backend로 세면 부하 분산과 장애 감지 통계가 동시에 틀립니다. Slice sharding은 API payload 효율을 위한 방식이지 routing을 자동으로 수행하는 load balancer가 아닙니다.

## Endpoint 조건 의미

`terminating=true`는 endpoint가 삭제 수명에 들어갔다는 뜻입니다. `serving`은 현재 응답을 제공하고 있는지에 대한 신호이며, Pod-backed endpoint에서는 Pod Ready와 연결되는 의미를 가집니다. `ready`는 일반적으로 신규 ready backend로 사용할 수 있는지 판단하는 기존 consumer 경로와 연결됩니다. 종료 중 endpoint는 backward compatibility 때문에 ready=false가 될 수 있지만 serving=true일 수 있습니다.

따라서 `terminating=true, serving=true, ready=false`는 “일반 신규 ready 후보에서는 제외하되, 현재 응답을 제공 중인 endpoint일 수 있음”으로 읽습니다. 이 값이 열린 TCP socket을 다른 Pod로 이동시키거나 stream을 자동 완료시키는 명령은 아닙니다. 일반적으로 consumer는 terminating endpoint를 신규 선택에서 제외하지만, 모든 available endpoint가 terminating인 상황에서는 serving 중인 terminating endpoint를 계속 사용할 수 있는 예외가 있습니다. 이 예외를 빼면 장애 시 마지막 backend까지 버릴 수 있습니다.

## 종료와 연결 수명

Pod 종료 신호와 EndpointSlice 갱신 사이에는 전파 시간이 있습니다. 애플리케이션은 신규 요청 수락을 먼저 닫고 active request와 stream을 grace budget 안에서 끝내야 합니다. HTTP/2에서는 한 TCP 연결에 여러 stream이 있으므로 endpoint가 ready에서 빠져도 이미 열린 stream은 새 Pod로 이주하지 않습니다. 프록시의 GOAWAY, client 재연결, cursor 복구가 별도 계약인 이유입니다.

`serving=true`는 “현재 응답을 제공할 수 있음”이지 “모든 consumer가 drain을 구현했다”는 뜻이 아닙니다. 한 proxy는 terminating endpoint를 신규 후보에서 빼고, 다른 proxy는 all-terminating 예외로 serving endpoint를 선택할 수 있습니다. 따라서 상태 변화 시각, 신규 connection 수, 기존 stream 완료 시각, 재전달·중복 결과를 함께 관측해야 합니다.

## Topology metadata와 선택 책임

EndpointSlice의 zone·node 정보는 위치 metadata입니다. ClusterIP 경로에서는 kube-proxy 또는 dataplane이 선택하고, headless Service에서는 DNS resolver와 애플리케이션이 주소를 선택할 수 있으며, mesh가 있으면 L7 proxy의 locality policy가 책임을 집니다. 필드가 존재해도 모든 client가 zone-local routing을 수행한다는 보장은 없습니다.

zone-a client가 zone-a와 zone-b endpoint를 모두 받았다고 하겠습니다. headless client가 반환된 첫 주소를 고정하면 zone-b에 연결할 수 있고, ClusterIP dataplane이 locality를 켜지 않았으면 metadata는 선택에 영향을 주지 않습니다. 같은 zone endpoint가 부족할 때 다른 zone으로 보낼지, 오류를 반환할지, 비용보다 가용성을 우선할지는 해당 선택 계층의 정책으로 명시해야 합니다.

```diagram
{"title":"Endpoint 상태와 선택 계층","caption":"Slice는 상태와 위치를 게시하지만 신규 선택·drain·연결 재사용은 consumer 계층의 별도 계약입니다.","rows":[[{"id":"pod","label":"Pod lifecycle","detail":["ready·deletionTimestamp"]}],[{"id":"slice","label":"EndpointSlice","detail":["serving·terminating·topology"]}],[{"id":"consumer","label":"Consumer 선택","detail":["kube-proxy·mesh·client"]}],[{"id":"connection","label":"연결 수명","detail":["new stream·drain·retry"]}]],"edges":[{"from":"pod","to":"slice","label":"조건 게시"},{"from":"slice","to":"consumer","label":"backend 판단"},{"from":"consumer","to":"connection","label":"선택·재연결"}]}
```

## publishNotReadyAddresses 의미

`publishNotReadyAddresses=true`인 Service에서는 EndpointSlice의 `ready`가 일반 readiness probe 결과를 그대로 뜻하지 않습니다. Kubernetes 문서 계약상 이 설정에서는 ready가 항상 true로 게시될 수 있으므로, “애플리케이션이 아직 사용자 요청을 처리할 준비가 안 됐다”와 “peer discovery에 주소를 노출한다”를 분리해야 합니다. 초기화 중인 저장 서버가 서로를 찾아 join해야 하는 경우에는 discovery client가 주소를 사용하고, 사용자 traffic 경로는 protocol health나 별도 readiness 계약을 확인합니다.

예를 들어 Pod가 12:00에 주소로 게시됐지만 schema 초기화는 12:20에 끝난다고 하겠습니다. publishNotReadyAddresses가 켜진 Slice에서는 ready=true를 보고할 수 있습니다. 이 값을 일반 HTTP load balancer가 “즉시 안전한 backend”로 읽으면 초기화 오류를 사용자에게 보냅니다. 반대로 ready=false라고 가정해 주소를 제거하면 peer bootstrap이 막힙니다. Service port, targetPort, readiness gate, consumer 구현을 함께 검증해야 합니다.

## 집계와 검증 절차

검증 도구는 관련 Slice 전체를 수집해 endpoint 주소·condition·topology를 시간순으로 저장하고, Pod `deletionTimestamp`, readiness, termination grace와 대조합니다. 101개 입력에서는 100+1 집합이 되고, 두 번째 Slice 삭제 event 뒤에는 100개가 남아야 합니다. `publishNotReadyAddresses` fixture에서는 애플리케이션 health 실패, Slice ready 값, discovery 성공, 일반 요청 성공을 각각 기록합니다.

terminating fixture에서는 ready=false·serving=true인 endpoint가 신규 선택에서 제외되는지, 모든 endpoint가 terminating일 때 serving endpoint fallback이 있는지, 기존 HTTP/2 stream에 자동 socket migration이 없는지를 consumer별로 확인합니다. 이 작업에서는 cluster, kube-proxy, mesh를 실행하지 않았으므로 예상 관찰값입니다.

## 비용과 운영 경계

Slice 분할은 큰 변경 payload를 줄이지만 집계기 메모리와 resync 비용을 만듭니다. topology-local 우선은 latency와 zone 비용을 줄일 수 있지만 특정 zone 과부하와 장애 시 fallback을 유발합니다. 긴 stream의 drain은 rollout 시간을 늘리고, 짧은 grace는 재시도·중복·부분 처리 비용을 키웁니다. ready를 과신하면 초기화 Pod로 요청이 가고, serving을 과신하면 종료가 오래 지속됩니다.

## 참고자료와 범위

- [EndpointSlices](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/) — Slice 분할, endpoint conditions, topology, `publishNotReadyAddresses` 관련 공식 문서. 확인일 2026-09-19, 릴리스는 고정하지 않았습니다.
- [Pod termination flow](https://kubernetes.io/docs/tutorials/services/pods-and-endpoint-termination-flow/) — terminating endpoint의 ready·serving과 drain 흐름.
- [Service와 장기 연결](/tech-interview/notes/service-connections/) — 주소 발견과 기존 연결 수명의 인접 설명입니다.

특정 kube-proxy, mesh, custom client의 routing 결과는 이 노트에서 실행하지 않았습니다. 적용 버전과 consumer가 실제로 읽는 condition을 별도로 고정해야 합니다.
