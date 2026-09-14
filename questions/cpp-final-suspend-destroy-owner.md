---
id: "cpp-final-suspend-destroy-owner"
title: "C++ 코루틴이 final_suspend에 도달했습니다. 핸들과 프레임을 누가 언제 destroy해야 하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["C++","코루틴","버퍼 수명","심화 질문"]
related: ["cpp-coroutine-frame-lifetime","io-readiness-vs-completion","cpp-shared-pointer-lifetime"]
promotedFrom: {"id":"cpp-coroutine-frame-lifetime","prompt":"`final_suspend` 이후 핸들의 파괴 책임을 반환 타입에 어떻게 표현할까요?"}
---

# C++ 코루틴이 final_suspend에 도달했습니다. 핸들과 프레임을 누가 언제 destroy해야 하나요?

## 구두 답변

final_suspend에서 정지한 프레임은 누군가 destroy할 책임을 가져야 하며 완료됐다는 논리 상태와 메모리 해제를 구분합니다. 반환 타입·awaiter·scheduler 중 소유자를 명시하고 중복 destroy를 막습니다.

suspend_never 등 최종 정지 선택에 따라 자동 파괴·핸들 유효성이 달라질 수 있어 핸들을 계속 유효하다고 가정하지 않습니다. 외부 I/O가 프레임을 참조하면 그 참조 종료 전에 파괴할 수 없습니다. 취소·완료·continuation 재개와 예외를 상태 머신으로 시험합니다.

## 득점 포인트

- final_suspend에서 정지한 프레임은 누군가 destroy할 책임을 가져야 하며 완료됐다는 논리 상태와 메모리 해제를 구분합니다. 반환 타입·awaiter·scheduler 중 소유자를 명시하고 중복 destroy를 막습니다.
- 취소·완료·continuation 재개와 예외를 상태 머신으로 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: final_suspend에서 정지한 프레임은 누군가 destroy할 책임을 가져야 하며 완료됐다는 논리 상태와 메모리 해제를 구분합니다.

## 더 파고들 거리

- [기본 상황과 비교: C++ 코루틴이 비동기 I/O를 기다리는 동안 호출자가 종료됩니다. 나중에 코루틴이 재개될 때 참조하던 객체와 버퍼가 유효하도록 수명을 어떻게 관리하나요?](/tech-interview/questions/cpp-coroutine-frame-lifetime/)
