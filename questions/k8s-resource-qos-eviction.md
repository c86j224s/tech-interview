---
id: "k8s-resource-qos-eviction"
title: "노드 메모리가 부족할 때 Pod가 종료됩니다. QoS 등급과 requests·limits는 어떤 관계인가요?"
answerMinutes: 5
followups: [{"id": "k8s-requests-limits", "prompt": "스케줄링 예약과 실행 중 CPU·메모리 제한은 어떤 별도 역할을 하나요?"}, {"id": "k8s-oom-throttling", "prompt": "Pod 종료와 살아 있지만 느린 상태를 메모리·CPU 지표로 어떻게 나누나요?"}, {"id": "k8s-pdb-eviction", "prompt": "PDB가 조절하는 자발적 중단과 막지 못하는 장애는 어떻게 구분하나요?"}]
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes", "인프라"]
related: ["k8s-requests-limits", "k8s-oom-throttling", "k8s-pdb-eviction"]
---

# 노드 메모리가 부족할 때 Pod가 종료됩니다. QoS 등급과 requests·limits는 어떤 관계인가요?

## 구두 답변

QoS는 Pod의 자원 요청·제한 구성에서 결정되는 분류이고 노드 압박 시 eviction 판단에 영향을 줄 수 있습니다. 하지만 특정 등급이면 절대 종료되지 않는다는 보장은 아니며 우선순위·사용량·노드 상태를 함께 봅니다.

### 동작 원리와 전제

컨테이너 limit 초과 OOM과 노드 전체 압박에 따른 eviction은 다른 경로입니다. Guaranteed·Burstable·BestEffort 조건을 실제 Kubernetes 버전과 Pod 구성에서 확인합니다. sidecar를 포함한 모든 컨테이너 설정이 영향을 줄 수 있습니다.

### 선택과 실패 처리

requests를 실제 사용량보다 너무 낮게 잡으면 스케줄링이 과밀해질 수 있고 너무 높으면 배치가 어려워집니다. 메모리는 CPU처럼 단순히 속도를 제한해 초과 사용을 해결할 수 없으므로 피크와 종료·재시도 정책을 설계합니다.

### 구체적인 사례와 검증

Burstable Pod가 request보다 훨씬 많은 메모리를 사용하는 경우와 Guaranteed Pod가 자기 limit을 넘는 경우는 같은 종료 원인이 아닙니다. 이벤트의 Evicted·OOMKilled와 node pressure를 대조합니다. QoS와 Pod priority를 함께 보고 실제 eviction 선택 규칙은 사용하는 버전에서 확인합니다. 중요한 서비스는 등급을 바꾸는 것 외에 독립 장애 영역·replica 여유·재시작·데이터 복구를 준비해야 합니다. 메모리 피크가 짧더라도 limit에 걸릴 수 있으므로 평균 사용량만으로 요청·제한을 설정하지 않습니다. 정상 종료 유예가 보장되지 않는 경로에서도 메시지 재처리와 상태 복구가 안전한지 확인하겠습니다.

메모리 압박·limit 초과·우선순위·재시작을 시험합니다. 이벤트·종료 사유·노드 지표를 대조하고 PDB가 비자발적 중단을 모두 막는다고 하지 않습니다. QoS 이름보다 실제 자원 계약과 장애 복구가 중요합니다.

## 득점 포인트

- 핵심 구분: QoS는 Pod의 자원 요청·제한 구성에서 결정되는 분류이고 노드 압박 시 eviction 판단에 영향을 줄 수 있습니다.
- 선택 조건: requests를 실제 사용량보다 너무 낮게 잡으면 스케줄링이 과밀해질 수 있고 너무 높으면 배치가 어려워집니다.
- 검증 기준: 메모리 압박·limit 초과·우선순위·재시작을 시험합니다.

## 감점 포인트

- Guaranteed 등급이면 어떤 메모리 장애에서도 Pod가 종료되지 않는다고 한다.

## 더 파고들 거리

- 스케줄링 예약과 실행 중 CPU·메모리 제한은 어떤 별도 역할을 하나요?
- Pod 종료와 살아 있지만 느린 상태를 메모리·CPU 지표로 어떻게 나누나요?
- PDB가 조절하는 자발적 중단과 막지 못하는 장애는 어떻게 구분하나요?
