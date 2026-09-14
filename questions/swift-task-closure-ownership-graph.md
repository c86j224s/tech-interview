---
id: "swift-task-closure-ownership-graph"
title: "화면·서비스·작업 핸들·클로저가 서로 참조합니다. 취소와 필수 작업 완료를 고려해 어느 참조를 약하게 하나요?"
difficulty: "중하"
category: "모바일"
tags: ["Swift","ARC","메모리 관리","weak","unowned","심화 질문"]
related: ["ios-arc-weak-cycle"]
promotedFrom: {"id":"ios-arc-weak-cycle","prompt":"서비스·작업 핸들·클로저·화면 사이의 참조 그래프에서 어느 간선을 약하게 할지 그려 보세요."}
---

# 화면·서비스·작업 핸들·클로저가 서로 참조합니다. 취소와 필수 작업 완료를 고려해 어느 참조를 약하게 하나요?

## 구두 답변

누가 작업을 완료할 책임이 있는지 먼저 그리고 화면을 관찰하는 callback과 필수 작업의 소유자를 나눕니다. 서비스가 작업을 소유하고 화면 callback은 weak 참조를 사용하는 구성이 가능할 수 있습니다.

모든 참조를 weak로 바꾸면 필요한 작업도 사라집니다. cancel·완료·핸들 해제와 unowned의 사용 시점 수명을 확인하고 실제 메모리 그래프를 대조합니다.

## 득점 포인트

- 누가 작업을 완료할 책임이 있는지 먼저 그리고 화면을 관찰하는 callback과 필수 작업의 소유자를 나눕니다. 서비스가 작업을 소유하고 화면 callback은 weak 참조를 사용하는 구성이 가능할 수 있습니다.
- cancel·완료·핸들 해제와 unowned의 사용 시점 수명을 확인하고 실제 메모리 그래프를 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 누가 작업을 완료할 책임이 있는지 먼저 그리고 화면을 관찰하는 callback과 필수 작업의 소유자를 나눕니다.

## 더 파고들 거리

- [기본 상황과 비교: ARC를 사용하는 Swift 객체가 해제되지 않습니다. 강한 순환 참조와 `weak`, `unowned`의 차이를 어떻게 진단하고 고치나요?](/tech-interview/questions/ios-arc-weak-cycle/)
