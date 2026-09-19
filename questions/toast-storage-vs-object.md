---
id: toast-storage-vs-object
title: >-
  대형 파일을 PostgreSQL TOAST와 object storage 중 어디에 둘지 결정할 때 일관성·백업·조회 패턴을 어떻게
  비교하나요?
difficulty: 중하
category: 설계
tags:
  - PostgreSQL
  - TOAST
  - object storage
  - backup
related:
  - object-storage-consistency
---
# 대형 파일을 PostgreSQL TOAST와 object storage 중 어디에 둘지 결정할 때 일관성·백업·조회 패턴을 어떻게 비교하나요?

## 구두 답변

크기 하나로 결정하지 않고 원자성·읽기 패턴·백업 경계·수명 정책을 비교합니다. metadata와 blob이 같은 DB transaction에서 반드시 함께 확정되어야 하고 크기가 관리 가능한 범위라면 TOAST가 단순합니다. 반대로 200MB 이미지처럼 range read, streaming, CDN, 장기 lifecycle이 중요하고 DB 백업에 blob을 매번 포함시키는 비용이 크다면 object storage가 자연스럽습니다. TOAST는 DB row의 MVCC·백업·권한 경계 안에 있지만, object storage는 pointer와 객체 상태를 애플리케이션이 조정해야 합니다.

예를 들어 200KB metadata와 200MB image를 object에 올린 뒤 DB에 `object_key, version, checksum, state=ready`를 기록한다고 하겠습니다. upload가 성공했지만 DB commit이 실패하면 orphan이 생기고, DB가 먼저 ready가 되면 아직 없는 객체를 가리킬 수 있습니다. 그래서 불변 key로 `pending → verified → ready` 상태를 만들고, checksum 검증과 조건부 pointer 전환 후 실패한 pending을 lifecycle job으로 정리합니다. 반대로 TOAST를 택하면 한 transaction 조회는 쉬워지지만 큰 UPDATE가 새 row/TOAST를 만들 수 있고 DB backup·restore 시간이 커질 수 있습니다. object key가 저장됐다는 사실을 두 저장소의 원자 commit으로 표현하지 않습니다.

결정표에는 삭제와 복구도 넣습니다. TOAST 행 삭제는 DB transaction과 VACUUM 경계 안에서 관리되지만 파일 전체 복구는 DB 백업 단위에 묶일 수 있습니다. object storage는 range read와 lifecycle에 유리한 대신 DB 복구 시 pointer가 가리키는 version, checksum, 공개 권한을 대사해야 합니다. 따라서 `ready` 상태를 읽기 허용의 근거로 사용하고, orphan 정리 작업이 아직 진행 중인 pending 객체를 사용자에게 노출하지 않도록 합니다.

## 득점 포인트

- DB row atomicity와 object의 별도 lifecycle을 200KB/200MB 사례로 비교합니다.
- upload 성공·DB 실패와 DB 공개·object 부재의 두 불일치 상태를 설명합니다.
- checksum, 불변 key, 상태 전환, orphan 정리를 선택 기준에 포함합니다.

## 감점 포인트

- 큰 파일이면 object storage가 항상 더 싸고 빠르다고 단정합니다.
- DB pointer만 기록하면 object 존재·공개·삭제가 원자적으로 보장된다고 말합니다.
- object를 선택하면 backup, 권한, 보존, 대사 책임이 사라진다고 설명합니다.

## 더 파고들 거리

- CDN이 이전 version을 제공하는 동안 DB current pointer를 바꿀 때 공개 시점을 어떻게 정할지 설계해 보세요.
- 복구 시 DB가 앞선 경우와 object가 앞선 경우의 reconciliation 순서를 각각 써 보세요.
