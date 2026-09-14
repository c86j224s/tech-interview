---
id: "ios-scene-save-version-dedup"
title: "SceneDelegate와 scenePhase가 동시에 저장을 요청합니다. 같은 버전의 중복 저장과 역순 완료를 어떻게 막나요?"
difficulty: "중하"
category: "모바일"
tags: ["iOS","멀티 씬","앱 생명주기","백그라운드","심화 질문"]
related: ["ios-scene-app-lifecycle"]
promotedFrom: {"id":"ios-scene-app-lifecycle","prompt":"SceneDelegate와 scenePhase가 동시에 저장을 요청해도 한 버전만 커밋하도록 만들어 보세요."}
---

# SceneDelegate와 scenePhase가 동시에 저장을 요청합니다. 같은 버전의 중복 저장과 역순 완료를 어떻게 막나요?

## 구두 답변

문서 변경 version마다 저장 요청을 식별하고 같은 version 중복은 합치며 늦은 옛 저장이 새 snapshot을 덮지 않게 합니다. 씬 callback 횟수를 데이터 변경 횟수와 동일시하지 않습니다.

파일 교체·DB commit과 version 게시를 안전하게 묶습니다. 종료 알림만 기다리지 않고 중요한 변경 때 저장하며 중단·두 씬·반복 background 이벤트를 시험합니다.

## 득점 포인트

- 문서 변경 version마다 저장 요청을 식별하고 같은 version 중복은 합치며 늦은 옛 저장이 새 snapshot을 덮지 않게 합니다. 씬 callback 횟수를 데이터 변경 횟수와 동일시하지 않습니다.
- 종료 알림만 기다리지 않고 중요한 변경 때 저장하며 중단·두 씬·반복 background 이벤트를 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 문서 변경 version마다 저장 요청을 식별하고 같은 version 중복은 합치며 늦은 옛 저장이 새 snapshot을 덮지 않게 합니다.

## 더 파고들 거리

- [기본 상황과 비교: iOS 멀티 씬 앱에서 화면이 백그라운드로 갈 때 무엇을 저장해야 하나요? 앱 종료 알림만 기다려도 될까요?](/tech-interview/questions/ios-scene-app-lifecycle/)
