---
id: "dual-column-source-of-truth"
title: "이전·새 컬럼을 함께 쓰는데 값이 다릅니다. 어느 표현이 원본인지와 보정 기준을 어떻게 정하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["스키마 마이그레이션","호환성","배포","심화 질문"]
related: ["db-online-schema-migration","db-lock-escalation"]
promotedFrom: {"id":"db-online-schema-migration","prompt":"두 표현 불일치의 원본·버전 기준과 복구 절차를 만들어 보세요."}
---

# 이전·새 컬럼을 함께 쓰는데 값이 다릅니다. 어느 표현이 원본인지와 보정 기준을 어떻게 정하나요?

## 구두 답변

전환 단계별 원본 표현을 명시하고 두 컬럼이 다르면 writer version·변경 이력으로 원인을 조사합니다. updated_at이 크다는 이유만으로 어느 쪽이 맞는지 자동 결정하면 잘못된 백필이 정상 쓰기를 덮을 수 있습니다.

같은 transaction에서 이중 기록하거나 변경 로그로 보정하고 구버전 writer가 남은 동안 읽기 fallback을 관리합니다. 불일치 수와 원본 version을 관측합니다. 전환 후에도 rollback에 필요한 옛 표현을 언제 제거할지 별도 승인 기준을 둡니다.

## 득점 포인트

- 전환 단계별 원본 표현을 명시하고 두 컬럼이 다르면 writer version·변경 이력으로 원인을 조사합니다. updated_at이 크다는 이유만으로 어느 쪽이 맞는지 자동 결정하면 잘못된 백필이 정상 쓰기를 덮을 수 있습니다.
- 전환 후에도 rollback에 필요한 옛 표현을 언제 제거할지 별도 승인 기준을 둡니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 전환 단계별 원본 표현을 명시하고 두 컬럼이 다르면 writer version·변경 이력으로 원인을 조사합니다.

## 더 파고들 거리

- [기본 상황과 비교: 운영 중인 DB의 문자열 상태를 새 코드 컬럼으로 옮기려 합니다. 구버전 서버가 남아 있고 쓰기가 계속될 때 어떻게 전환하나요?](/tech-interview/questions/db-online-schema-migration/)
