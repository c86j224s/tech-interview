---
id: "cpp-explicit-commit-destructor-error"
title: "소멸자에서 파일 저장 실패를 호출자에게 전달하기 어렵습니다. 명시적인 commit과 소멸자 정리는 어떻게 나누나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["C++","RAII","예외 안전성","심화 질문"]
related: ["cpp-raii-exception-safety","deadlock-prevention"]
promotedFrom: {"id":"cpp-raii-exception-safety","prompt":"소멸자에서 오류를 반환할 수 없을 때 명시적 `commit`의 실패를 어디에 전달할까요?"}
---

# 소멸자에서 파일 저장 실패를 호출자에게 전달하기 어렵습니다. 명시적인 commit과 소멸자 정리는 어떻게 나누나요?

## 구두 답변

데이터 확정의 실패를 호출자에게 알려야 한다면 명시적인 commit·flush·close API로 결과를 반환하고 소멸자는 남은 자원을 안전하게 정리하는 보조 역할을 맡습니다. 소멸 중 예외는 특히 다른 예외의 전파와 겹칠 때 위험합니다.

commit 실패 뒤 객체가 재시도 가능한지 폐기만 가능한지 정의합니다. cleanup 오류와 원래 오류를 함께 기록하되 비밀값을 노출하지 않습니다. 파일 write 성공·버퍼 flush·디스크 내구화는 다른 지점이므로 성공 의미를 API에 명시합니다.

## 득점 포인트

- 데이터 확정의 실패를 호출자에게 알려야 한다면 명시적인 commit·flush·close API로 결과를 반환하고 소멸자는 남은 자원을 안전하게 정리하는 보조 역할을 맡습니다. 소멸 중 예외는 특히 다른 예외의 전파와 겹칠 때 위험합니다.
- 파일 write 성공·버퍼 flush·디스크 내구화는 다른 지점이므로 성공 의미를 API에 명시합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 데이터 확정의 실패를 호출자에게 알려야 한다면 명시적인 commit·flush·close API로 결과를 반환하고 소멸자는 남은 자원을 안전하게 정리하는 보조 역할을 맡습니다.

## 더 파고들 거리

- [기본 상황과 비교: C++에서 락과 파일을 RAII 객체로 관리합니다. 상태를 일부 바꾼 뒤 예외가 나면 자원 해제와 변경 전 상태로의 복구가 모두 보장되나요?](/tech-interview/questions/cpp-raii-exception-safety/)
