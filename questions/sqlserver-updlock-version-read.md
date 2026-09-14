---
id: "sqlserver-updlock-version-read"
title: "SQL Server에서 버전 읽기와 UPDLOCK을 섞습니다. 읽는 시점과 쓰기 대기·충돌은 어떤 설정을 따라가나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["SQL Server","RCSI","SNAPSHOT","심화 질문"]
related: ["sqlserver-rcsi-snapshot","db-mvcc-snapshot","transaction-and-lost-update"]
promotedFrom: {"id":"sqlserver-rcsi-snapshot","prompt":"`UPDLOCK`과 버전 읽기를 섞을 때 어떤 잠금·시점 계약을 확인하나요?"}
---

# SQL Server에서 버전 읽기와 UPDLOCK을 섞습니다. 읽는 시점과 쓰기 대기·충돌은 어떤 설정을 따라가나요?

## 구두 답변

UPDLOCK은 후속 갱신을 위한 잠금 읽기의 의미를 바꿀 수 있어 기본 버전 읽기와 동일 snapshot이라고 가정하지 않습니다. RCSI·SNAPSHOT·힌트 조합의 실제 엔진 계약을 확인합니다.

최신 행을 잠그는 범위·index·lock 보유·업데이트 충돌을 두 세션으로 시험합니다. 낮은 격리나 힌트가 전체 불변식을 자동 보호하지 않습니다. 충돌 시 transaction 재시도와 외부 효과를 분리합니다.

## 득점 포인트

- UPDLOCK은 후속 갱신을 위한 잠금 읽기의 의미를 바꿀 수 있어 기본 버전 읽기와 동일 snapshot이라고 가정하지 않습니다. RCSI·SNAPSHOT·힌트 조합의 실제 엔진 계약을 확인합니다.
- 충돌 시 transaction 재시도와 외부 효과를 분리합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: UPDLOCK은 후속 갱신을 위한 잠금 읽기의 의미를 바꿀 수 있어 기본 버전 읽기와 동일 snapshot이라고 가정하지 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: SQL Server 트랜잭션에서 같은 행을 두 번 읽는 사이 다른 요청이 값을 바꿨습니다. RCSI와 SNAPSHOT은 두 번째 읽기와 이후 쓰기 충돌을 어떻게 다르게 처리하나요?](/tech-interview/questions/sqlserver-rcsi-snapshot/)
