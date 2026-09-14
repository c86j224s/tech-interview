---
id: "swift-completion-cancel-once"
title: "Swift 비동기 작업의 취소와 완료가 겹칩니다. callback을 한 번만 전달하고 자원을 안전하게 회수하려면 어떻게 하나요?"
difficulty: "중하"
category: "모바일"
tags: ["Swift","ARC","메모리 관리","weak","unowned","심화 질문"]
related: ["ios-arc-weak-cycle"]
promotedFrom: {"id":"ios-arc-weak-cycle","prompt":"취소와 완료가 동시에 도착해도 클로저가 한 번만 실행되도록 상태 전이를 설계해 보세요."}
---

# Swift 비동기 작업의 취소와 완료가 겹칩니다. callback을 한 번만 전달하고 자원을 안전하게 회수하려면 어떻게 하나요?

## 구두 답변

Pending에서 완료·취소 중 한 전이만 callback 전달권을 얻도록 actor·lock 등으로 관리합니다. weak self는 객체 수명을 다루지만 callback의 exactly-once를 자동 보장하지 않습니다.

취소 후 늦은 외부 성공은 상태 대사에 남기고 UI에는 현재 행동 세대에 맞는 결과만 적용합니다. timer·예약·핸들 정리는 한 owner가 수행하며 main actor 전환과 종료를 시험합니다.

## 득점 포인트

- Pending에서 완료·취소 중 한 전이만 callback 전달권을 얻도록 actor·lock 등으로 관리합니다. weak self는 객체 수명을 다루지만 callback의 exactly-once를 자동 보장하지 않습니다.
- timer·예약·핸들 정리는 한 owner가 수행하며 main actor 전환과 종료를 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Pending에서 완료·취소 중 한 전이만 callback 전달권을 얻도록 actor·lock 등으로 관리합니다.

## 더 파고들 거리

- [기본 상황과 비교: ARC를 사용하는 Swift 객체가 해제되지 않습니다. 강한 순환 참조와 `weak`, `unowned`의 차이를 어떻게 진단하고 고치나요?](/tech-interview/questions/ios-arc-weak-cycle/)
