---
id: "atomic-shared-pointer-snapshot"
title: "atomic shared_ptr로 루트를 교체합니다. 독자가 일관된 여러 필드를 읽으려면 객체 내부에 어떤 조건이 필요한가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["C++","shared_ptr","소유권","심화 질문"]
related: ["cpp-shared-pointer-lifetime","atomics-memory-order"]
promotedFrom: {"id":"cpp-shared-pointer-lifetime","prompt":"원자적 `shared_ptr` 교체와 객체 내부 필드의 원자성은 왜 별개인가요?"}
---

# atomic shared_ptr로 루트를 교체합니다. 독자가 일관된 여러 필드를 읽으려면 객체 내부에 어떤 조건이 필요한가요?

## 구두 답변

atomic shared_ptr는 루트 포인터의 교체와 소유 참조 취득을 안전하게 만들 수 있지만 가리키는 객체의 필드를 동시에 바꾸는 것을 보호하지 않습니다. 완전히 초기화한 깊은 불변 snapshot을 게시하는 방식이 읽기에 적합합니다.

독자는 루트를 한 번 읽어 관련 필드를 같은 버전에서 사용합니다. 필드마다 루트를 다시 읽으면 서로 다른 snapshot을 합칠 수 있습니다. 여러 writer의 같은 옛 루트 기반 변경은 CAS·재계산이나 직렬화로 lost update를 막습니다.

## 득점 포인트

- atomic shared_ptr는 루트 포인터의 교체와 소유 참조 취득을 안전하게 만들 수 있지만 가리키는 객체의 필드를 동시에 바꾸는 것을 보호하지 않습니다. 완전히 초기화한 깊은 불변 snapshot을 게시하는 방식이 읽기에 적합합니다.
- 여러 writer의 같은 옛 루트 기반 변경은 CAS·재계산이나 직렬화로 lost update를 막습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: atomic shared_ptr는 루트 포인터의 교체와 소유 참조 취득을 안전하게 만들 수 있지만 가리키는 객체의 필드를 동시에 바꾸는 것을 보호하지 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: C++ 비동기 콜백에 shared_ptr를 복사해 넘겼습니다. 객체 수명과 여러 스레드의 필드 수정이 모두 안전해지나요?](/tech-interview/questions/cpp-shared-pointer-lifetime/)
