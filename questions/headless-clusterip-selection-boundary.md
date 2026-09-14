---
id: "headless-clusterip-selection-boundary"
title: "Headless Service와 ClusterIP에서 DNS 결과와 backend 선택은 각각 누가 책임지나요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","Service","연결","심화 질문"]
related: ["k8s-service-network","http-connection-pool"]
promotedFrom: {"id":"k8s-service-network","prompt":"Headless Service DNS와 ClusterIP Service의 클라이언트 선택 책임이 어떻게 다른지 설명해 보세요."}
---

# Headless Service와 ClusterIP에서 DNS 결과와 backend 선택은 각각 누가 책임지나요?

## 구두 답변

ClusterIP는 안정적인 서비스 주소 뒤의 endpoint 분산을 인프라가 처리할 수 있고 Headless는 endpoint 주소를 발견해 client가 선택하는 책임이 커집니다. DNS 결과가 현재 연결을 이동시키지는 않습니다.

resolver cache·client balancing·readiness·장기 HTTP/2 연결을 확인합니다. endpoint 목록이 최신이어도 불균등 요청 비용이 남을 수 있습니다. 새 Pod 추가·삭제·DNS 지연에서 실제 목적지를 추적합니다.

## 득점 포인트

- ClusterIP는 안정적인 서비스 주소 뒤의 endpoint 분산을 인프라가 처리할 수 있고 Headless는 endpoint 주소를 발견해 client가 선택하는 책임이 커집니다. DNS 결과가 현재 연결을 이동시키지는 않습니다.
- 새 Pod 추가·삭제·DNS 지연에서 실제 목적지를 추적합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: ClusterIP는 안정적인 서비스 주소 뒤의 endpoint 분산을 인프라가 처리할 수 있고 Headless는 endpoint 주소를 발견해 client가 선택하는 책임이 커집니다.

## 더 파고들 거리

- [기본 상황과 비교: Kubernetes Service 뒤에 새 Pod가 생겼는데도 이미 열린 HTTP/2 또는 TCP 연결의 요청이 옮겨가지 않는 이유는 무엇인가요?](/tech-interview/questions/k8s-service-network/)
