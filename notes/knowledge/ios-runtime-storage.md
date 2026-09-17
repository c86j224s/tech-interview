---
id: ios-runtime-storage
title: iOS 실행·소유권·저장소 기초
topic: 모바일
summary: scene과 화면의 수명, 비동기 작업의 소유, 좌표·초기화 경계, 저장소 선택을 중단과 복구의 순서로 설명합니다.
questionIds: []
prerequisites: [client-foundations]
related: [scene-persistence, arc-ownership, view-coordinates, observation-contracts]
reviewedAt: '2026-09-17'
---

# iOS 실행·소유권·저장소 기초

## 화면과 실행 상태의 분리

iOS 앱의 사용자가 보는 화면은 앱 전체 실행 상태와 같은 객체가 아닙니다. 하나의 scene은 foreground에서 보이다가 background로 이동할 수 있고, 시스템이 프로세스를 중단하거나 종료할 때 화면 객체가 계속 남아 있다고 가정할 수 없습니다. UIKit의 구체적인 callback 순서는 컨테이너와 대상 환경에 따라 확인해야 하므로, 이 장에서는 상태 전이와 저장 책임을 중심으로 설명합니다.

화면이 사라졌다는 사실도 객체가 즉시 해제되었다는 뜻은 아닙니다. navigation stack이나 tab이 view controller를 보관할 수 있고, 타이머·관찰자·비동기 완료 클로저가 참조를 계속 유지할 수 있습니다. 따라서 “화면이 닫혔으니 작업도 끝났다”와 “객체가 해제되었으니 모든 작업이 끝났다”를 서로 다른 주장으로 다뤄야 합니다.

## 장면 상태와 저장 시점

편집 중인 문서를 종료 직전에 한 번만 저장하면 마지막 변경이 사라질 수 있습니다. 강제 종료나 메모리 압박에서 종료 알림이 실행되지 않을 수 있기 때문입니다. 변경을 일정 단위로 저장하고, background 진입은 아직 끝나지 않은 저장을 마무리할 수 있는 제한된 기회로 사용하되 무제한 실행을 약속하는 시점으로 보지 않습니다.

```diagram
{"title":"화면 상태와 문서 상태의 분리","caption":"화면의 표시 상태와 복구해야 할 문서 상태는 수명이 다릅니다. 저장은 종료 직전 한 번이 아니라 변경과 background 진입을 기준으로 진행합니다.","rows":[[{"id":"scene","label":"Scene 상태","detail":["foreground·background"]}],[{"id":"screen","label":"화면 UI","detail":["선택·스크롤·패널"]},{"id":"doc","label":"문서 상태","detail":["본문·버전·변경 ID"]}],[{"id":"store","label":"복구 가능한 저장본","detail":["유효본·미완료 작업"]}]],"edges":[{"from":"scene","to":"screen","label":"표시·가림"},{"from":"screen","to":"doc","label":"편집 반영"},{"from":"doc","to":"store","label":"checkpoint 저장"}]}
```

화면의 선택 문서와 스크롤 위치는 scene별 상태일 수 있지만, 문서 본문은 여러 scene이 공유하는 공용 상태일 수 있습니다. 공용 문서를 한 화면의 임시 배열로만 보관하면 다른 scene이나 다음 실행에서 기준이 사라집니다. 반대로 모든 UI 선택 상태를 공용 문서에 넣으면 서로 독립적인 창의 화면 상태가 충돌합니다.

## 저장소 선택의 기준

저장소는 이름보다 데이터의 사용 방식으로 선택합니다. 작은 설정처럼 전체를 읽고 쓰며 사람이 확인할 필요가 있는 값은 단순 파일 형식이 적합할 수 있습니다. 큰 문서나 원자적 교체가 필요한 결과는 임시 파일·검증·교체 순서를 설계해야 합니다. 검색·정렬·부분 갱신·트랜잭션이 중심이면 SQLite나 Core Data 계열을 후보로 둡니다.

| 요구 | 출발 후보 | 확인할 경계 |
| --- | --- | --- |
| 서버가 기준인 최신 데이터 | 서버·클라우드 | 오프라인·인증·동기화·재시도 |
| 작은 설정·목록 | Property List 등 단순 파일 | 전체 갱신·스키마 변경 |
| 문서 파일·내보내기 | 파일·아카이브 | 원자 교체·손상 복구·버전 |
| 조건 검색·부분 갱신 | SQLite | 트랜잭션·migration·동시 접근 |
| 객체 그래프와 모델 관리 | Core Data 등 | 모델 migration·context 수명 |

Property List나 아카이브를 선택했다고 저장 도중 중단 문제가 없어지는 것은 아닙니다. 저장 파일을 제자리에서 덮어쓰다 프로세스가 끊기면 기존 유효본까지 손상될 수 있습니다. 새 내용을 임시 위치에 완성하고 읽을 수 있는지 검증한 뒤 교체하며, 파일의 본문과 버전을 서로 다른 시점의 값으로 남기지 않습니다.

## 버전과 중복 저장

Scene A와 B가 같은 문서 v7을 읽고 각각 변경했다고 합시다. A가 먼저 v8을 확정한 뒤 B가 “나도 v8”이라고 저장하면 숫자가 같다는 이유로 중복으로 인정해서는 안 됩니다. B가 실제로 같은 요청을 재전송한 것인지, v7에서 출발한 다른 편집인지 구분해야 합니다.

```text
commitEdit(documentId, expectedVersion, changeId, newBody):
    in_one_storage_transaction:
        if changeId already committed:
            return recorded_result
        current = load_for_update(documentId)
        if current.version != expectedVersion:
            return conflict(current)
        nextVersion = current.version + 1
        store(newBody, nextVersion)
        record(changeId, nextVersion)
    return committed_result
```

이 의사코드는 특정 iOS API 호출 코드가 아니라 저장 상태 전이를 보이는 모형입니다. `changeId`는 같은 작업의 재전송을 하나로 묶고, `expectedVersion`은 편집자가 어떤 기준을 보았는지 확인합니다. B의 기대 버전이 7인데 현재가 8이면 충돌을 반환하고, 필드별 병합이 의미를 보존한다는 도메인 근거가 있을 때만 병합합니다.

느린 v8 쓰기보다 v9 쓰기가 먼저 완료되는 상황도 있습니다. 같은 파일 경로를 마지막 완료 순서로 덮으면 옛 v8이 최신 v9를 되돌릴 수 있습니다. 문서별 저장을 직렬화하거나 버전별 임시 파일과 현재 버전 포인터를 사용해, 권위 포인터가 예상한 상태일 때만 갱신합니다.

## ARC와 비동기 작업 소유

ARC(Automatic Reference Counting, 자동 참조 횟수 계산)는 강한 참조 수를 세어 객체 수명을 관리합니다. 화면이 서비스를 강하게 보관하고, 서비스가 작업을 보관하며, 작업의 완료 클로저가 화면을 강하게 캡처하면 `화면 → 서비스 → 작업 → 클로저 → 화면` 순환이 생길 수 있습니다. 화면 계층에서 제거하는 것만으로 이 고리가 끊어지지는 않습니다.

```diagram
{"title":"화면 관찰과 필수 작업 소유","caption":"화면의 존재와 작업의 완료 책임을 나눕니다. 화면이 없어도 끝내야 하는 작업은 서비스가 소유하고, 화면 반영만 약하게 관찰합니다.","rows":[[{"id":"service","label":"서비스","detail":["필수 작업 소유"]}],[{"id":"task","label":"비동기 작업","detail":["버퍼·결과·정리"]}],[{"id":"closure","label":"완료 관찰","detail":["화면 참조 weak"]}],[{"id":"screen","label":"화면","detail":["없으면 UI 생략"]}]],"edges":[{"from":"service","to":"task","label":"강한 참조"},{"from":"task","to":"closure","label":"완료까지 보관"},{"from":"closure","to":"screen","label":"약한 관찰"}]}
```

`weak`는 대상이 사라지면 `nil`이 되는 참조이고, `unowned`는 호출 시점에도 대상이 살아 있다는 전제를 두는 참조입니다. 외부 네트워크나 타이머가 언제 완료할지 모르는 클로저라면 약한 참조 뒤에 화면 부재를 정상 처리하는 편이 설명하기 쉽습니다. 다만 `[weak self]` 다음 `guard let self`가 긴 비동기 구간을 감싸면 그 구간 동안 강한 지역 참조가 생길 수 있으므로 표지만 보고 약한 수명이라고 판단하지 않습니다.

모든 것을 weak로 만들면 필요한 업로드나 결제 작업의 소유자가 사라질 수 있습니다. 작업의 목적이 화면에만 속하는 자동완성인지, 화면이 닫혀도 완료되어야 하는 업로드인지 먼저 나누고 소유자를 정합니다. 작업이 끝나면 핸들·타이머·완료 클로저를 정리해 서비스가 완료 작업을 영원히 보관하지 않게 합니다.

I/O가 계속 참조하는 버퍼와 작업 핸들은 실제 작업 종료가 확인될 때까지 유지해야 합니다. 화면 참조가 nil이라는 사실은 버퍼를 즉시 반환해도 된다는 뜻이 아닙니다. 소유자가 화면의 생존과 I/O 자원의 생존을 함께 취급하지 않도록 책임을 분리합니다.

## 취소와 완료의 단일 결과

취소 요청과 정상 완료가 동시에 도착할 때 callback이 두 번 실행되면 화면은 성공과 취소를 모두 표시하거나 외부 효과를 중복 처리할 수 있습니다. 객체 수명과 별개로 결과 전달 상태를 `pending → finished`로 두고, 한 번만 전이하도록 직렬 경계를 둡니다.

```text
finish(result):
    lock(state)
    if resultState != pending:
        unlock(state)
        return
    resultState = finished
    callback = completion
    completion = none
    unlock(state)
    dispatch_callback_on_required_executor(callback, result)
```

이 코드는 의사코드입니다. 실제 Swift에서는 actor, lock, 또는 프로젝트가 정한 직렬 실행기를 사용하고, 잠금 안에서 사용자 코드를 실행하지 않아 재진입과 교착을 줄여야 합니다. UI 변경은 해당 UI 실행기나 MainActor 계약으로 전달해야 하며, 취소 요청이 원격 작업을 즉시 되돌린다고 가정하지 않습니다.

결제나 문서 업로드처럼 외부 효과가 이미 시작된 작업은 화면 결과와 실제 서버 결과가 다를 수 있습니다. 화면에는 현재 요청 세대에 맞는 결과만 보여 주되, 서비스는 작업 ID와 접수·성공·실패·불확정 상태를 보존해야 재등장 뒤 중복 제출을 막을 수 있습니다.

## 좌표와 초기화의 경계

UIView의 `frame`은 보통 부모 좌표의 배치이고 `bounds`는 자기 내부 좌표와 크기입니다. `bounds.origin`이 0이 아닐 수 있고, scroll view·zoom·transform이 들어오면 숫자를 직접 더하는 방식이 틀리기 쉽습니다. 다른 뷰의 좌표로 옮길 때는 변환 API를 사용하고, 회전된 view의 외접 상자를 얻었다고 그 값을 다시 frame에 넣어도 안전한 배치 계약이 되는 것은 아닙니다.

예를 들어 폭 100, 높이 40인 사각형을 45도 돌리면 축 정렬 외접 폭과 높이는 `100×0.7071 + 40×0.7071 ≈ 98.995`입니다. 이는 부모 좌표에서 분석한 상자이지 원래 view의 내부 높이가 99가 되었다는 뜻이 아닙니다. Auto Layout이 frame을 계산하는 경우에는 제약이 반영된 시점에서 읽고, animation 중에는 목표값과 현재 표시값 중 어느 것을 측정하는지 정합니다.

초기화 중 property 접근도 언어와 단계에 따라 다릅니다. 저장 속성의 backing storage, getter·setter의 부가 동작, `self`가 완전히 초기화되었는지 여부를 한 규칙으로 뭉뚱그리지 않습니다. Objective-C의 `assign`과 Swift의 `weak`를 같은 의미로 읽지 않으며, dynamic binding과 optional delegate 호출은 실제 선언·selector·runtime 조건을 확인해야 합니다. 이 감사에서는 Apple과 Swift 공식 페이지의 해당 세부 본문을 확보하지 못했으므로 이 항목에 버전별 API 계약을 덧붙이지 않습니다.

## 장애의 시간순 진단

앱이 background에 들어간 뒤 문서가 사라졌다면 먼저 마지막 유효 저장본, 저장 시작·완료 버전, changeId, 중단 시점을 확인합니다. 종료 callback이 왔는지부터 찾기보다 변경 직후 checkpoint가 있었는지와 임시 파일이 검증되었는지를 봅니다. 두 scene의 저장이 겹쳤다면 expectedVersion과 현재 버전의 불일치를 확인합니다.

화면을 닫은 뒤 메모리가 줄지 않으면 object ID와 `deinit`, 서비스의 진행 작업 수, 타이머·관찰자 수를 함께 기록합니다. 강한 참조 순환인지, 서비스가 정상적으로 작업을 보관하는 동안인지, 작업이 끝났는데 정리되지 않은 것인지 분리합니다. `weak`를 추가한 뒤 작업이 중단됐다면 반대로 필수 작업의 소유자를 약하게 만든 것은 아닌지 확인합니다.

회전 뒤 터치 위치가 어긋나면 frame 숫자만 보지 않고 원본 뷰, 대상 뷰, bounds 원점, scroll offset, transform, 레이아웃 완료 시점을 로그에 남깁니다. 늦은 네트워크 결과가 화면을 덮으면 요청 세대와 active 상태를 같은 UI 실행기에서 검사합니다. 이 세 가지 장애는 모두 “화면” 문제처럼 보이지만 저장·소유·좌표라는 서로 다른 계약입니다.

## 참고 자료와 검증 범위

- [UISceneDelegate](https://developer.apple.com/documentation/uikit/uiscenedelegate) — 2026-09-17 확인, Apple 공식 페이지는 이 환경에서 제목만 반환되어 적용 버전과 본문 인용을 확보하지 못했습니다. 구체 callback 순서를 확정하는 근거로 사용하지 않았습니다.
- [UIViewController](https://developer.apple.com/documentation/uikit/uiviewcontroller) — 2026-09-17 확인, 제목-only 상태입니다. 컨테이너별 appearance 순서를 특정하지 않았습니다.
- [UIView](https://developer.apple.com/documentation/uikit/uiview) — 2026-09-17 확인, 제목-only 상태입니다. 좌표와 변환의 버전별 세부 계약을 확정하지 않았습니다.
- [Automatic Reference Counting](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/automaticreferencecounting/) — 2026-09-17 확인, Swift 공식 페이지 본문과 버전을 확보하지 못했습니다. ARC의 세부 버전 주장은 확장하지 않았습니다.
- [멀티 씬 문서의 저장과 충돌 복구](/tech-interview/notes/scene-persistence/), [ARC 참조 그래프와 비동기 완료 책임](/tech-interview/notes/arc-ownership/), [iOS 화면 재등장과 작업 수명](/tech-interview/notes/view-lifecycle/), [UIView 좌표계와 변환된 경계 계산](/tech-interview/notes/view-coordinates/) — 저장소의 기존 심화 노트입니다.

이 장의 버전·충돌·좌표 수치와 의사코드는 설명용 모형이며 실제 iOS 기기나 앱 실행 결과가 아닙니다. 의사코드는 Swift 컴파일 가능 코드가 아닙니다. 대상 iOS 버전, 컨테이너 조합, 저장 프레임워크, concurrency 실행기와 메모리 그래프는 접근 가능한 공식 문서와 실제 앱 로그로 별도 확인해야 합니다.
