---
id: "backfill-checkpoint-concurrent-write"
title: "백필이 읽은 값을 쓰기 전에 정상 요청이 같은 행을 바꿨습니다. checkpoint와 충돌 행을 어떻게 재개 가능하게 관리하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["스키마 마이그레이션","호환성","배포","심화 질문"]
related: ["db-online-schema-migration","db-lock-escalation"]
promotedFrom: {"id":"db-online-schema-migration","prompt":"백필 진행 위치와 충돌 행을 재시작 가능하게 저장해 보세요."}
---

# 백필이 읽은 값을 쓰기 전에 정상 요청이 같은 행을 바꿨습니다. checkpoint와 충돌 행을 어떻게 재개 가능하게 관리하나요?

## 구두 답변

안정적인 원본 키와 기준 version을 저장하고 현재 값이 읽은 조건과 맞을 때만 백필합니다. checkpoint는 실제 반영된 범위와 일치해야 하며 먼저 전진시켜 미처리 행을 건너뛰지 않습니다.

충돌 행은 최신 상태로 다시 계산하거나 별도 대기 집합에 남깁니다. 단순 updated_at 대소만으로 권위를 추측하지 않습니다. 중단·재시작·동시 상태 변경·부분 batch 실패에서 새 정상 쓰기를 덮지 않는지 대조합니다.

## 득점 포인트

- 안정적인 원본 키와 기준 version을 저장하고 현재 값이 읽은 조건과 맞을 때만 백필합니다. checkpoint는 실제 반영된 범위와 일치해야 하며 먼저 전진시켜 미처리 행을 건너뛰지 않습니다.
- 중단·재시작·동시 상태 변경·부분 batch 실패에서 새 정상 쓰기를 덮지 않는지 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 안정적인 원본 키와 기준 version을 저장하고 현재 값이 읽은 조건과 맞을 때만 백필합니다.

## 더 파고들 거리

- [기본 상황과 비교: 운영 중인 DB의 문자열 상태를 새 코드 컬럼으로 옮기려 합니다. 구버전 서버가 남아 있고 쓰기가 계속될 때 어떻게 전환하나요?](/tech-interview/questions/db-online-schema-migration/)
