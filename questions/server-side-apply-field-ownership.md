---
id: "server-side-apply-field-ownership"
title: "두 controller가 같은 필드를 바꿉니다. server-side apply의 필드 소유권 충돌을 어떻게 해결하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","컨트롤러","reconciliation","심화 질문"]
related: ["k8s-reconciliation","retry-safe-state-machine"]
promotedFrom: {"id":"k8s-reconciliation","prompt":"서로 다른 controller가 같은 필드를 변경할 때 server-side apply와 소유권을 어떻게 정리할까요."}
---

# 두 controller가 같은 필드를 바꿉니다. server-side apply의 필드 소유권 충돌을 어떻게 해결하나요?

## 구두 답변

managedFields와 manager별 의도를 확인하고 같은 필드를 누가 소유할지 정합니다. force apply로 충돌을 덮는 것은 소유권 이전이며 자동으로 올바른 설계가 되는 것은 아닙니다.

HPA·GitOps·운영자의 책임을 나누고 필드 제외가 숨기는 drift를 보완합니다. defaulting·mutating webhook과 버전별 동작도 확인합니다. controller 둘이 계속 되돌리는 루프를 실제 events로 재현합니다.

## 득점 포인트

- managedFields와 manager별 의도를 확인하고 같은 필드를 누가 소유할지 정합니다. force apply로 충돌을 덮는 것은 소유권 이전이며 자동으로 올바른 설계가 되는 것은 아닙니다.
- controller 둘이 계속 되돌리는 루프를 실제 events로 재현합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: managedFields와 manager별 의도를 확인하고 같은 필드를 누가 소유할지 정합니다.

## 더 파고들 거리

- [기본 상황과 비교: Kubernetes에 Deployment 복제본 수를 바꾸는 요청은 성공했는데 Pod가 아직 준비되지 않았습니다. 선언은 어떤 과정을 거쳐 실제 상태가 되나요?](/tech-interview/questions/k8s-reconciliation/)
