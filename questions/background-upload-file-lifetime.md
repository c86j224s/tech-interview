---
id: background-upload-file-lifetime
title: background upload에서 메모리 Data와 파일 입력은 앱 종료 시 수명이 어떻게 다른가요?
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
# background upload에서 메모리 Data와 파일 입력은 앱 종료 시 수명이 어떻게 다른가요?

## 구두 답변

background upload를 앱 종료 뒤에도 지속할 입력으로 설계한다면 파일 기반 upload task를 사용해야 합니다. 메모리 `Data`를 넘기는 foreground 경로는 프로세스가 종료된 뒤 시스템이 다시 읽을 영속 입력을 제공하지 않으므로, 이를 background 지속 전송으로 간주하면 안 됩니다. 파일 URL은 프로세스 수명과 분리된 입력을 제공하지만 파일을 task 생성 직후 지워도 된다는 뜻은 아닙니다. 시스템이 읽기를 끝냈다는 계약과 delegate 결과를 확인한 뒤 cleanup합니다.

50MB payload라면 `inputPrepared → taskCreated → transferFinished → fileCleaned` 상태를 원장에 둡니다. `taskCreated` 직후 unlink하면 아직 파일을 열지 않은 경로에서 upload가 실패할 수 있고, 반대로 무기한 보존하면 디스크가 누적됩니다. cleanup 실패는 전송 실패와 다른 `cleanupPending`으로 기록하고 다음 실행에서 idempotent하게 수거합니다. 파일 허용 위치와 정확한 삭제 시점은 target SDK의 공식 uploadTask 문서로 확인해야 합니다.

Data와 파일의 차이는 메모리 대 디스크라는 단순한 성능 차이가 아니라 시스템이 앱 프로세스 밖에서 재개할 입력을 어디서 읽는지에 관한 계약입니다. 임시 파일을 만들었다면 파일명만 기록하지 말고 payload hash, request ID, 생성 시각, 예상 크기도 함께 기록해 재실행 후 orphan을 판별합니다. 서버가 이미 수신했는지 모르는 상태에서 파일만 지우면 재시도 근거가 사라질 수 있으므로, 멱등 key 조회와 cleanup을 분리합니다.
파일 보존 정책은 서버 재시도와도 연결됩니다. `transferFinished`만 보고 지우지 말고 HTTP 응답과 서버 멱등 key를 확인한 뒤, 앱이 종료되어도 다음 실행에서 정리할 수 있도록 원장에 cleanupPending을 남깁니다.
## 득점 포인트

- background 지속 전송의 핵심 계약을 Data 대 파일 입력의 차이로 먼저 답합니다.
- 50MB 예제와 네 단계 상태 전이로 파일 보존·삭제 경계를 구체화합니다.
- 전송 성공, 서버 수신, 로컬 cleanup을 별도 상태로 기록합니다.

## 감점 포인트

- background transfer이면 어떤 메모리 Data도 앱 종료 뒤 자동 보존된다고 말합니다.
- task 생성 함수가 반환되는 즉시 파일을 삭제해도 안전하다고 단정합니다.
- 파일 cleanup 실패를 곧바로 전송 실패로 덮어 서버 상태를 잃습니다.

## 더 파고들 거리

- cleanup 전에 앱이 종료되었을 때 orphan 파일의 age·request status·멱등 key로 수거 기준을 어떻게 만들지 설명해 보세요.
- 서버가 payload를 받은 뒤 완료 callback 전에 앱이 죽는 경우 재실행 시 서버 조회와 원장 commit 순서를 제안해 보세요.
