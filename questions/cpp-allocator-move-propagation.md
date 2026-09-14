---
id: "cpp-allocator-move-propagation"
title: "allocator가 다른 C++ 컨테이너끼리 이동합니다. 언제 저장 버퍼를 넘기지 못하고 원소별 이동이 필요한가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["C++","이동 의미론","소유권","심화 질문"]
related: ["cpp-move-semantics","cpp-raii-exception-safety"]
promotedFrom: {"id":"cpp-move-semantics","prompt":"allocator가 다른 컨테이너 사이 이동에서 버퍼를 훔칠 수 없는 경우는 언제인가요?"}
---

# allocator가 다른 C++ 컨테이너끼리 이동합니다. 언제 저장 버퍼를 넘기지 못하고 원소별 이동이 필요한가요?

## 구두 답변

이동 대입에서 allocator가 전파되지 않고 서로 같지 않으면 한 컨테이너가 다른 allocator의 버퍼를 그대로 해제할 수 없어 원소별 이동이 필요할 수 있습니다. 생성·대입·명시 allocator overload의 규칙을 각각 확인합니다.

allocator trait·동등성·noexcept·iterator 무효화를 실제 타입과 표준 계약에 맞춥니다. std::move는 값 범주 변환이지 버퍼 강탈의 보증이 아닙니다. 큰 컨테이너에서 정상·예외 경로의 할당·원소 이동·원본 유효 상태를 시험합니다.

## 득점 포인트

- 이동 대입에서 allocator가 전파되지 않고 서로 같지 않으면 한 컨테이너가 다른 allocator의 버퍼를 그대로 해제할 수 없어 원소별 이동이 필요할 수 있습니다. 생성·대입·명시 allocator overload의 규칙을 각각 확인합니다.
- 큰 컨테이너에서 정상·예외 경로의 할당·원소 이동·원본 유효 상태를 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 이동 대입에서 allocator가 전파되지 않고 서로 같지 않으면 한 컨테이너가 다른 allocator의 버퍼를 그대로 해제할 수 없어 원소별 이동이 필요할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: C++에서 복사를 줄이려고 std::move를 붙였습니다. 어떤 경우에는 여전히 복사되며, 이동 뒤 원본은 어떻게 다뤄야 하나요?](/tech-interview/questions/cpp-move-semantics/)
