---
id: java-metadata
title: Java 어노테이션의 보존·조회·증분 생성
topic: 언어·런타임
summary: Retention·Target·처리자 실행을 분리하고 repeatable 컨테이너·reflection·클래스 로더·생성 파일 의존성과 삭제 추적을 설명합니다.
questionIds: [java-annotation-retention, java-repeatable-annotation-retention, annotation-processor-incremental-inputs]
---

# Java 어노테이션의 보존·조회·증분 생성

Java 어노테이션은 실행 기능이 아니라 선언이나 타입 사용 위치에 붙는 메타데이터이며, 어느 단계의 어떤 소비자가 읽는지에 따라 생명주기가 달라집니다. 소스 처리, class 파일 보존, runtime reflection, 증분 생성은 연속된 한 기능이 아니라 서로 다른 관찰 지점입니다.

## 어노테이션 부착과 소비자의 조회·행동

@Service라는 어노테이션을 만들었다고 JVM이 자동으로 객체를 등록하는 것은 아닙니다. 어노테이션은 메타데이터이고 컴파일러·annotation processor·프레임워크 같은 소비자가 정해진 시점에 읽어야 동작합니다. 같은 이름의 어노테이션이라도 누가 어느 위치를 읽는지 확인해야 합니다.

@Retention은 어디까지 보존하는지, @Target은 어느 선언·타입 사용 위치에 붙일 수 있는지를 정합니다. 스캔 대상에서 빠졌다는 문제와 바이트코드에 정보 자체가 없다는 문제는 다릅니다.

디버깅 순서는 “소스에 붙었는가 → processor가 읽었는가 → class 파일에 남았는가 → 조회 API가 그 위치를 읽는가”로 고정하는 것이 좋습니다. 예를 들어 SOURCE 어노테이션은 processor 입력으로 보일 수 있지만 `javap`나 runtime reflection에서 보이지 않는 것이 정상일 수 있어, 관찰 도구를 잘못 고르면 보존 실패와 소비자 미등록을 혼동합니다.

## Retention 단계와 소비자 연결

| Retention | 보존 | 소비 예 |
| --- | --- | --- |
| SOURCE | 소스에만 존재, class 파일에 없음 | 컴파일 시 processor |
| CLASS | class 파일에 남음, 일반 runtime reflection 제공은 아님 | bytecode 도구 |
| RUNTIME | class 파일과 runtime reflection에서 읽을 수 있게 보존 | 실행 중 프레임워크 |

Retention을 생략하면 CLASS입니다. RUNTIME으로 바꿔도 processor가 등록되지 않았으면 코드 생성은 일어나지 않습니다. SOURCE도 컴파일 단계의 processor가 읽을 수 있으므로 runtime에 없다는 것이 쓸모없다는 뜻은 아닙니다.

지역 변수 **선언 자체**의 어노테이션은 RUNTIME이어도 일반 바이너리 보존·reflection 기대에 예외가 있습니다. TYPE_USE 위치의 어노테이션과 구분하고, 메서드 내부 모든 타입 사용 정보를 일반 reflection이 모두 노출한다고 가정하지 않습니다. 어떤 요소를 읽는 도구인지 정해야 합니다.

```diagram
{"title":"메타데이터와 처리 코드를 같은 단계에 배치합니다","caption":"화살표는 코드가 배포되는 단계입니다. SOURCE 메타데이터로 생성된 코드는 남을 수 있지만 그 어노테이션 자체가 runtime에 남는다는 뜻은 아닙니다.","rows":[[{"id":"source","label":"소스 어노테이션"}],[{"id":"processor","label":"컴파일·Processor","detail":["검사·소스 생성"]}],[{"id":"class","label":"Class 파일 메타데이터"}],[{"id":"runtime","label":"Runtime reflection·스캔"}]],"edges":[{"from":"source","to":"processor","label":"컴파일 입력"},{"from":"processor","to":"class","label":"Retention에 따라 보존"},{"from":"class","to":"runtime","label":"RUNTIME·조회 위치"}]}
```

## Repeatable 컨테이너와 조회 API의 정합성

같은 선언에 T를 여러 번 붙이면 반복 내용을 담는 컨테이너 TC의 `T[] value()` 형태로 표현될 수 있습니다. 이때 TC의 보존 정책은 T보다 짧을 수 없고, Target·Inherited·Documented 같은 메타데이터도 서로 호환되어야 합니다. 실행 중 반복을 읽는다면 T와 TC가 모두 RUNTIME인지, 반복이 실제로 붙은 선언·타입 사용 위치를 조회하고 있는지 한 단계씩 확인합니다.

`getAnnotation`과 `getAnnotationsByType`은 같은 위치에서 반복 컨테이너를 처리하는 방식이 다릅니다. 직접 선언한 T, TC에 담긴 반복, 상위 클래스에서 상속되는 경우를 각각 나눠 읽어야 어느 경로에서 값이 빠졌는지 보입니다. `@Inherited`는 모든 메서드·필드·인터페이스 어노테이션을 자동으로 물려주는 기능이 아니라 클래스 어노테이션에만 적용되는 제한된 계약입니다.

동일한 클래스 이름도 서로 다른 class loader에서 로드되면 다른 타입일 수 있습니다. 어노테이션이 존재해도 프레임워크 스캔 범위·클래스 경로·모듈 접근·타입 정체성 때문에 애플리케이션에서 발견하지 못할 수 있습니다. 먼저 일반 reflection·bytecode에서 존재를 확인하고 소비자의 등록 문제를 나눕니다.

## 증분 생성기의 삭제 입력 추적

User 어노테이션에서 UserAdapter를 만드는 processor를 생각해 보겠습니다. User를 이름 변경하거나 삭제했는데 옛 UserAdapter가 출력 폴더에 남으면 clean build에서는 실패하고 incremental build에서는 우연히 성공할 수 있습니다. 캐시가 최신 소스 파일만 보아서는 충분하지 않습니다.

입력에는 대상 소스·참조 타입·공통 스키마·processor 버전·옵션·외부 설정이 포함될 수 있습니다. 여러 타입을 모아 registry 하나를 만드는 processor는 한 타입만의 독립 산출물과 다른 의존 범위를 가집니다. 빌드 도구의 isolating·aggregating 같은 분류를 실제 생성 의미와 맞추고 변경·삭제가 영향 주는 출력을 정확히 무효화합니다.

출력 파일의 소유자를 기록해 자기 processor의 낡은 결과만 정리합니다. 다른 processor의 파일까지 광범위하게 지우는 것은 올바른 캐시 무효화가 아닙니다. 같은 파일을 두 생성기가 쓰지 않게 하고, 재현 가능한 순서·내용을 유지해 불필요한 rebuild도 줄입니다.

재현 연습에서는 User 이름 변경·삭제, 공통 schema 변경, processor 옵션 변경을 각각 한 번씩 수행하고 clean output과 incremental output의 파일 목록·내용을 비교합니다. 예상 결과는 삭제된 User의 adapter가 incremental output에 남지 않고, aggregating registry는 영향 받는 입력을 다시 반영하며, SOURCE 어노테이션은 runtime reflection에 나타나지 않는 것입니다. 기존의 `javap`·reflection·processor 로그를 단계별 증거로 분리해 기록합니다.

## Clean·Incremental 결과의 동등성 검증

한 번 전체 빌드한 뒤 어노테이션 변경·공통 타입 변경·이름 변경·삭제·processor 옵션 변경을 순서대로 수행합니다. 각 단계의 증분 산출물과 새 디렉터리의 clean 산출물을 비교하고 생성된 코드의 실제 테스트도 실행합니다. 생성 성공만으로 새 API 의미가 맞는 것은 아닙니다.

javap·reflection·processor 로그는 각기 다른 단계의 증거입니다. Homebrew OpenJDK 21.0.12.1의 `scripts/VerifyJavaStudy.java`로 RUNTIME repeatable 두 요소를 getAnnotationsByType에서 읽는 사례를 확인했습니다. processor의 clean/incremental 비교·모듈 접근·다른 class loader의 스캔은 실행하지 않았습니다.
