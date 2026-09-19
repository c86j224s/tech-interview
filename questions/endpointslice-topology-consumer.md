---
id: endpointslice-topology-consumer
title: zone topology 정보가 있어도 모든 client가 가까운 Pod를 고르지 않는 이유는 무엇인가요?
difficulty: 중하
category: 인프라
tags:
  - EndpointSlice
  - ready
  - serving
  - terminating
related:
  - headless-clusterip-selection-boundary
---
# zone topology 정보가 있어도 모든 client가 가까운 Pod를 고르지 않는 이유는 무엇인가요?

## 구두 답변

EndpointSlice의 zone은 endpoint 위치를 게시하는 metadata이지 모든 client에 locality 선택을 강제하는 명령이 아닙니다. ClusterIP에서는 kube-proxy나 dataplane이 backend를 고르고, headless Service에서는 DNS 결과를 받은 resolver·애플리케이션이 고르며, mesh가 있으면 L7 proxy가 locality policy를 가질 수 있습니다. 같은 zone endpoint가 없을 때 다른 zone으로 보낼지와 zone 비용·가용성 우선순위도 선택 계층의 정책입니다.

zone-a client가 a와 b backend를 모두 받았는데 첫 주소를 고정하면 b를 계속 선택할 수 있습니다. 반대로 topology-aware 기능이 켜진 dataplane이라도 connection pool이 이미 열린 HTTP/2 channel을 재사용하면 metadata 갱신이 기존 stream을 이주시키지 않습니다. 진단은 client 경로(ClusterIP, headless DNS, mesh), EndpointSlice 읽기 여부, locality feature, fallback, resolver 결과, 실제 backend zone과 connection ID를 나눠 기록합니다. 필드가 있다는 이유만으로 가까운 Pod 선택이나 기존 연결 이동을 성공으로 주장하지 않습니다. 가까운 zone을 선호하는 정책도 local endpoint 수와 connection reuse를 함께 봅니다. local 후보가 두 개뿐인데 하나의 장기 channel이 독점하면 원격 fallback을 금지하는 것이 오히려 가용성을 해칠 수 있으므로 선택 계층의 지표와 정책을 같이 검증합니다.

## 득점 포인트

- metadata 게시와 ClusterIP·headless·mesh의 선택 책임을 구분합니다.
- fallback과 기존 HTTP/2 연결 고정을 함께 진단합니다.

## 감점 포인트

- zone 필드가 모든 client의 locality routing을 강제한다고 합니다.
- DNS나 metadata 갱신이 열린 연결을 자동 이주시킨다고 합니다.

## 더 파고들 거리

- zone-local endpoint가 없을 때 비용과 가용성 fallback을 어디에 구현하나요?
- connection pool 재사용이 locality 정책을 가릴 때 어떤 지표를 보나요?
