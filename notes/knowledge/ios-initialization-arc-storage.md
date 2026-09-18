---
id: ios-initialization-arc-storage
title: Swift 초기화·ARC와 Objective-C 소유권·레이아웃·저장소 실습
topic: 모바일
summary: Swift와 Objective-C의 객체 수명 및 초기화 경계를 실제 CLI 출력과 UIKit 충돌 예제로 추적하고 Property List·SQLite migration의 좁은 계약을 구분합니다.
questionIds: []
prerequisites: [ios-runtime-storage, reference-counting-foundations]
related: [arc-ownership, observation-contracts]
reviewedAt: '2026-09-18'
---

# Swift 초기화·ARC와 Objective-C 소유권·레이아웃·저장소 실습

## 실습의 경계

이 노트는 서로 자주 섞여서 설명되는 네 경계를 하나의 작은 실습으로 분리합니다. Swift 초기화는 인스턴스가 사용 가능한 상태에 도달하는 순서를, ARC는 class instance를 살려 두는 strong 경로를, Objective-C ownership qualifier는 포인터 저장이 생존을 보장하는지 여부를, Auto Layout과 저장소는 각각 제약 해와 schema 변경의 실패 지점을 다룹니다.

실행 범위는 명확히 나눕니다.

- macOS CLI에서 실제 실행: `SwiftInitializationARC.swift`, `ObjectiveCOwnership.m`, `PropertyListSQLite.swift`.
- iOS 전용 구성만 작성하고 실행하지 않음: `AutoLayoutConflict.swift`. 이 환경에는 iOS simulator/device 실행이 없으므로 UIKit 결과를 실행했다고 말하지 않습니다.
- Property List와 SQLite의 실제 파일·DB를 검증하고, `CoreDataMigration.swift`에서 선택 속성 추가에 대한 Core Data 추론 매핑을 실행합니다.

코드는 [Swift·Objective-C 실습](https://github.com/c86j224s/tech-interview/tree/main/examples/knowledge/ios-lab/)에 있습니다.

## 초기화 모델

Swift class 초기화는 모든 stored property에 적절한 초기값을 채우는 단계와, 인스턴스가 완전히 준비된 뒤 추가 작업을 하는 단계를 구분해 읽어야 합니다. 이 노트에서 `ScreenModel.init`은 먼저 `ledger`를 초기화하고 그 다음 로그를 출력합니다. `ledger`에 초기값을 넣기 전에 인스턴스 메서드나 완성되지 않은 `self`를 사용하도록 코드를 재배치하면 컴파일러가 막아야 할 경계를 의도적으로 넘게 됩니다.

상속이 없는 작은 class에서도 핵심은 같습니다. 생성자 본문을 위에서 아래로 읽으면서 “현재 모든 저장 속성이 초기화되었는가”와 “이제 self를 완전한 instance로 사용할 수 있는가”를 별도로 묻습니다. 기본값이 있는 stored property는 initializer가 그 값을 직접 대입하지 않아도 초기화에 기여하지만, 선언만 된 `let` 또는 `var`는 initializer가 끝나기 전에 값이 필요합니다.

초기화 완료와 ARC 수명은 다른 축입니다. `ScreenModel`이 완전히 초기화된 뒤에도 strong root가 없어지면 해제될 수 있고, 초기화가 성공했다고 해서 외부 소유자가 계속 남는 것은 아닙니다.

## ARC와 weak 상태 추적

`ScreenModel`은 `ledger`를 strong으로 보유합니다. `model` 지역 변수는 첫 번째 모델의 strong root입니다. 두 번째 모델을 `observer` 지역 변수로 만들고 첫 번째 모델의 `weak observer`에 연결한 뒤 `observer = nil`을 수행하면, 첫 번째 모델은 계속 살아 있지만 두 번째 모델과 그 ledger는 즉시 해제됩니다. 마지막에 `model = nil`을 수행하면 첫 번째 모델과 내부 ledger가 해제됩니다.

상태를 시간순으로 적으면 다음과 같습니다.

1. `ScreenModel(seed: "boot")`가 `Ledger`를 만들고 stored property를 채운다.
2. `model`이 해당 ScreenModel의 strong root가 된다.
3. `observer`가 두 번째 ScreenModel의 strong root가 된다.
4. `model?.observer = observer`는 약한 back-reference만 만든다. 첫 번째 model이 두 번째 model을 소유하지 않는다.
5. `observer = nil`에서 두 번째 model의 마지막 strong이 사라지고 `ScreenModel.deinit`, `Ledger.deinit`이 출력된다.
6. `model = nil`에서 첫 번째 model의 마지막 strong이 사라지고 같은 순서의 해제 로그가 나온다.

```diagram
{"title":"소유권 그래프와 해제 순서","caption":"화살표는 현재 실습의 참조 관계입니다. observer는 weak라서 observer 지역 변수를 nil로 만들면 두 번째 모델이 해제되고, model root를 nil로 만들 때 첫 번째 모델이 해제됩니다.","rows":[[{"id":"root","label":"model strong root"}],[{"id":"model","label":"ScreenModel"},{"id":"observer","label":"weak observer"}],[{"id":"ledger","label":"Ledger","detail":["ScreenModel이 strong 보유"]}]],"edges":[{"from":"root","to":"model","label":"strong 보유"},{"from":"model","to":"observer","label":"weak 참조"},{"from":"model","to":"ledger","label":"strong 보유"}]}
```

중요한 것은 `weak`를 붙였다는 문법이 아니라 그래프의 방향입니다. 화면이 서비스의 작업을 소유해야 하는지, 작업이 화면이 없어도 완료되어야 하는지 먼저 결정합니다. 화면 전용 UI 갱신이라면 completion closure가 화면을 weak로 관찰할 수 있습니다. 업로드나 문서 저장처럼 화면이 닫혀도 끝나야 하는 작업이라면 서비스나 작업 객체가 작업과 버퍼를 strong으로 소유하고, 화면은 결과가 도착했을 때만 약하게 반영합니다.

`unowned`는 weak와 같은 자동 nil 관찰이 아닙니다. 사용 전체 기간 동안 대상이 살아 있다는 불변식이 입증될 때만 사용하고, 외부 timer·network callback처럼 호출 시점이 지연되는 경로에는 수명 계약 없이는 쓰지 않습니다. `weak` 승격 뒤 넓은 구간을 `guard let self`로 감싸면 그 구간 동안 지역 strong이 생긴다는 점도 확인합니다.

## Objective-C ownership qualifier

Objective-C ARC에서 `strong`, `weak`, `assign`, `unsafe_unretained`는 포인터를 저장하는 방식과 생존 계약을 나눕니다. 이 lab은 같은 `NSObject`를 네 property에 대입해 차이를 보이되 dangling 포인터를 역참조하지 않습니다.

- `strong`: 대상 생존을 연장합니다.
- `weak`: 생존을 연장하지 않고 대상 해제 시 자동으로 nil이 됩니다.
- `assign`: 이 object pointer 선언에서는 `__unsafe_unretained` 의미로 읽습니다. 생존을 연장하지 않습니다.
- `unsafe_unretained`: 일반 포인터 저장이며 weak table 추적이나 자동 nil 처리가 없습니다.

실행 trace는 다음과 같습니다.

1. `object`와 `owner`가 각각 strong root를 가진다.
2. 네 property에 같은 주소를 대입한다.
3. 지역 `object = nil` 뒤에도 `owner.strongObject`가 대상을 유지하므로 `weakObject`는 유효하다.
4. `owner.strongObject = nil`로 마지막 strong owner를 제거한다.
5. `weakObject`는 `(null)`이 된다.
6. `assignObject`와 `unsafeObject`는 자동 nil이 된다고 가정하지 않는다. 로그에 주소가 남아 보이더라도 역참조하지 않는다.

여기서 `assign`과 `unsafe_unretained`의 출력 주소는 대상이 아직 살아 있는 동안 관찰한 값일 뿐입니다. 마지막 strong 해제 뒤 그 주소가 안전하다는 증거가 아닙니다. `weak`의 자동 nil은 관찰 경계를 제공하지만, 완료 작업의 버퍼나 결과를 대신 소유해 주지는 않습니다.

## Auto Layout 충돌 모델

Auto Layout은 view의 frame을 한 줄씩 대입하는 API가 아니라, 여러 제약식의 해를 찾는 시스템입니다. `AutoLayoutConflict.swift`는 중앙에 있는 `box`에 다음 required 제약을 동시에 활성화합니다.

- `box.width == 100`, identifier `box-width-100`
- `box.width >= 240`, identifier `box-minimum-width-240`

두 제약은 동시에 참일 수 없으므로 unsatisfiable layout입니다. Apple의 archived Auto Layout Programming Guide는 시스템이 충돌 제약을 식별하고, 유효한 layout을 얻을 때까지 일부를 깨며, 충돌과 깨진 제약을 console에 기록한다고 설명합니다. 어느 제약이 깨질지는 layout과 build에 따라 달라질 수 있으므로 console 경고를 정상 결과로 방치하지 않습니다.

실제 iOS 테스트에서는 두 identifier를 기준으로 로그를 찾고 `UIViewAlertForUnsatisfiableConstraints` symbolic breakpoint를 설정합니다. controlled failure point가 필요하면 두 required 제약 중 하나를 priority 999 optional constraint로 바꿔 “정상적으로 깨질 수 있는” 위치를 지정합니다. 이 lab에서는 iOS simulator/device를 실행하지 않았으므로 특정 runtime 로그나 실제 선택된 broken constraint를 주장하지 않습니다.

## Property List 저장 모델

Property List는 작은 설정처럼 전체를 읽고 쓰는 값에 적합한 단순 파일 경계로 다룹니다. `Settings`는 `Codable` 구조체이고, encoder는 XML format을 선택합니다. `data.write(to:options: .atomic)`으로 새 내용을 완성한 뒤 경로에 원자적으로 교체하도록 요청하고, 다시 읽어서 `PropertyListDecoder`의 결과가 원본과 같은지 `precondition`으로 확인합니다.

이 코드는 schema evolution 전체를 해결하지 않습니다. `schemaVersion` 필드를 읽을 때 옛 파일에 필드가 없으면 현재 `Codable` 선언은 실패할 수 있으므로, 실제 앱에서는 기본값을 넣는 custom decoder나 명시적 file version 변환기를 두어야 합니다. 또한 외부 입력을 무조건 신뢰하거나, 저장 성공을 백업·동기화 성공으로 확대하지 않습니다.

## SQLite migration 모델

SQLite 실습은 직접 가능한 좁은 schema migration만 구현합니다. 먼저 `settings` 테이블을 만들고, 행을 삽입한 뒤, `ALTER TABLE ... ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1`로 새 열을 추가하고 행을 2로 갱신합니다. 마지막으로 `PRAGMA foreign_key_check`를 실행하고, 모든 SQLite 호출은 오류를 `throws`로 전파합니다. database handle은 `defer`로 닫습니다.

SQLite 공식 문서에 따르면 `ALTER TABLE`은 제한된 부분집합이며, column addition은 기존 열 뒤에 붙습니다. 기존 데이터가 있는 표에 `NOT NULL` 열을 추가하려면 NULL이 아닌 기본값이 필요합니다. 더 임의적인 변경은 새 table 생성, 데이터 복사, 옛 table 제거, 새 table rename의 순서가 필요하고, dependent schema objects와 foreign key 검사를 함께 보존해야 합니다.

따라서 이 lab의 `ADD COLUMN`을 Core Data migration으로 부르지 않습니다. Core Data는 model version, store compatibility, lightweight migration 가능 여부, 필요하면 mapping model과 custom policy를 별도로 판단합니다. 이번 실행에는 Core Data framework가 필요하지 않았고, 해당 계약을 검증할 실제 model/store도 제공하지 않았습니다.

## Core Data 모델 이전과 동적 호출

`CoreDataMigration.swift`는 v1 모델의 필수 문자열 `name`을 SQLite store에 저장한 뒤, 선택 문자열 `memo`를 추가한 v2 모델로 이전합니다. `NSMappingModel.inferredMappingModel`로 추론 가능한 매핑을 만들고 `NSMigrationManager`가 새 경로로 이전한 뒤, v2로 다시 열어 기존 행과 값이 보존되고 새 선택 속성이 nil인지 검사합니다. macOS Core Data에서 이 경로를 컴파일·실행해 통과했습니다. SQLite의 직접 ALTER TABLE과는 다른 실제 모델 이전이며, 모든 타입 변경·관계 변경·CloudKit 이전을 검증한 것은 아닙니다.

Objective-C 예제는 부모 타입 변수에 자식 인스턴스를 넣고 `message`를 호출해 자식 구현이 선택되는 것도 검사합니다. 선택적 selector는 `respondsToSelector:`로 지원 여부를 확인하며, 없는 메서드를 일부러 보내 undefined 또는 예외 경로를 정상 사례로 만들지 않습니다.

## 코드 읽기

`SwiftInitializationARC.swift`에서 `Ledger`는 `entries`를 초기값으로 채운 직후 로그를 남깁니다. `ScreenModel`은 `let ledger`를 먼저 대입한 뒤 “ledger assigned”를 출력하므로 initialization 경계를 코드 순서로 확인할 수 있습니다. `append`는 초기화 후에만 호출되고, `deinit`은 객체 수명 종료의 관찰 지점입니다.

`ObjectiveCOwnership.m`은 메모리 안전 실험을 위해 `unsafe_unretained`를 읽어 역참조하지 않습니다. 실제 제품 코드에서 raw non-owning pointer를 사용할 때는 대상의 lifetime proof 또는 명시적 owner 계약이 필요하며, 주소 출력만으로 검증을 끝내지 않습니다.

`AutoLayoutConflict.swift`는 `#if canImport(UIKit)`로 iOS 전용 코드와 macOS fallback을 분리합니다. macOS CLI 실행은 UIKit 충돌을 흉내 내지 않고 `NOT_RUN`을 출력합니다. 이 조건문은 simulator 실행을 대체하지 않으며, 단지 잘못된 플랫폼 결과를 보고하지 않도록 합니다.

`PropertyListSQLite.swift`는 임시 저장 파일과 SQLite database를 현재 directory에 만들고, 성공 뒤 지웁니다. 오류 경로에서는 `defer`가 SQLite 연결과 error message 정리를 수행합니다. 운영 앱의 저장에서는 디렉터리 권한, 디스크 부족, 백업 정책, migration rollback, 동시 writer 직렬화까지 추가로 정해야 합니다.

## 실행 절차

저장소에 통합한 뒤 repo root에서 다음을 실행합니다.

```sh
cd /path/to/tech-interview
sh examples/knowledge/ios-lab/run.sh
```

코드를 검증할 때는 같은 디렉터리의 `run.sh` wrapper를 사용합니다. wrapper는 컴파일 산출물과 저장소 실험 파일을 고유한 임시 실행 디렉터리에 만들고 성공·실패·중단 뒤 정리합니다.

확인된 출력은 Swift의 두 객체 해제 trace, Property List equality, SQLite migration 성공, Objective-C weak nil 전환, UIKit `NOT_RUN`입니다. 실행 환경은 macOS 27 arm64, Apple Swift 6.4.0.34.1, `arm64-apple-macosx27.0.0`입니다. iOS simulator/device는 실행하지 않았습니다. Core Data의 선택 속성 추가는 macOS CLI에서 별도로 실행했습니다.

## 실패 주입

### 강한 순환 참조

`weak var observer`를 강한 stored property로 바꾸면 첫 번째 model과 두 번째 model이 서로 strong으로 연결되도록 확장할 수 있습니다. 단순히 deinit이 한 번 보이지 않았다는 것만으로 leak을 단정하지 말고, Memory Graph에서 외부 root가 끊긴 뒤 남은 경로를 확인합니다. 순환을 제거할 때도 필수 작업 owner를 weak로 만들어 작업 자체가 중단되지 않는지 확인합니다.

### 초기화 순서 위반

`ScreenModel.init`에서 `self.ledger` 대입 전 `append`나 instance method를 호출하도록 바꾸면 Swift compiler가 허용하지 않아야 합니다. 이것은 runtime warning이 아니라 compile-time initialization contract입니다. 컴파일러 메시지의 정확한 표현은 Swift compiler version마다 다를 수 있어 고정 문구로 의존하지 않습니다.

### Objective-C dangling pointer

마지막 strong release 뒤 `assignObject` 또는 `unsafeObject`를 메시지 receiver로 사용하지 않습니다. 이 실습의 실패 주입은 주소를 읽는 것이 아니라, 해당 경로가 왜 검증 불가능한지를 설명하는 데 그칩니다. 실제 dangling dereference 재현은 정의되지 않은 동작이며, 제품 검증의 기본 경로로 삼지 않습니다.

### Auto Layout failure point

두 width 제약을 모두 required로 유지하면 unsatisfiable 로그가 예상됩니다. 하나를 priority 999로 바꾸면 required conflict 대신 optional failure point가 됩니다. 실제 iOS에서 orientation, Dynamic Type, safe area, intrinsic content size까지 변형해 runtime test를 수행해야 하며, macOS CLI의 `NOT_RUN`은 그 검증을 대신하지 않습니다.

### SQLite migration 실패

`NOT NULL DEFAULT 1`에서 `DEFAULT 1`을 제거하면 기존 행이 있는 DB에 새 required column을 추가하는 작업이 실패해야 합니다. 이 실패를 관찰하려면 기존 DB를 보존하는 별도 invocation이 필요합니다. 기본 lab은 검증 후 DB를 삭제하므로 실패 DB를 자동 보존하지 않습니다.

## 장애 진단

객체가 사라지지 않으면 먼저 `deinit` 기대 시점과 실제 strong graph를 비교합니다. 화면이 사라진 것, navigation stack에서 제거된 것, 서비스 작업이 끝난 것, completion closure가 해제된 것은 서로 다른 사건입니다. 객체가 예상보다 빨리 사라지면 반대로 작업의 유일한 owner를 weak로 만든 것은 아닌지 확인합니다.

레이아웃 경고는 제약 identifier, priority, view hierarchy, intrinsic content size, safe area, trait collection을 함께 수집해 판단합니다. “경고가 한 번 보였다”보다 어느 제약이 의도한 failure point인지와 모든 지원 크기에서 시각 결과가 유효한지가 중요합니다.

저장 실패는 encoder/decoder 오류, 원자 교체 실패, 디스크 공간·권한, SQLite syntax/constraint 오류, schema version 불일치를 나눠 기록합니다. migration 성공은 현재 프로세스에서 한 번 실행된 사실이 아니라, 재실행 idempotence, 중단 뒤 재개, 백업·복구, 실제 old fixtures 통과까지 포함하는 별도 검증입니다.

## 참고 자료와 검증 범위

- [Swift Book — Initialization](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/initialization/) — 2026-09-18 확인. 공식 페이지가 `Documentation`만 반환해 exact quote는 확보하지 못했습니다. stored property와 two-phase initialization은 기존 노트와 페이지 요약을 바탕으로 설명하며, 특정 Swift release의 추가 규칙은 확정하지 않습니다.
- [Swift Book — Automatic Reference Counting](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/automaticreferencecounting/) — 2026-09-18 확인. 본문이 제공되지 않아 exact quote는 확보하지 못했습니다. strong cycle, weak 자동 nil, unowned 수명 전제는 공식 페이지 요약 수준으로만 사용했습니다.
- [Clang Automatic Reference Counting specification](https://clang.llvm.org/docs/AutomaticReferenceCounting.html) — 2026-09-18 확인. `assign`의 `__unsafe_unretained` 의미, `weak`의 `__weak` ownership, `__unsafe_unretained`의 no tracking/no automatic clearing 계약에 사용했습니다. 문서 자체에 단일 release version이 표시되지 않아 최신 SDK 주장으로 확대하지 않습니다.
- [Apple Auto Layout Programming Guide — Unsatisfiable Layouts](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/AutolayoutPG/ConflictingLayouts.html) — 2026-09-18 확인. required conflict, constraint breaking/logging, priority 999 failure point, symbolic breakpoint 권고의 exact quote를 확보했습니다. archived guide이므로 최신 UIKit 구현 전체를 대표한다고 주장하지 않습니다.
- [SQLite ALTER TABLE](https://www.sqlite.org/lang_altertable.html) — 2026-09-18 확인. 페이지는 2026-06-04 01:35:31Z updated로 표시되었고, `ADD COLUMN` 제한과 새 table-copy-drop-rename 절차를 확인했습니다. SQLite 3.53.0의 `ALTER COLUMN` 추가 언급은 이번 lab에서 사용하지 않습니다.
- [기존 iOS 실행·소유권·저장소 기초](/tech-interview/notes/ios-runtime-storage/), [기존 객체 참조 카운팅과 소유권](/tech-interview/notes/reference-counting-foundations/), [기존 ARC 면접 질문](/tech-interview/questions/ios-arc-weak-cycle/) — 기존 개념과 연결하기 위한 내부 참고입니다.

저장소의 macOS CLI 소스는 컴파일·실행에 성공했습니다. `AutoLayoutConflict.swift`는 macOS에서 `UIKit is unavailable` 분기로 `NOT_RUN`을 출력했으며 iOS simulator/device는 실행하지 않았습니다. 복잡한 Core Data 관계·정책 이전과 실제 iOS 화면, Instruments/Memory Graph, orientation·Dynamic Type 매트릭스는 확인하지 않았습니다.
