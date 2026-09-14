---
id: "cpp-coroutine-destruction-executor"
title: "C++ 코루틴 프레임을 다른 스레드에서 파괴할 수 있습니다. 스레드에 종속된 자원의 소멸 위치는 어떻게 보장하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["C++","코루틴","버퍼 수명","심화 질문"]
related: ["cpp-coroutine-frame-lifetime","io-readiness-vs-completion","cpp-shared-pointer-lifetime"]
promotedFrom: {"id":"cpp-coroutine-frame-lifetime","prompt":"코루틴 프레임을 다른 executor에서 파괴할 때 소멸자 실행 위치를 어떻게 제한할까요?"}
---

# C++ 코루틴 프레임을 다른 스레드에서 파괴할 수 있습니다. 스레드에 종속된 자원의 소멸 위치는 어떻게 보장하나요?

## 구두 답변

프레임의 마지막 소유자가 어느 스레드에서 사라지는지와 destroy 호출 위치를 명시합니다. 특정 executor의 자원을 소멸해야 하면 파괴 작업을 그 executor에 넘기고 실제 완료까지 소유권을 유지합니다.

executor가 먼저 종료되면 파괴를 실행할 곳이 없어지므로 종료 순서를 설계합니다. 진행 중 I/O·continuation이 프레임을 참조하는 동안 destroy하지 않습니다. 논리 취소·최종 정지·핸들 파괴·자원 해제를 별도 상태와 테스트로 연결합니다.

## 득점 포인트

- 프레임의 마지막 소유자가 어느 스레드에서 사라지는지와 destroy 호출 위치를 명시합니다. 특정 executor의 자원을 소멸해야 하면 파괴 작업을 그 executor에 넘기고 실제 완료까지 소유권을 유지합니다.
- 논리 취소·최종 정지·핸들 파괴·자원 해제를 별도 상태와 테스트로 연결합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 프레임의 마지막 소유자가 어느 스레드에서 사라지는지와 destroy 호출 위치를 명시합니다.

## 더 파고들 거리

- [기본 상황과 비교: C++ 코루틴이 비동기 I/O를 기다리는 동안 호출자가 종료됩니다. 나중에 코루틴이 재개될 때 참조하던 객체와 버퍼가 유효하도록 수명을 어떻게 관리하나요?](/tech-interview/questions/cpp-coroutine-frame-lifetime/)
