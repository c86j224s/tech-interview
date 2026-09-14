---
id: "ios-multicast-observer-lifecycle"
title: "여러 구독자에게 상태 변경을 알립니다. delegate 집합과 Notification의 해제·순서·재진입은 어떻게 다른가요?"
difficulty: "중하"
category: "모바일"
tags: ["iOS","delegate","closure","Notification","이벤트","심화 질문"]
related: ["ios-delegate-closure-notification"]
promotedFrom: {"id":"ios-delegate-closure-notification","prompt":"멀티캐스트 delegate와 Notification에서 구독자 해제·호출 순서·한 수신자의 실패를 비교해 보세요."}
---

# 여러 구독자에게 상태 변경을 알립니다. delegate 집합과 Notification의 해제·순서·재진입은 어떻게 다른가요?

## 구두 답변

구독 집합의 소유·약한 참조·등록 토큰과 실행 queue를 정의합니다. Notification의 전달 순서나 모든 subscriber의 실패 격리를 임의로 가정하지 않습니다.

알림 처리 중 구독 변경·재진입·수신자 소멸을 시험합니다. 현재 상태를 따로 보관해 등록 전 사건 누락을 복구하고 사용자 UI 갱신은 적절한 executor로 전달합니다.

## 득점 포인트

- 구독 집합의 소유·약한 참조·등록 토큰과 실행 queue를 정의합니다. Notification의 전달 순서나 모든 subscriber의 실패 격리를 임의로 가정하지 않습니다.
- 현재 상태를 따로 보관해 등록 전 사건 누락을 복구하고 사용자 UI 갱신은 적절한 executor로 전달합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 구독 집합의 소유·약한 참조·등록 토큰과 실행 queue를 정의합니다.

## 더 파고들 거리

- [기본 상황과 비교: iOS 앱에서 다운로드 결과는 요청한 화면에 돌려주고, 로그인 상태 변경은 여러 화면에 알려야 합니다. delegate·완료 클로저·Notification을 어떤 기준으로 나누나요?](/tech-interview/questions/ios-delegate-closure-notification/)
