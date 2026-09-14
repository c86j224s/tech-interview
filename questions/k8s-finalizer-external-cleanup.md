---
id: "k8s-finalizer-external-cleanup"
title: "Kubernetes 객체가 Terminating에 남아 있습니다. finalizer의 외부 자원과 정리 실패를 어떻게 조사하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","컨트롤러","reconciliation","심화 질문"]
related: ["k8s-reconciliation","retry-safe-state-machine"]
promotedFrom: {"id":"k8s-reconciliation","prompt":"finalizer가 남은 객체의 소유 외부 자원과 정리 완료를 어떻게 조사할까요."}
---

# Kubernetes 객체가 Terminating에 남아 있습니다. finalizer의 외부 자원과 정리 실패를 어떻게 조사하나요?

## 구두 답변

finalizer는 삭제 전에 외부 자원 정리를 수행할 controller의 책임을 나타낼 수 있습니다. 객체의 deletion timestamp·finalizer owner·controller 로그·외부 리소스 상태를 대조합니다.

이유 없이 finalizer를 강제 제거하면 외부 자원이 고아로 남을 수 있습니다. 정리 재시도는 멱등하게 하고 권한·네트워크·참조를 확인합니다. 객체 삭제와 데이터 보존 승인을 별도로 처리합니다.

## 득점 포인트

- finalizer는 삭제 전에 외부 자원 정리를 수행할 controller의 책임을 나타낼 수 있습니다. 객체의 deletion timestamp·finalizer owner·controller 로그·외부 리소스 상태를 대조합니다.
- 객체 삭제와 데이터 보존 승인을 별도로 처리합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: finalizer는 삭제 전에 외부 자원 정리를 수행할 controller의 책임을 나타낼 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Kubernetes에 Deployment 복제본 수를 바꾸는 요청은 성공했는데 Pod가 아직 준비되지 않았습니다. 선언은 어떤 과정을 거쳐 실제 상태가 되나요?](/tech-interview/questions/k8s-reconciliation/)
