---
id: "storage-snapshot-database-consistency"
title: "볼륨 snapshot으로 DB를 복구하려 합니다. crash-consistent·앱 일관성과 논리 백업은 어떻게 검증하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Kubernetes","PVC","스토리지","심화 질문"]
related: ["k8s-stateful-storage","k8s-pod-deployment-statefulset","backup-restore-rpo-rto"]
promotedFrom: {"id":"k8s-stateful-storage","prompt":"스토리지 스냅샷과 DB 논리 백업을 일관된 복구 시점과 검증 방법으로 비교해 보세요."}
---

# 볼륨 snapshot으로 DB를 복구하려 합니다. crash-consistent·앱 일관성과 논리 백업은 어떻게 검증하나요?

## 구두 답변

볼륨 snapshot은 파일시스템의 특정 저장 상태를 보존할 수 있지만 DB의 일관된 transaction과 메모리 상태까지 자동 포함하지 않습니다. crash recovery가 가능한 로그·페이지 조합인지 확인합니다.

여러 볼륨을 쓰는 DB는 snapshot 간 기준 일치가 필요할 수 있습니다. 논리 백업은 스키마·데이터 계약과 복원 시간을 따로 봅니다. 별도 환경에서 실제 복구와 핵심 불변식을 검증합니다.

## 득점 포인트

- 볼륨 snapshot은 파일시스템의 특정 저장 상태를 보존할 수 있지만 DB의 일관된 transaction과 메모리 상태까지 자동 포함하지 않습니다. crash recovery가 가능한 로그·페이지 조합인지 확인합니다.
- 별도 환경에서 실제 복구와 핵심 불변식을 검증합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 볼륨 snapshot은 파일시스템의 특정 저장 상태를 보존할 수 있지만 DB의 일관된 transaction과 메모리 상태까지 자동 포함하지 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: StatefulSet의 Pod가 재시작할 때 PVC가 다시 붙는다면 데이터의 복제·일관성·가용성도 보장되나요?](/tech-interview/questions/k8s-stateful-storage/)
