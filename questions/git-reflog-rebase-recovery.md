---
id: "git-reflog-rebase-recovery"
title: "rebase 뒤 원래 커밋이 안 보입니다. reflog와 백업 참조로 무엇을 복구하고 어떤 검증을 해야 하나요?"
difficulty: "중하"
category: "설계"
tags: ["Git","merge","rebase","이력","심화 질문"]
related: ["git-merge-rebase"]
promotedFrom: {"id":"git-merge-rebase","prompt":"rebase로 커밋 ID와 부모가 바뀌는 과정과 reflog를 이용한 복구는 어떻게 연결되나요?"}
---

# rebase 뒤 원래 커밋이 안 보입니다. reflog와 백업 참조로 무엇을 복구하고 어떤 검증을 해야 하나요?

## 구두 답변

rebase는 새 부모 위에 커밋을 다시 만들어 ID를 바꿉니다. reflog는 로컬 참조가 이동한 이력을 찾는 데 도움되지만 영구 백업이나 원격 전체 복구 보증은 아닙니다.

먼저 현재 작업을 보존하고 원래 commit에 새 브랜치를 만들어 diff·range-diff·테스트로 대조합니다. 이미 공유한 이력을 강제 push하는 것은 별도 승인·정책이 필요합니다. reflog 만료·GC 전에 필요한 참조를 보존하고 파일 복구와 외부 배포 복구를 구분합니다.

## 득점 포인트

- rebase는 새 부모 위에 커밋을 다시 만들어 ID를 바꿉니다. reflog는 로컬 참조가 이동한 이력을 찾는 데 도움되지만 영구 백업이나 원격 전체 복구 보증은 아닙니다.
- reflog 만료·GC 전에 필요한 참조를 보존하고 파일 복구와 외부 배포 복구를 구분합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: rebase는 새 부모 위에 커밋을 다시 만들어 ID를 바꿉니다.

## 더 파고들 거리

- [기본 상황과 비교: 두 브랜치의 변경을 합칠 때 merge와 rebase는 이력을 어떻게 다르게 만들며, 공유 브랜치에서는 무엇을 조심해야 하나요?](/tech-interview/questions/git-merge-rebase/)
