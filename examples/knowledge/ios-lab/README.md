# Swift·Objective-C 소유권과 저장소 실습

이 실습은 Swift 초기화 2단계와 ARC, Objective-C의 `assign`·`weak`·`unsafe_unretained`, UIKit Auto Layout의 실제 충돌 조건, Property List 왕복, SQLite 스키마 변경을 작은 소스 파일로 나눠 확인합니다. 코드는 이 디렉터리에, 학습 노트는 `notes/knowledge/ios-initialization-arc-storage.md`에 있습니다.

## 범위

- 실행되는 macOS CLI: Swift 초기화·ARC, Property List, SQLite migration, Objective-C ARC ownership.
- iOS 전용 UIKit: `AutoLayoutConflict.swift`의 충돌 제약 구성만 제공합니다. macOS CLI에서는 UIKit이 없어 `NOT_RUN`으로 종료합니다. iOS simulator/device 실행은 하지 않았습니다.
- `CoreDataMigration.swift`는 Core Data v1→v2의 선택 속성 추가, 추론 매핑, 기존 행 보존을 macOS에서 실행합니다.

## 요구 환경

- macOS arm64
- Swift compiler 6.4.0.34.1, target `arm64-apple-macosx27.0.0`에서 확인
- Xcode command-line tools의 `clang`, Foundation SDK, SQLite3 module
- 외부 패키지와 네트워크 의존성 없음

## 실행

저장소 루트에서 다음 명령을 실행합니다.

```sh
cd /path/to/tech-interview
sh examples/knowledge/ios-lab/run.sh
```

실행 파일과 저장소 실험 파일은 `build/` 아래의 고유한 임시 실행 디렉터리에 만들며, 성공·실패·중단 뒤 wrapper가 정리합니다.

## 기대 결과

- Swift: `ScreenModel.deinit`과 `Ledger.deinit`이 observer root 해제 및 model root 해제 시 각각 출력됩니다.
- Objective-C: owner가 보유한 strong이 남아 있는 동안 weak가 살아 있고, 마지막 strong 해제 뒤 weak가 `(null)`이 됩니다. `assign`과 `unsafe_unretained`는 자동 nil 처리를 하지 않는 비소유 포인터임을 로그로 표시합니다. 실행 예제는 dangling pointer를 역참조하지 않습니다.
- Property List: XML 형식으로 저장한 Codable 값을 decode하고 equality를 확인합니다.
- SQLite: `schema_version INTEGER NOT NULL DEFAULT 1` 열을 추가한 뒤 한 행을 2로 갱신하고 `PRAGMA foreign_key_check`를 실행합니다.
- Auto Layout: UIKit이 없는 macOS에서는 `NOT_RUN: UIKit is unavailable in this macOS CLI target`이 출력됩니다. iOS에서 실행하면 폭 100 required constraint와 최소 폭 240 required constraint가 동시에 활성화되어 unsatisfiable 로그를 내야 합니다. 콘솔에 의존하지 말고 identifier `box-width-100`, `box-minimum-width-240`을 검색합니다.

## 상태 추적

Swift에서 `model`은 `ScreenModel`의 strong root입니다. `model.observer = observer`는 weak back-reference이므로 `observer = nil` 뒤 두 번째 모델은 즉시 해제됩니다. 첫 번째 model은 지역 root가 남아 있어 유지되고, 마지막 `model = nil`에서 model과 내부 ledger가 함께 해제됩니다. 초기화 중에는 `ledger` 저장 속성을 먼저 채운 뒤 메서드 호출을 수행하도록 배치했습니다.

Objective-C에서는 같은 객체를 네 property에 대입하지만 생존을 연장하는 것은 strong뿐입니다. 외부 지역 `object`를 nil로 만든 뒤에도 owner의 strong이 남아 weak는 유효합니다. 이어 strong property를 nil로 만들면 weak는 자동으로 nil이 됩니다. unsafe 포인터를 사용해 확인하지 않은 이유는 그것이 dangling일 수 있고, 실습은 정의되지 않은 접근을 재현하는 대신 ownership 차이를 안전하게 보여 주기 때문입니다.

SQLite의 직접 `ADD COLUMN`은 기존 행에 기본값을 적용하는 좁은 migration입니다. 임의의 테이블 재구성, foreign key 의존 객체 재작성, 복잡한 Core Data 관계·정책 이전은 검증하지 않습니다.

## 실패 주입과 진단

1. `SwiftInitializationARC.swift`에서 `weak var observer`를 `var observer`로 바꾸면 순환이 생길 수 있는 방향을 관찰합니다. `deinit`이 사라지는지 확인하되 프로세스 종료 출력만으로 leak을 확정하지 말고 Instruments 또는 Xcode Memory Graph를 사용합니다.
2. Objective-C에서 `owner.strongObject = nil` 뒤 `owner.unsafeObject`를 출력하거나 메시지를 보내지 않습니다. 안전한 진단은 dangling 주소를 읽지 않는 것입니다. `assign`·`unsafe_unretained`의 값이 남아 보여도 대상 유효성을 뜻하지 않습니다.
3. SQLite의 `DEFAULT 1`을 제거하고 `NOT NULL`을 유지하면 기존 행이 있는 DB에서 ADD COLUMN이 실패해야 합니다. 실행 전 파일을 보존하는 별도 테스트가 필요하므로 기본 lab은 atomic 임시 파일을 사용하지 않고 생성 DB를 즉시 제거합니다.
4. UIKit에서 두 required width 제약 중 하나를 priority 999로 낮추면 의도한 failure point가 되며 required conflict가 사라집니다. symbolic breakpoint `UIViewAlertForUnsatisfiableConstraints`를 iOS 테스트 대상에서 사용합니다.

## 구현 선택

실습은 각 책임을 한 파일에 제한하고, 오류는 `throws`와 `precondition`으로 즉시 드러냅니다. SQLite 연결은 `defer`로 닫고 SQLite 오류 메시지는 해제합니다. 파일 저장은 Property List에서 `.atomic` 옵션을 사용합니다. iOS 전용 코드는 `#if canImport(UIKit)`로 감싸 macOS CLI가 거짓으로 UIKit 실행을 주장하지 않도록 했습니다.

## 근거와 실행 범위

Swift Book의 Initialization·ARC 페이지는 이 환경에서 제목 또는 `Documentation`만 반환되어 정확한 본문 인용을 확보하지 못했습니다. 따라서 해당 문서에 대한 본문 주장은 요약으로 표시하고, 새 버전의 세부 SDK 지원을 추정하지 않습니다. Clang ARC specification은 `assign`이 `__unsafe_unretained`를 뜻한다는 점, `weak`가 `__weak` ownership이라는 점, `__unsafe_unretained`가 weak tracking이나 자동 clearing을 제공하지 않는다는 점을 확인하는 데 사용했습니다. Apple archived Auto Layout Programming Guide의 “Unsatisfiable Layouts”는 required constraints 충돌 시 Auto Layout이 충돌 제약을 식별하고 일부를 깨며 console에 기록한다는 절차와 symbolic breakpoint 권고를 제공합니다. SQLite 공식 `ALTER TABLE` 문서는 ADD COLUMN 제한과 더 큰 변경에서 새 테이블 생성·데이터 복사·기존 테이블 제거·rename 순서를 설명합니다.

검증한 실행은 macOS arm64 CLI뿐입니다. UIKit simulator/device는 실행하지 않았습니다. Core Data 선택 속성 추가와 Objective-C 동적 dispatch·selector guard는 macOS에서 실행했습니다.
