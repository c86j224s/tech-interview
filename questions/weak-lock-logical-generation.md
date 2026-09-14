---
id: "weak-lock-logical-generation"
title: "weak_ptr::lock은 성공했지만 작업은 이미 취소됐습니다. 객체 생존과 현재 행동의 유효성을 어떻게 구분하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["C++","shared_ptr","소유권","심화 질문"]
related: ["cpp-shared-pointer-lifetime","atomics-memory-order"]
promotedFrom: {"id":"cpp-shared-pointer-lifetime","prompt":"`weak_ptr::lock()` 뒤 객체가 취소된 세대인지 어떤 상태를 확인할까요?"}
---

# weak_ptr::lock은 성공했지만 작업은 이미 취소됐습니다. 객체 생존과 현재 행동의 유효성을 어떻게 구분하나요?

## 구두 답변

weak_ptr::lock은 객체 메모리를 사용할 강한 참조를 얻는 동작입니다. 그 객체의 작업이 아직 유효한 세대인지, 취소·종료되지 않았는지는 상태를 별도로 검사해야 합니다.

행동 7의 callback이 객체를 살려 두더라도 현재 행동이 8이면 결과를 적용하지 않습니다. version 검사와 실제 변경을 같은 동기화 경계에 두고 옛 callback의 자원만 정리합니다. 수명 보호와 실행권 확인을 합치지 않고 취소·재개 경쟁을 시험합니다.

## 득점 포인트

- weak_ptr::lock은 객체 메모리를 사용할 강한 참조를 얻는 동작입니다. 그 객체의 작업이 아직 유효한 세대인지, 취소·종료되지 않았는지는 상태를 별도로 검사해야 합니다.
- 수명 보호와 실행권 확인을 합치지 않고 취소·재개 경쟁을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: weak_ptr::lock은 객체 메모리를 사용할 강한 참조를 얻는 동작입니다.

## 더 파고들 거리

- [기본 상황과 비교: C++ 비동기 콜백에 shared_ptr를 복사해 넘겼습니다. 객체 수명과 여러 스레드의 필드 수정이 모두 안전해지나요?](/tech-interview/questions/cpp-shared-pointer-lifetime/)
