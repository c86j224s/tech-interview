---
id: background-urlsession-relaunch-events
title: 앱 종료 중 background URLSession 다운로드가 끝나면 완료 callback은 어떻게 복원되나요?
difficulty: 중하
category: 모바일
tags:
  - iOS
  - URLSession
  - background transfer
  - delegate
related:
  - ios-hidden-screen-work-policy
---
# 앱 종료 중 background URLSession 다운로드가 끝나면 완료 callback은 어떻게 복원되나요?

## 구두 답변

이전 화면의 completion closure가 앱 종료 뒤 보존되어 호출된다고 보면 안 됩니다. background session의 task와 전송 결과는 시스템이 관리하고, 앱 delegate가 `application(_:handleEventsForBackgroundURLSession:completionHandler:)`로 session identifier와 system completion handler를 받으면 coordinator와 delegate를 다시 연결해야 합니다. coordinator가 task·파일 이벤트를 받아 내구 원장에 기록한 뒤 `urlSessionDidFinishEvents(forBackgroundURLSession:)`에서 시스템 handler를 호출하는 순서가 handshake의 경계입니다. 화면은 그 뒤 callback을 기다리는 대신 원장의 snapshot을 읽습니다.

예를 들어 시스템 전송 완료 후 앱이 깨어나면 `identifier 수신 → 동일 session 연결 → task ID 대조 → 파일 이동·completed 기록 → delegate 이벤트 종료 → completionHandler 호출 → 화면 snapshot` 순서로 처리합니다. 파일 이동 실패를 다운로드 성공과 합치지 않고, 중복 callback은 task ID와 request generation으로 멱등 처리합니다. 정확한 target SDK의 호출 세부는 Apple 공식 문서와 기기에서 확인해야 합니다.

completion handler는 화면이 준비됐다는 신호가 아니라, 시스템이 전달한 background-session 이벤트를 앱이 처리할 준비와 마무리를 알리는 handshake입니다. 따라서 application delegate에서 handler를 저장하지 않고 버리거나, coordinator가 아직 task delegate를 붙이기 전에 호출하면 이벤트 처리 완료를 너무 일찍 선언할 수 있습니다. 반대로 원장 commit과 파일 이동을 무한히 기다리도록 만들면 wake 실행 시간이 길어질 수 있으므로 실패·재시도 상태를 기록하고 정해진 경계에서 handler를 호출해야 합니다.
## 득점 포인트

- 화면 수명, 시스템 전송 수명, delegate coordinator 수명을 세 주체로 나눕니다.
- application delegate의 background-session handler와 `urlSessionDidFinishEvents` 사이의 완료 순서를 말합니다.
- task ID·session ID·내구 snapshot으로 callback 공백과 중복을 처리합니다.

## 감점 포인트

- 프로세스가 죽어도 이전 화면 인스턴스의 completion closure가 살아 있다고 말합니다.
- 앱이 wake된 즉시 화면이 완료를 표시한다고 봅니다.
- 다운로드 callback, 파일 이동, 원장 commit, system completion handler를 하나의 사건으로 합칩니다.

## 더 파고들 거리

- 원장 commit 전에 앱이 다시 종료될 때 재실행 대사에서 어느 전이를 재시도할지 설계해 보세요.
- 화면에 `running`, `completed`, `fileMoveFailed`, `reconcileNeeded`를 어떻게 구분해 표시할지 제안해 보세요.
