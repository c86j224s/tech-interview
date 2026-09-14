---
id: "raft-snapshot-applied-log-boundary"
title: "Raft commit은 120, apply는 115까지 진행됐습니다. snapshot과 남길 로그의 경계는 무엇이어야 하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Raft","스냅샷","로그 압축","심화 질문"]
related: ["raft-snapshot-compaction","raft-log-commit-apply"]
promotedFrom: {"id":"raft-snapshot-compaction","prompt":"생성 중 로그 경계"}
---

# Raft commit은 120, apply는 115까지 진행됐습니다. snapshot과 남길 로그의 경계는 무엇이어야 하나요?

## 구두 답변

현재 상태가 115까지 적용됐다면 snapshot의 포함 index도 그 상태와 일치해야 합니다. commit 120을 붙이면 복구가 116~120을 이미 적용한 것으로 보고 누락할 수 있습니다.

동시 쓰기 동안 일관된 view를 만들고 포함 term·구성·중복 기록을 보존합니다. snapshot 내구화·manifest 게시 뒤 안전한 접두 로그를 지웁니다. 생성·설치 중단과 다음 로그 재생을 대조합니다.

## 득점 포인트

- 현재 상태가 115까지 적용됐다면 snapshot의 포함 index도 그 상태와 일치해야 합니다. commit 120을 붙이면 복구가 116~120을 이미 적용한 것으로 보고 누락할 수 있습니다.
- 생성·설치 중단과 다음 로그 재생을 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 현재 상태가 115까지 적용됐다면 snapshot의 포함 index도 그 상태와 일치해야 합니다.

## 더 파고들 거리

- [기본 상황과 비교: Raft 로그가 커져 스냅샷을 만든 뒤 오래된 로그를 지우려 합니다. 중간에 서버가 꺼져도 복구할 수 있도록 어떤 기준과 저장 순서를 지켜야 하나요?](/tech-interview/questions/raft-snapshot-compaction/)
