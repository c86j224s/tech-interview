---
id: "replica-long-query-replay-conflict"
title: "읽기 replica의 긴 조회가 로그 적용과 충돌합니다. 쿼리 취소와 복제 지연·버전 보존을 어떻게 선택하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["읽기 복제본","복제 지연","일관성","심화 질문"]
related: ["db-read-replica-consistency","cache-aside-consistency"]
promotedFrom: {"id":"db-read-replica-consistency","prompt":"오래된 읽기가 정리·로그 적용을 막는 상황을 재현해 보세요."}
---

# 읽기 replica의 긴 조회가 로그 적용과 충돌합니다. 쿼리 취소와 복제 지연·버전 보존을 어떻게 선택하나요?

## 구두 답변

replica의 긴 snapshot은 원본 로그 재생이나 오래된 버전 정리와 충돌할 수 있습니다. 엔진은 쿼리 취소·재생 지연·원본 정리 지연 등 다른 정책을 제공하므로 실제 설정을 확인합니다.

PostgreSQL의 standby feedback 같은 선택은 replica 조회를 돕는 대신 primary bloat를 늘릴 수 있습니다. 보고서를 별도 저장소로 옮기거나 짧은 snapshot을 검토합니다. replay 위치·최장 transaction·취소 사유와 원본 공간을 함께 측정합니다.

## 득점 포인트

- replica의 긴 snapshot은 원본 로그 재생이나 오래된 버전 정리와 충돌할 수 있습니다. 엔진은 쿼리 취소·재생 지연·원본 정리 지연 등 다른 정책을 제공하므로 실제 설정을 확인합니다.
- replay 위치·최장 transaction·취소 사유와 원본 공간을 함께 측정합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: replica의 긴 snapshot은 원본 로그 재생이나 오래된 버전 정리와 충돌할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 프로필 저장은 성공했는데 새로고침하면 옛값이 보입니다. 읽기 복제본의 지연을 어떻게 확인하고 방지하나요?](/tech-interview/questions/db-read-replica-consistency/)
