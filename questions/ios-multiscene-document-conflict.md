---
id: "ios-multiscene-document-conflict"
title: "두 iOS 씬이 같은 문서를 수정합니다. 버전 비교와 충돌 표시·병합은 어떤 단위로 관리하나요?"
difficulty: "중하"
category: "모바일"
tags: ["iOS","멀티 씬","앱 생명주기","백그라운드","심화 질문"]
related: ["ios-scene-app-lifecycle"]
promotedFrom: {"id":"ios-scene-app-lifecycle","prompt":"같은 문서를 두 씬이 수정할 때 버전 비교와 충돌 표시·병합 정책을 정해 보세요."}
---

# 두 iOS 씬이 같은 문서를 수정합니다. 버전 비교와 충돌 표시·병합은 어떤 단위로 관리하나요?

## 구두 답변

두 씬의 편집 기준 version과 변경 의도를 저장하고 현재 문서와 조건부 commit합니다. 나중 완료한 옛 저장이 최신 문서를 덮지 않게 해야 합니다.

독립 필드는 병합 가능해도 삭제·권리·전체 문서 교체는 사용자 충돌 표시가 필요할 수 있습니다. 씬별 UI와 공통 문서 owner를 분리하고 background·재시작·동시 저장을 시험합니다.

## 득점 포인트

- 두 씬의 편집 기준 version과 변경 의도를 저장하고 현재 문서와 조건부 commit합니다. 나중 완료한 옛 저장이 최신 문서를 덮지 않게 해야 합니다.
- 씬별 UI와 공통 문서 owner를 분리하고 background·재시작·동시 저장을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 두 씬의 편집 기준 version과 변경 의도를 저장하고 현재 문서와 조건부 commit합니다.

## 더 파고들 거리

- [기본 상황과 비교: iOS 멀티 씬 앱에서 화면이 백그라운드로 갈 때 무엇을 저장해야 하나요? 앱 종료 알림만 기다려도 될까요?](/tech-interview/questions/ios-scene-app-lifecycle/)
