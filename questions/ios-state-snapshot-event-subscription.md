---
id: "ios-state-snapshot-event-subscription"
title: "화면이 알림 등록 전에 로그인 변경을 놓쳤습니다. 현재 상태 조회와 이벤트 구독 사이의 틈을 어떻게 막나요?"
difficulty: "중하"
category: "모바일"
tags: ["iOS","delegate","closure","Notification","이벤트","심화 질문"]
related: ["ios-delegate-closure-notification"]
promotedFrom: {"id":"ios-delegate-closure-notification","prompt":"알림 등록 전 로그인 변경을 놓친 화면이 저장된 상태와 사건 방송을 함께 사용하도록 설계해 보세요."}
---

# 화면이 알림 등록 전에 로그인 변경을 놓쳤습니다. 현재 상태 조회와 이벤트 구독 사이의 틈을 어떻게 막나요?

## 구두 답변

알림은 사건이고 현재 로그인 상태는 조회 가능한 원본으로 유지해야 합니다. 구독 등록·snapshot 조회 사이 변경을 version이나 원자적인 등록+현재값 API로 연결합니다.

snapshot 뒤 이벤트 중복은 version으로 무시하고 빈 구간은 다시 조회합니다. 여러 씬의 독립 UI 상태와 계정 전역 인증을 구분합니다. 등록 직전·직후 변경과 늦은 전달을 재현합니다.

## 득점 포인트

- 알림은 사건이고 현재 로그인 상태는 조회 가능한 원본으로 유지해야 합니다. 구독 등록·snapshot 조회 사이 변경을 version이나 원자적인 등록+현재값 API로 연결합니다.
- 등록 직전·직후 변경과 늦은 전달을 재현합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 알림은 사건이고 현재 로그인 상태는 조회 가능한 원본으로 유지해야 합니다.

## 더 파고들 거리

- [기본 상황과 비교: iOS 앱에서 다운로드 결과는 요청한 화면에 돌려주고, 로그인 상태 변경은 여러 화면에 알려야 합니다. delegate·완료 클로저·Notification을 어떤 기준으로 나누나요?](/tech-interview/questions/ios-delegate-closure-notification/)
