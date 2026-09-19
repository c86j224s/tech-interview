---
id: crd-served-storage-migration
title: >-
  CRD에서 served version과 storage version은 어떻게 다르며 storage version 변경이 기존 객체를 즉시
  모두 바꾼다고 할 수 없는 이유는 무엇인가요?
difficulty: 중하
category: 인프라
tags:
  - CRD
  - versioning
  - conversion
related:
  - api-backward-compatibility
---
# CRD에서 served version과 storage version은 어떻게 다르며 storage version 변경이 기존 객체를 즉시 모두 바꾼다고 할 수 없는 이유는 무엇인가요?

## 구두 답변
`served`는 클라이언트가 접근할 API version endpoint를 제공한다는 뜻이고, `storage`는 여러 표현 중 API 서버가 backend에 기록할 기준 version을 하나 선택한다는 뜻입니다. 예를 들어 v1beta1과 v1을 모두 served로 두고 v1만 storage로 두면, `/apis/example/v1beta1` GET 응답은 v1beta1 표현일 수 있지만 etcd 저장 표현이 v1beta1이라는 증거는 아닙니다. T0에 v1beta1로 만든 A와 T1 storage 전환 뒤 만든 B는 한동안 저장 표현이 다를 수 있습니다.

A를 v1 endpoint로 GET하면 API 서버가 저장 표현을 응답 표현으로 변환할 뿐, GET 자체가 A를 backend에 v1로 다시 썼다고 말할 수 없습니다. A가 v1로 재작성되는 계기는 update, 별도의 Storage Version Migration, 또는 공식 수동 절차처럼 기존 객체를 list한 뒤 같은 내용을 write하는 작업입니다. `status.storedVersions`는 과거 storage version의 흔적을 보여 주지만 각 객체 분포를 직접 세어 주는 목록은 아니므로 샘플 저장 경로와 migration 상태를 함께 확인합니다.

따라서 rollout은 v1과 v1beta1을 필요한 기간 served로 유지하고 conversion과 client 이동을 검증한 뒤 migration 완료, old storedVersions 정리, old endpoint 중단 순서로 진행합니다. storage flag 변경만으로 과거 모든 객체의 즉시 rewrite나 rollback 가능성을 증명할 수 없습니다. 실제 cluster를 실행하지 않은 답변이므로 A/B 시간축과 migration 결과는 설명용 상태 모델이며, 적용 시 control-plane 버전과 migration 도구·권한을 고정해야 합니다.

## 득점 포인트
- endpoint 표현과 etcd 저장 표현을 T0·T1 객체 A/B로 분리합니다.
- GET 변환과 UPDATE·migration에 의한 실제 재저장을 구별합니다.
- `status.storedVersions`와 old served 중단의 순서를 과장 없이 설명합니다.

## 감점 포인트
- URL version이나 storage flag 변경만으로 기존 etcd byte가 즉시 전부 바뀐다고 말하면 안 됩니다.
- served=false와 storage migration을 하나의 원자적 설정으로 취급하면 client 호환성 위험을 놓칩니다.
- `status.storedVersions`를 객체별 저장 version 목록으로 읽으면 관측 의미를 과대해석합니다.

## 더 파고들 거리
- Storage Version Migration 리소스의 권한, 진행 상태, 실패 후 재시작 조건을 target cluster에서 확인합니다.
- migration 중 defaulting·pruning·conversion이 의미를 바꾸지 않았는지 샘플과 UID를 비교합니다.
