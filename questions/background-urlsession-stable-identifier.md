---
id: background-urlsession-stable-identifier
title: background session identifier를 매번 UUID로 바꾸면 재실행 후 기존 task를 어떻게 찾나요?
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
# background session identifier를 매번 UUID로 바꾸면 재실행 후 기존 task를 어떻게 찾나요?

## 구두 답변

매번 UUID를 만들면 재실행된 앱이 시스템에 남은 이전 session의 이름을 재현하지 못해 기존 task와 새 delegate의 연결 기준을 잃습니다. 예를 들어 첫 실행에서 `com.example.transfer.account-42`로 task 17을 만들었다면 다음 실행도 같은 identifier로 coordinator를 구성해 task 17과 local record를 대조해야 합니다. 새 UUID session은 이전 task를 자동으로 옮겨 주지 않으므로 새 작업 목록만 바라보거나 callback을 잘못된 owner에 매핑할 수 있습니다.

identifier만으로 업무 복원이 끝나는 것은 아닙니다. task ID, request generation, 파일 URL, 서버 멱등 key, account generation을 함께 기록합니다. 같은 프로세스에서 동일 background identifier를 여러 coordinator가 생성하지 않도록 registry나 singleton으로 중복 생성을 막고, 기존 coordinator가 있으면 재사용합니다. 정확한 중복 생성 제약은 대상 SDK에서 확인해야 하지만, owner를 둘로 만들면 delegate 이벤트의 책임이 갈라지는 실패는 설계 단계에서 차단해야 합니다.

식별자 설계 예로 `com.example.transfer.<accountGeneration>.<purpose>`처럼 계정과 목적을 namespace에 넣되, 계정 로그아웃 시 예전 generation을 현재 화면에 매핑하지 않는 registry를 둡니다. 단순히 계정 ID만 넣으면 같은 계정의 이전 upload와 새 download가 delegate owner를 공유할 수 있으므로 task의 업무 record와 목적도 저장합니다. registry는 session 생성 전 “이미 연결된 coordinator가 있는가”를 검사하고, 재실행 시에는 새 coordinator가 필요한 경우에도 동일 delegate queue와 원장을 연결한 뒤 task를 조회합니다.
## 득점 포인트

- UUID의 랜덤성이 아니라 동일 namespace를 재현할 수 있는지가 복원 조건이라고 설명합니다.
- session ID, task ID, 업무 record ID, 서버 멱등 key를 서로 다른 역할로 구분합니다.
- account generation과 singleton registry로 계정 전환·중복 delegate를 막습니다.

## 감점 포인트

- identifier만 같으면 서버 결과와 로컬 파일 상태도 자동으로 복원된다고 말합니다.
- 새 session이 이전 시스템 task를 자동으로 흡수한다고 가정합니다.
- 로그아웃 후 예전 계정 callback을 현재 계정 화면에 표시하면서 세대 검사를 생략합니다.

## 더 파고들 거리

- 여러 계정과 upload/download 종류를 동시에 지원할 때 identifier namespace와 충돌 방지 규칙을 작성해 보세요.
- task 완료와 원장 commit 사이에 종료가 끼면 같은 ID로 어떤 순서의 대사를 수행할지 설명해 보세요.
