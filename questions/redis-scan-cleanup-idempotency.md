---
id: "redis-scan-cleanup-idempotency"
title: "SCAN으로 같은 키를 여러 번 만날 수 있습니다. 값이 바뀌는 중 삭제 작업을 어떤 버전 조건으로 안전하게 만드나요?"
difficulty: "중하"
category: "성능"
tags: ["Redis","big key","SCAN","심화 질문"]
related: ["redis-bigkey-scan","redis-thread-model"]
promotedFrom: {"id":"redis-bigkey-scan","prompt":"중복 키를 만나는 정리 작업을 어떤 조건부 연산으로 멱등화할까요?"}
---

# SCAN으로 같은 키를 여러 번 만날 수 있습니다. 값이 바뀌는 중 삭제 작업을 어떤 버전 조건으로 안전하게 만드나요?

## 구두 답변

SCAN은 중복 키를 반환할 수 있고 순회 중 데이터가 바뀌면 고정 snapshot이 아닙니다. 삭제할 대상의 현재 version·소유·조건을 실제 삭제와 원자적으로 비교해야 합니다.

옛 조회가 본 키 이름이 새 값으로 재생성됐을 수 있어 이름만 보고 지우지 않습니다. Lua·조건부 연산·재조회 등 지원 범위를 사용합니다. 작업 재개·중복·동시 갱신과 큰 키 해제 비용을 시험합니다.

## 득점 포인트

- SCAN은 중복 키를 반환할 수 있고 순회 중 데이터가 바뀌면 고정 snapshot이 아닙니다. 삭제할 대상의 현재 version·소유·조건을 실제 삭제와 원자적으로 비교해야 합니다.
- 작업 재개·중복·동시 갱신과 큰 키 해제 비용을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: SCAN은 중복 키를 반환할 수 있고 순회 중 데이터가 바뀌면 고정 snapshot이 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: 운영 Redis에서 큰 키를 찾고 삭제하려는데 다른 요청이 멈출까 걱정됩니다. KEYS와 큰 키 삭제는 왜 지연을 만들며 어떻게 나눠 조사하고 정리하나요?](/tech-interview/questions/redis-bigkey-scan/)
