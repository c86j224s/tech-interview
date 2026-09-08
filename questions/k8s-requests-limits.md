---
id: k8s-requests-limits
title: "Kubernetes에서 컨테이너에 requests와 limits를 설정합니다. 노드 배치와 CPU·메모리 초과 처리에는 각각 어떻게 쓰이나요?"
difficulty: 하
category: 인프라
tags: ["Kubernetes","requests","limits"]
related: ["bounded-queue-backpressure"]
---

# Kubernetes에서 컨테이너에 requests와 limits를 설정합니다. 노드 배치와 CPU·메모리 초과 처리에는 각각 어떻게 쓰이나요?

## 구두 답변

requests는 스케줄러가 배치할 자원을 계산하고 일부 자원 경쟁의 기준으로 쓰는 값이고, limits는 실행 중 허용할 자원을 제한하는 값입니다. 둘 다 단순한 사용량 예측치가 아닙니다. CPU와 메모리도 초과했을 때의 동작이 다릅니다.

requests는 실행할 자리를 고를 때 필요한 자원으로 계산하는 값이고 limits는 실행 중 허용 범위를 제한하는 값입니다. 예를 들어 메모리 request를 1GiB로 선언했더라도 프로세스가 실제로 2GiB를 쓸 수는 있습니다. 그 사용이 허용되는지는 limit와 노드 여유에 달려 있으며, 선언보다 실제 사용이 많으면 노드 전체 경쟁이 커질 수 있습니다.

CPU limit에 도달하면 제한 방식에 따라 실행이 throttling될 수 있습니다. 메모리는 같은 방식으로 천천히 실행시키기 어려워 한도 초과가 OOM 종료로 이어질 수 있습니다. 저는 평균만 보지 않고 정상 피크와 시작·GC·캐시 예열 때의 사용량을 측정하겠습니다. request를 너무 낮추면 많은 Pod가 같은 노드에 배치돼 경쟁하고, 너무 높이면 배치와 확장이 비효율적입니다.

HPA가 CPU 이용률을 request 대비 비율로 볼 수 있어 request 변경은 확장 판단에도 영향을 줍니다. 저는 limit·request·autoscaling 목표를 따로 정하지 않고 함께 검증하겠습니다. 테스트는 CPU 경쟁과 메모리 피크를 나눠 주고 throttling 시간·OOM·응답 지연을 확인합니다. 설정된 숫자보다 실제 배치와 실행 제한이 어떤 결과를 만드는지 이해해야 합니다.

## 득점 포인트

- 배치 기준과 실행 제한을 구분한다.
- CPU·메모리 초과 동작을 나눈다.
- HPA와 피크 사용량을 함께 본다.

## 감점 포인트

- request는 최대 사용량이라고 말한다.
- CPU와 메모리는 초과 시 똑같이 대기한다고 말한다.
- 평균 메모리만으로 limit를 잡는다.

## 더 파고들 거리

- QoS 클래스는 노드 메모리 압력에서 어떤 역할을 하나요?
- CPU request 없이 utilization 기반 HPA를 쓰면 어떤 문제가 있나요?
- 사이드카 자원 요청도 전체 Pod 배치에 어떻게 포함되나요?
