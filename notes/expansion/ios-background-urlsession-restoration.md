---
id: ios-background-urlsession-restoration
title: iOS background URLSession 작업 복원
topic: 모바일
summary: 시스템 소유 background URLSession 전송과 앱 재실행 이벤트를 화면 수명과 분리합니다.
questionIds: []
prerequisites:
  - view-lifecycle
  - arc-ownership
related:
  - view-lifecycle
  - arc-ownership
  - request-task-lifetime
reviewedAt: '2026-09-19'
---
# iOS background URLSession 작업 복원

background `URLSession`의 핵심은 화면 callback을 오래 붙잡는 것이 아니라, 시스템이 전송을 관리하고 앱이 깨어났을 때 delegate를 다시 연결하는 것입니다. 작업의 수명은 view보다 길 수 있고, 완료 이벤트의 전달도 특정 화면 인스턴스의 생존을 전제하지 않습니다. 안정적인 session identifier, task 원장, 파일 입력 보존, relaunch completion-handler handshake를 각각 설계해야 복원을 “화면이 다시 나타났다”와 혼동하지 않을 수 있습니다. Apple 페이지의 target별 세부 wording은 이 배치에서 직접 읽지 못했으므로, 아래의 API 선택과 상태 모델은 대상 SDK에서 재확인해야 합니다.

## 소유권 분리

검색처럼 화면이 사라지면 취소할 작업과 background upload/download를 구분합니다. 화면은 진행률을 구독하고, 전송 coordinator가 session delegate와 원장을 소유합니다. `viewDidDisappear`는 controller의 표시 상태 변화이지 task 취소나 서버 효과의 rollback이 아닙니다.

예를 들어 download가 끝났지만 화면이 없는 동안 앱이 suspend되면, Notification을 놓쳐도 `taskID`, session ID, 파일 위치, 상태를 원장에 기록해 두면 다음 화면이 snapshot을 읽어 현재 상태를 복원할 수 있습니다. 파일 이동 실패와 HTTP 성공도 별도 상태로 기록해야 “전송 완료”와 “사용 가능한 파일”을 합치지 않게 됩니다.

## background session 계약

대상 iOS의 `URLSessionConfiguration.background(withIdentifier:)`로 만든 session은 시스템 관리 전송을 위한 경계입니다. 앱 delegate가 background-session 이벤트를 받으면, session identifier에 맞는 coordinator와 delegate를 연결해야 합니다. 화면이 먼저 생기기를 기다리지 말고 전송 계층을 먼저 준비합니다.

앱 delegate의 `application(_:handleEventsForBackgroundURLSession:completionHandler:)`는 시스템이 전달한 identifier와 completion handler를 받는 경계입니다. 앱은 identifier로 기존 coordinator를 찾거나 새로 구성하고, delegate 이벤트가 들어올 준비를 한 뒤 작업을 계속합니다. delegate의 `urlSessionDidFinishEvents(forBackgroundURLSession:)`에서 task 관련 이벤트와 파일 처리가 모두 끝났다고 판단하면 저장해 둔 system completion handler를 호출합니다. 너무 일찍 호출하면 system과 앱의 이벤트 handshake가 끊기고, 화면 callback에만 의존하면 relaunch 때 누락됩니다.

## 안정적 식별자

첫 실행에서 `com.example.transfer.account-42`로 session을 만들고 task 17을 등록했다고 하겠습니다. 프로세스가 종료된 뒤 같은 identifier로 coordinator를 다시 만들면 task 17과 local record를 대조할 수 있습니다. 매번 UUID를 만들면 이전 session을 가리킬 namespace를 잃으므로 새 session과 이전 session이 서로 다른 registry entry가 됩니다.

```text
첫 실행: id=com.example.transfer.account-42, task=17, state=running
프로세스 종료: 시스템이 전송 계속
재실행: 같은 id로 coordinator 연결, task 17 조회
대조: requestGeneration·파일 URL·계정 세대 확인
```

identifier가 안정적이어도 업무 상태가 자동으로 복원되지는 않습니다. task ID, request generation, 멱등 key, 계정 세대, 예상 파일 path를 별도로 저장합니다. 같은 프로세스에서 동일 background identifier를 두 coordinator가 만들지 않도록 registry 또는 singleton을 둡니다. 중복 생성을 허용한 채 delegate를 나누면 동일 callback의 owner가 불명확해지므로, 생성 전 registry 확인과 재연결 순서를 명시하고 대상 SDK의 중복 session 제약을 확인합니다.

## relaunch handshake

완료 순서는 다음처럼 분리합니다.

```text
system transfer complete
 -> application delegate가 identifier·completionHandler 수신
 -> coordinator와 background session/delegate 연결
 -> task 및 파일 이벤트 수신
 -> 내구 원장에 completed/failed 기록
 -> urlSessionDidFinishEvents에서 completionHandler 호출
 -> 화면은 callback이 아니라 snapshot 조회
```

다운로드 완료 delegate가 도착해도 최종 파일 이동이 실패할 수 있고, 앱이 그 직후 종료될 수도 있습니다. `transferFinished`, `fileMoved`, `recordCommitted`, `systemEventsFinished`를 분리하면 재실행 후 어느 단계부터 재시도할지 알 수 있습니다. 완료 처리에는 task ID와 request generation을 사용해 중복 callback이 같은 서버 효과를 두 번 만들지 않게 합니다.

## 업로드 파일 입력

background upload의 지속 입력은 메모리 `Data`가 아니라 파일 기반 upload task 계약을 사용해야 합니다. 예를 들어 `uploadTask(with:fromFile:)`로 만든 task는 앱 프로세스가 없어도 시스템이 읽을 수 있는 파일 입력을 전제로 합니다. 메모리 `Data`를 넘기는 foreground 경로를 background 지속 전송으로 취급하면 앱 종료 뒤 입력 buffer를 재구성할 수 없습니다. 실제 메서드 허용 범위는 대상 SDK에서 확인하되, “background이면 Data가 자동 보존된다”는 가정은 하지 않습니다.

50MB payload라면 `inputPrepared`에서 임시 파일을 만들고, `taskCreated`를 기록한 뒤, task가 파일 읽기를 끝냈다는 계약과 완료·실패 처리를 확인한 후 cleanup합니다. task 생성 호출이 반환됐다는 사실만으로 즉시 unlink해도 된다고 단정하지 않습니다. 너무 일찍 지우면 전송이 실패하고, 영원히 보존하면 디스크가 누적됩니다.

## 원장과 멱등성

다음 상태를 각각 기록하면 복원 경계가 보입니다. `inputPrepared -> taskCreated -> transferFinished -> fileCleaned`에서 각 전이는 idempotent해야 합니다. 파일 cleanup이 실패해도 전송 성공을 실패로 덮지 말고 `cleanupPending`을 남깁니다. 서버가 payload를 받았지만 앱이 원장을 쓰기 전에 죽으면, 다음 실행에서 멱등 key로 서버 상태를 조회해 local record를 대사합니다.

계정이 바뀐 뒤 예전 callback이 오면 identifier만 보고 현재 화면에 표시하지 않습니다. account generation과 request generation을 비교해 폐기하거나 별도 복구 큐에 둡니다. 로컬 파일 이동, 서버 수신, UI 표시를 각기 다른 관찰값으로 취급해야 합니다.

## 검증과 운영

대상 기기에서 시작 후 화면 닫기, suspend, 프로세스 종료, relaunch, delegate 지연, 중복 callback, 임시 파일 삭제 실패를 각각 시험합니다. 로그에는 session ID, task ID, coordinator 생성 횟수, delegate 연결 시각, system completion handler 호출 시각, 파일 path와 account generation을 남깁니다. simulator의 즉시 callback만으로 background scheduling을 증명하지 않습니다.

```diagram
{"title":"시스템 전송과 앱 복원","caption":"시스템이 보관한 task를 앱 delegate가 identifier로 재연결하고, 원장 기록 뒤 시스템 completion handler를 완료합니다.","rows":[[{"id":"system","label":"시스템 전송","detail":["task 보관"]}],[{"id":"wake","label":"앱 delegate","detail":["identifier·handler"]}],[{"id":"coord","label":"복원 coordinator","detail":["delegate·원장"]}],[{"id":"ui","label":"새 화면","detail":["snapshot 조회"]}]],"edges":[{"from":"system","to":"wake","label":"background 이벤트"},{"from":"wake","to":"coord","label":"session 재연결"},{"from":"coord","to":"ui","label":"상태 제공"}]}
```

## 비용과 한계

background scheduling은 즉시 실행을 보장하지 않으며 시스템 정책·네트워크·전원에 좌우됩니다. 파일 기반 upload는 메모리 안정성을 얻는 대신 디스크 공간, cleanup, 개인정보 보호를 관리해야 합니다. stable identifier는 연결 기준일 뿐 서버 멱등성과 업무 원장을 대신하지 않습니다. completion handler의 정확한 호출 시점과 iOS target별 callback은 Apple 공식 문서와 실제 기기에서 확인해야 합니다.

## 참고자료

- Apple URLSessionConfiguration.background: https://developer.apple.com/documentation/foundation/urlsessionconfiguration/1408259-background (background session API의 공식 기준; 이 배치에서는 본문을 직접 읽지 못해 target별 wording은 미확정)
- Apple URLSession uploadTask: https://developer.apple.com/documentation/foundation/urlsession/uploadtask(with:fromfile:) (파일 기반 upload API 확인용)
- Apple application background-session event handler: https://developer.apple.com/documentation/uikit/uiapplicationdelegate/application(_:handleeventsforbackgroundurlsession:completionhandler:) (relaunch handshake 확인용)
