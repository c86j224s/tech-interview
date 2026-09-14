---
id: "ios-navigation-view-retention"
title: "navigation·modal·tab을 오갈 때 viewDidLoad와 appearance callback은 어떤 조건에서 다시 호출되나요?"
difficulty: "중하"
category: "모바일"
tags: ["iOS","UIViewController","뷰 생명주기","화면 전환","심화 질문"]
related: ["ios-view-lifecycle"]
promotedFrom: {"id":"ios-view-lifecycle","prompt":"navigation·modal·tab 전환 로그로 뷰 유지와 재로드 상황의 콜백 차이를 비교해 보세요."}
---

# navigation·modal·tab을 오갈 때 viewDidLoad와 appearance callback은 어떤 조건에서 다시 호출되나요?

## 구두 답변

viewDidLoad는 view가 로딩되는 시점이며 화면 재등장이 항상 재로딩은 아닙니다. navigation·tab·modal의 유지·제거와 appearance 전달을 실제 container 계약에서 확인합니다.

매 표시 갱신과 한 번 초기화를 나누고 작업 중복·취소를 관리합니다. 로그에 객체 ID·load·appearance를 기록해 새 인스턴스와 기존 view의 재등장을 구분합니다.

## 득점 포인트

- viewDidLoad는 view가 로딩되는 시점이며 화면 재등장이 항상 재로딩은 아닙니다. navigation·tab·modal의 유지·제거와 appearance 전달을 실제 container 계약에서 확인합니다.
- 로그에 객체 ID·load·appearance를 기록해 새 인스턴스와 기존 view의 재등장을 구분합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: viewDidLoad는 view가 로딩되는 시점이며 화면 재등장이 항상 재로딩은 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: 화면으로 돌아올 때 `viewDidLoad`의 갱신 코드가 다시 실행되지 않습니다. `viewDidLoad`, `viewWillAppear`, `viewDidAppear`를 어떻게 나눠야 하나요?](/tech-interview/questions/ios-view-lifecycle/)
