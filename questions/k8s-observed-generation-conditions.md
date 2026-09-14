---
id: "k8s-observed-generation-conditions"
title: "status가 최신 spec을 관찰했다고 표시하지만 rollout은 끝나지 않았습니다. observedGeneration과 condition은 어떻게 읽나요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","컨트롤러","reconciliation","심화 질문"]
related: ["k8s-reconciliation","retry-safe-state-machine"]
promotedFrom: {"id":"k8s-reconciliation","prompt":"status가 최신 spec을 관찰했어도 rollout이 진행되지 않는 사례를 어떤 condition으로 구분할까요."}
---

# status가 최신 spec을 관찰했다고 표시하지만 rollout은 끝나지 않았습니다. observedGeneration과 condition은 어떻게 읽나요?

## 구두 답변

observedGeneration은 controller가 어느 spec 세대를 관찰했는지 나타내는 데 쓰이며 원하는 상태를 달성했다는 뜻은 아닙니다. 관련 condition·reason·updated/available replica와 operation 상태를 확인합니다.

새 spec을 읽었어도 quota·이미지·스케줄링·readiness가 막을 수 있습니다. 객체 종류별 status 계약을 따르고 현재 generation과 오래된 condition을 혼합하지 않습니다. 선언 성공과 rollout 완료를 별도 검증합니다.

## 득점 포인트

- observedGeneration은 controller가 어느 spec 세대를 관찰했는지 나타내는 데 쓰이며 원하는 상태를 달성했다는 뜻은 아닙니다. 관련 condition·reason·updated/available replica와 operation 상태를 확인합니다.
- 선언 성공과 rollout 완료를 별도 검증합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: observedGeneration은 controller가 어느 spec 세대를 관찰했는지 나타내는 데 쓰이며 원하는 상태를 달성했다는 뜻은 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: Kubernetes에 Deployment 복제본 수를 바꾸는 요청은 성공했는데 Pod가 아직 준비되지 않았습니다. 선언은 어떤 과정을 거쳐 실제 상태가 되나요?](/tech-interview/questions/k8s-reconciliation/)
