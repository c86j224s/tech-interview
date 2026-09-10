---
id: k8s-service-network
title: "Kubernetes Service 뒤에 새 Pod가 생겼는데도 이미 열린 HTTP/2 또는 TCP 연결의 요청이 옮겨가지 않는 이유는 무엇인가요?"
difficulty: 중하
category: 인프라
tags: ["Kubernetes","Service","연결"]
related: ["http-connection-pool"]
---

# Kubernetes Service 뒤에 새 Pod가 생겼는데도 이미 열린 HTTP/2 또는 TCP 연결의 요청이 옮겨가지 않는 이유는 무엇인가요?

## 구두 답변

Service는 고정된 접근점과 현재 `Ready`인 endpoint 집합을 제공하지만, 이미 성립한 TCP 연결의 소켓이나 애플리케이션 세션을 다른 Pod로 이주시키지는 않습니다. 일반적인 Service 라우팅 선택은 새 연결이나 새 흐름에서 일어나며, HTTP/1.1 keep-alive·HTTP/2·gRPC처럼 한 연결에 여러 요청을 싣는 클라이언트는 기존 Pod를 계속 사용할 수 있습니다. 따라서 Pod 수가 늘었다는 사실과 요청 분포가 바뀌었다는 사실은 별도로 관찰해야 합니다.

새 요청이 계속 한 Pod에 몰리면 클라이언트 연결 수명, gRPC 채널이 서버 주소를 다시 찾는 resolver(주소 해석기)와 그 주소 중 하나를 고르는 client-side balancing(클라이언트 측 분산 선택), kube-proxy 또는 CNI가 endpoint 목록을 갱신하는 시점을 확인하겠습니다. 주소를 다시 찾지 않고 기존 채널만 재사용하면 새 Pod가 계속 놀 수 있으므로, 필요한 경우 연결 재수립이나 클라이언트 측 재분산을 적용합니다. Pod를 제거할 때는 readiness를 먼저 실패시키고 endpoint 전파 지연과 `preStop`·termination grace period 동안 진행 중 요청을 배출해야 합니다. Service가 있다고 readiness가 자동으로 맞춰지는 것도 아니므로 selector, targetPort, DNS, NetworkPolicy, 실제 API 응답을 단계별로 검사합니다.

해결책은 프로토콜에 따라 다릅니다. 연결을 주기적으로 재수립하거나 클라이언트가 endpoint를 다시 선택하게 할 수 있지만, 무조건 연결을 끊으면 사용자 오류가 커질 수 있습니다. 장기 스트리밍은 재연결·재개 위치·세션 상태 복구를 별도로 설계합니다. 검증은 scale up/down, 유휴 연결 재사용, 드레이닝 중 새 요청과 기존 스트림을 나누어 실제 오류율과 분포를 측정하는 방식으로 하겠습니다.

## 득점 포인트

- endpoint 선택과 기존 연결의 수명을 분리한다.
- HTTP/2·gRPC 장기 연결에서 생기는 편중을 설명한다.
- 발견·준비·전파·드레이닝을 단계별 점검으로 연결한다.

## 감점 포인트

- Pod가 늘면 기존 연결도 자동으로 재분배된다고 말한다.
- Service 생성만으로 애플리케이션 readiness가 보장된다고 말한다.
- 연결을 즉시 끊는 것을 모든 드레이닝의 기본 해법으로 삼는다.

## 더 파고들 거리

- Headless Service의 DNS 결과와 ClusterIP의 endpoint 선택은 클라이언트 동작에서 어떻게 다른가요?
- EndpointSlice 전파가 늦을 때 termination 순서를 어떻게 설계할까요?
- gRPC resolver와 client-side load balancing을 서버 측 Service와 어떻게 조합할까요?
