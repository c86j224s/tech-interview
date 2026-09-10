---
id: k8s-service-network
title: "Kubernetes Service 뒤에 새 Pod가 생겼는데도 이미 열린 HTTP/2 또는 TCP 연결의 요청이 옮겨가지 않는 이유는 무엇인가요?"
answerMinutes: 5
followups: [{"id":"http-connection-pool","prompt":"새 Pod가 추가됐는데 외부 HTTP 클라이언트의 기존 연결 풀만 계속 사용된다면 연결 수·수명·하위 서비스 부하를 어떻게 조정하겠습니까?"},{"id":"load-balancer-health-draining","prompt":"readiness를 실패시킨 뒤 로드밸런서와 EndpointSlice 전파가 늦어지면 기존 연결과 새 요청을 어떤 시간 순서로 드레이닝하겠습니까?"},{"id":"k8s-probe-contract","prompt":"애플리케이션이 포트는 열었지만 gRPC 스트림을 받을 준비가 안 됐다면 readiness probe의 성공 계약을 어떻게 바꾸겠습니까?"}]
difficulty: 중하
category: 인프라
tags: ["Kubernetes","Service","연결"]
related: ["http-connection-pool"]
---

# Kubernetes Service 뒤에 새 Pod가 생겼는데도 이미 열린 HTTP/2 또는 TCP 연결의 요청이 옮겨가지 않는 이유는 무엇인가요?

## 구두 답변

Kubernetes Service는 고정된 접근점과 현재 Ready인 endpoint 집합을 제공하지만, 이미 성립한 TCP 연결의 소켓이나 그 위의 애플리케이션 세션을 다른 Pod로 옮기지 않습니다. 새 연결이 만들어질 때 endpoint 선택이 다시 일어날 수 있지만, HTTP/1.1 keep-alive·HTTP/2·gRPC는 한 연결에 여러 요청을 실으므로 기존 연결이 계속 같은 Pod로 갈 수 있습니다. 따라서 Pod 수가 늘었는데도 트래픽이 분산되지 않는 것은 Service가 실패했다기보다 연결 수명과 분산 단위가 다르기 때문일 수 있습니다.

예를 들어 클라이언트가 하나의 gRPC 채널을 오랫동안 유지하고 그 채널이 `api-0`으로 연결됐다고 하겠습니다. 이후 `api-1`이 Ready가 되어도 기존 HTTP/2 스트림을 `api-1`로 재배치할 수 없습니다. 클라이언트가 새 연결을 만들거나 resolver가 endpoint 정보를 다시 읽고 client-side balancing 정책으로 새 선택을 해야 합니다. kube-proxy나 CNI가 endpoint 목록을 갱신하는 것도 이미 연결된 소켓을 이주시키는 동작은 아닙니다.

### endpoint 발견과 연결 선택을 분리합니다

먼저 Service selector가 올바른 Pod를 선택하는지, targetPort와 실제 listen 포트가 맞는지, EndpointSlice에 Ready 상태가 정확히 반영되는지, DNS가 올바른 주소를 반환하는지를 확인하겠습니다. 그 다음 클라이언트 연결 수, 연결별 요청 수, gRPC resolver 갱신, client-side load balancing, keep-alive·max connection age 정책을 봅니다. Service가 endpoint를 올바르게 갖고 있어도 클라이언트가 기존 채널만 재사용하면 새 Pod는 놀 수 있습니다. 반대로 readiness를 너무 빨리 성공시키면 실제 의존성이 준비되지 않은 Pod가 endpoint가 되어 오류를 만들 수 있습니다.

Headless Service는 일반 ClusterIP처럼 하나의 가상 IP가 endpoint 선택을 대행하지 않고 여러 Pod 주소를 DNS로 노출하는 방식이라 클라이언트가 선택 책임을 더 많이 집니다. 따라서 DNS TTL, resolver 캐시, 클라이언트의 주소 순환과 연결 재수립 정책을 함께 설계해야 합니다. 일반 Service와 Headless Service의 차이는 주소를 얻는 방식이지, 장기 TCP 연결이 자동으로 이동한다는 보장이 아닙니다.

### scale과 종료를 연결합니다

새 Pod로 부하를 옮기려면 필요한 경우 연결을 자연스럽게 재수립하거나 클라이언트가 새 endpoint를 선택하도록 해야 합니다. 하지만 무조건 기존 연결을 끊으면 사용자 오류와 재시도 폭증이 생깁니다. 연결 최대 수명을 두거나 서버가 GOAWAY를 보내 새 스트림을 다른 연결로 유도하는 방식은 프로토콜과 라이브러리 계약을 확인한 뒤 적용하겠습니다. 장기 스트리밍은 재연결 시 마지막 처리 위치, 중복 이벤트, 세션 상태를 별도로 복구해야 합니다.

Pod를 제거할 때는 readiness를 먼저 실패시켜 새 요청 유입을 줄이고, endpoint 전파 지연을 기다린 다음 `preStop`과 termination grace period 동안 기존 요청·스트림을 드레이닝합니다. readiness 실패가 기존 TCP 연결 종료를 보장하지 않으므로 애플리케이션과 로드밸런서의 종료 계약이 필요합니다. 검증은 scale up 뒤 기존·새 연결의 분포, 유휴 keep-alive, gRPC 장기 스트림, scale down 중 새 요청과 기존 스트림의 오류율을 나눠 측정합니다. 이처럼 Service의 **endpoint 선택**과 소켓의 **연결 수명**을 분리해 설명해야 실제 네트워크 동작을 놓치지 않습니다.

## 득점 포인트

- Service의 endpoint 선택과 이미 열린 TCP·HTTP/2 연결의 수명을 분리한다.
- EndpointSlice·DNS·resolver·client-side balancing을 실제 트래픽 분포 진단과 연결한다.
- readiness 실패, endpoint 전파, 연결 재수립, 스트리밍 복구를 종료 순서로 설명한다.

## 감점 포인트

- Pod가 늘면 기존 연결의 요청도 자동으로 새 Pod로 재분배된다고 말한다.
- Service가 있으면 readiness와 애플리케이션 준비가 자동으로 보장된다고 가정한다.
- scale down 때 모든 연결을 즉시 끊는 것을 보편적인 드레이닝 해법으로 제시한다.

## 더 파고들 거리

- Headless Service DNS와 ClusterIP Service의 클라이언트 선택 책임이 어떻게 다른지 설명해 보세요.
- EndpointSlice 전파 지연과 termination grace period를 고려한 안전한 종료 순서를 설계해 보세요.
- gRPC resolver·client-side balancing과 서버 측 Service를 함께 쓸 때 중복 분산을 어떻게 관찰할까요.
