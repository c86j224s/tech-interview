---
id: "undo-redo-branch-history"
title: "undo 뒤 새 작업을 실행했습니다. undo·redo 두 스택과 외부 효과의 보정은 어떻게 바뀌나요?"
difficulty: "중하"
category: "자료구조"
tags: ["스택","큐","순서","심화 질문"]
related: ["stack-queue-traversal","mutex-vs-serial-execution"]
promotedFrom: {"id":"stack-queue-traversal","prompt":"redo를 추가할 때 실행·undo·새 분기에서 두 스택을 갱신하는 규칙을 설명해 보세요."}
---

# undo 뒤 새 작업을 실행했습니다. undo·redo 두 스택과 외부 효과의 보정은 어떻게 바뀌나요?

## 구두 답변

새 작업은 undo stack에 기록하고 redo 분기는 보통 지웁니다. undo는 최근 작업의 역연산·이전 상태를 적용해 redo 쪽으로 옮기며 단순 동작 이름만으로 복구할 수는 없습니다.

외부 결제처럼 역연산이 없는 효과는 별도 보정으로 다룹니다. 큰 이력의 저장량·병합·snapshot·동시 편집 version을 관리합니다. undo 뒤 새 분기·실패·재실행의 상태를 시험합니다.

## 득점 포인트

- 새 작업은 undo stack에 기록하고 redo 분기는 보통 지웁니다. undo는 최근 작업의 역연산·이전 상태를 적용해 redo 쪽으로 옮기며 단순 동작 이름만으로 복구할 수는 없습니다.
- undo 뒤 새 분기·실패·재실행의 상태를 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 새 작업은 undo stack에 기록하고 redo 분기는 보통 지웁니다.

## 더 파고들 거리

- [기본 상황과 비교: 되돌리기 기능과 먼저 들어온 작업 처리는 왜 각각 스택과 큐에 어울리나요?](/tech-interview/questions/stack-queue-traversal/)
