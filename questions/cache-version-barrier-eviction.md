---
id: "cache-version-barrier-eviction"
title: "캐시의 최신 버전 표식이 eviction됐습니다. 아직 진행 중인 옛 조회가 값을 다시 넣지 못하게 어떻게 보호하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["캐시","캐시 무효화","데이터 정합성","캐시 어사이드","최종 일관성","심화 질문"]
related: ["cache-aside-consistency","transaction-and-lost-update","request-timeout-idempotency"]
promotedFrom: {"id":"cache-aside-consistency","prompt":"eviction 뒤 세대 번호 보존"}
---

# 캐시의 최신 버전 표식이 eviction됐습니다. 아직 진행 중인 옛 조회가 값을 다시 넣지 못하게 어떻게 보호하나요?

## 구두 답변

최소 버전 표식이 사라지면 캐시 값이 비어 있어 옛 조회도 신규 값처럼 게시될 수 있습니다. 표식을 진행 중 읽기의 최대 수명보다 오래 유지하거나 cache 세대·권위 version을 별도 저장해야 합니다.

표식과 데이터의 비교·게시를 원자적으로 수행합니다. eviction 금지 저장도 장애·재시작으로 잃을 수 있어 가정과 복구 절차를 명시합니다. 표식 손실·DB 지연·무효화 유실을 순서대로 재현하고 안전하지 않으면 원본 조회·게시 제한으로 fallback합니다.

## 득점 포인트

- 최소 버전 표식이 사라지면 캐시 값이 비어 있어 옛 조회도 신규 값처럼 게시될 수 있습니다. 표식을 진행 중 읽기의 최대 수명보다 오래 유지하거나 cache 세대·권위 version을 별도 저장해야 합니다.
- 표식 손실·DB 지연·무효화 유실을 순서대로 재현하고 안전하지 않으면 원본 조회·게시 제한으로 fallback합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 최소 버전 표식이 사라지면 캐시 값이 비어 있어 옛 조회도 신규 값처럼 게시될 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 데이터베이스를 수정한 뒤 캐시를 삭제하면 오래된 값이 다시 캐시에 들어갈 가능성은 없나요?](/tech-interview/questions/cache-aside-consistency/)
