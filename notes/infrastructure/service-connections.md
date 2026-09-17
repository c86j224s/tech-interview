---
id: service-connections
title: Kubernetes Service 발견과 장기 연결의 분산
topic: 인프라
summary: ClusterIP·Headless·EndpointSlice와 client resolver를 나누고 새 Pod·기존 HTTP/2·연결 수명·GOAWAY·drain·재개를 설명합니다.
questionIds: [k8s-service-network, headless-clusterip-selection-boundary]
---

# Kubernetes Service 발견과 장기 연결의 분산

## 새 Pod와 기존 TCP 연결의 backend 고정

클라이언트가 api-0으로 HTTP/2 연결 하나를 열고 수천 요청을 보냅니다. api-1을 추가해 Ready로 만들었어도 기존 연결의 스트림이 자동으로 api-1로 이동하지는 않습니다. Service의 backend 선택 단위와 HTTP/2의 요청 다중화 단위가 다르기 때문입니다.

연결 수준 분산에서는 새 TCP 연결이 만들어질 때 데이터 경로의 구성요소가 backend를 선택하고, 그 소켓이 살아 있는 동안에는 보통 같은 backend로 요청이 갑니다. 반대로 L7 프록시는 HTTP 요청을 본 뒤 한 client 연결 안에서도 요청마다 어느 backend로 보낼지 선택할 수 있으므로, 실제 배치에서 client·Service 경로·프록시 중 누가 이 선택을 맡는지 확인합니다.

EndpointSlice 갱신과 kube-proxy·CNI 데이터 경로의 반영은 이미 열린 TCP 소켓을 다른 Pod로 이주시키는 기능이 아닙니다.

## 주소 발견과 Backend 선택 책임

| 구성 | 클라이언트가 얻는 것 | 선택 책임 |
| --- | --- | --- |
| 일반 ClusterIP Service | 안정적인 가상 서비스 주소 | 데이터 경로가 endpoint로 전달 |
| Headless Service | 개별 endpoint 주소의 DNS 발견 | client resolver·balancer 비중 증가 |
| L7 proxy·mesh | 프록시 주소·프로토콜 경로 | 프록시와 client의 연결·요청 정책 |

먼저 일반 selector 기반 Service의 selector가 실제 Pod 라벨과 맞는지 보고, Service의 port가 targetPort로 어떻게 연결되는지 따라간 다음 EndpointSlice의 주소와 condition을 대조합니다. DNS 이름이 해석되어도 targetPort가 틀리면 연결은 실패합니다.

Headless Service에서는 selector 사용 여부와 주소를 누가 관리하는지, readiness endpoint 게시 정책이 무엇인지까지 따로 확인해야 하며 모든 구성에 같은 DNS 레코드가 자동으로 생긴다고 가정하지 않습니다.

```diagram
{"title":"새 endpoint는 새 선택에 사용될 수 있습니다","caption":"화살표는 연결 목적지입니다. 기존 client A의 연결은 api-0에 남고 새 client B가 api-1을 선택할 수 있지만 균등 요청 비용은 별도입니다.","rows":[[{"id":"old","label":"기존 연결 A"},{"id":"new","label":"새 연결 B"}],[{"id":"p0","label":"api-0"},{"id":"p1","label":"새 Ready api-1"}]],"edges":[{"from":"old","to":"p0","label":"기존 소켓 유지"},{"from":"new","to":"p1","label":"새 endpoint 선택 가능"}]}
```

## Resolver 갱신과 Client 분산 변화

Headless DNS에 주소가 추가되어도 client가 첫 주소만 고정하거나 무기한 resolver cache를 쓰면 새 Pod는 유휴일 수 있습니다. gRPC 채널의 resolver·balancing 정책·subchannel·연결 수명과 DNS TTL을 확인합니다. 주소 목록 최신성과 새 연결 생성은 서로 다른 사건입니다.

연결 수가 균등해도 요청 수·스트림 수·요청 비용은 불균등할 수 있습니다. 한 연결에 긴 export나 뜨거운 tenant가 몰리면 Pod 수를 늘려도 병목이 남습니다. backend별 활성 연결·stream·요청률·처리 시간·CPU·대기열을 함께 관찰합니다.

## 연결 교체와 재시도 부하 제어

필요하면 최대 연결 수명·유휴 종료·client 재해석·GOAWAY 등을 사용해 새 연결에서 새 backend를 고르게 할 수 있습니다. 모두 한꺼번에 끊으면 TLS handshake·인증·재시도 부하가 커집니다. jitter·제한된 교체율·기존 요청 완료를 프로토콜·라이브러리 계약에 맞게 적용합니다.

장기 스트림은 재연결 뒤 마지막 처리 위치·중복 이벤트·세션 상태를 복구해야 합니다. 소켓이 새 Pod로 연결됐다고 이전 서버의 메모리 상태가 복제되는 것은 아닙니다. 변경 요청은 실패 응답 유실과 재시도에 멱등 키·결과 조회를 유지합니다.

## Endpoint 제외와 기존 요청 drain

종료를 시작하면 readiness를 false로 만들거나 Pod가 terminating으로 표시되는 것만으로 끝났다고 보지 말고, 앱이 새 작업 수락을 차단하면서 기존 작업 drain을 함께 시작합니다. 기존 keep-alive 연결에서는 새 요청이 계속 올 수 있으므로, 새 요청은 거부하고 이미 진행 중인 작업은 drain(끝날 때까지 정리)합니다.

Endpoint 상태가 전파되어도 모든 프록시와 client가 같은 순간에 반영하지 않으므로, 전파 지연과 grace 예산을 고려해 이 경로를 정하고 실제 배치에서 앱이 새 작업을 언제 거부하고 기존 작업을 언제 끝내는지 관측합니다.

고정 preStop sleep 하나만으로 모든 전파가 완료됐다고 증명하지 않습니다. 종료 상태·활성 요청·끝나지 않은 메시지·연결을 관측하고 deadline 뒤에는 재전달·복구가 가능해야 합니다. 실제 버전의 EndpointSlice terminating·serving·ready 처리와 데이터 경로 지원도 확인합니다.

## 기존·신규 연결과 분포 측정

테스트 클러스터에서 client 연결을 먼저 유지한 채 새 Pod를 추가하고, 기존 연결과 신규 연결의 backend를 따로 기록합니다. Headless resolver 갱신·DNS 지연·readiness 전파·scale down을 시험하고 사용자 요청의 오류·중복·재개 결과를 봅니다.

현재 작업에서는 Kubernetes 네트워크 실험을 실행하지 않았습니다. 본문은 연결과 발견의 경계를 설명하며 실제 부하 분산 비율을 측정한 결과는 아닙니다.
