---
id: java-access-and-collections-lab
title: Java 접근 경계와 컬렉션 순회 실습
topic: 언어·런타임
summary: Java의 접근 제어·모듈 공개·final 상속 제한과 레거시·동시 컬렉션의 순회 계약을 작은 컴파일·실행 실습으로 연결합니다.
questionIds: []
prerequisites: [java-access-contracts, java-collections, java-dispatch-erasure]
related: [java-shared-state, java-context-lifetime, java-equality-immutability]
reviewedAt: '2026-09-18'
---

# Java 접근 경계와 컬렉션 순회 실습

Java 코드를 읽을 때 접근 오류와 동시성 오류를 같은 “public 여부” 문제로 묶으면 진단 순서가 흐려집니다. 접근 제어는 먼저 컴파일러가 이름·선언 타입·호출 문맥을 허용하는지 결정하고, 모듈은 다른 모듈에 어떤 패키지를 소스 API로 공개할지 한 층 더 제한합니다. `opens`는 일반 소스 호출을 열어 주는 `exports`의 별칭이 아니라 reflection 접근을 위한 별도 경계입니다. `final`은 상속과 재정의라는 확장 지점을 닫습니다.

컬렉션 쪽에서도 “synchronized”나 “thread-safe”라는 표현을 전체 순회와 복합 업무 동작의 원자성으로 확대하면 안 됩니다. synchronized wrapper는 순회 전체를 같은 wrapper 모니터로 감싸야 하고, `Vector`·`Hashtable`의 iterator는 fail-fast를 최선의 노력으로 감지할 뿐입니다. legacy enumeration은 구조 변경 뒤 결과가 undefined이고, `CopyOnWriteArrayList`는 iterator 생성 시점의 snapshot이며, `ConcurrentLinkedQueue`는 weakly consistent 순회입니다. 이 실습은 이 서로 다른 계약을 의도된 컴파일 성공·실패와 작은 실행 assertion으로 구분합니다.

```diagram
{"title":"소스 이름 해석에서 순회 관찰까지","caption":"컴파일 접근 경계와 실행 중 컬렉션 순회 경계는 별도 단계로 확인합니다. 화살표는 다음 진단 질문을 뜻합니다.","rows":[[{"id":"source","label":"소스 접근","detail":["멤버 · 선언 타입 · qualifier"]}],[{"id":"module","label":"모듈 공개","detail":["requires · exports · opens"]}],[{"id":"extension","label":"확장 제한","detail":["final class · final method"]}],[{"id":"traversal","label":"순회 계약","detail":["fail-fast · snapshot · weak"]}]],"edges":[{"from":"source","to":"module","label":"패키지 공개 확인"},{"from":"module","to":"extension","label":"확장 지점 확인"},{"from":"extension","to":"traversal","label":"실행 계약 확인"}]}
```

## 실행 모델

### 보호 멤버의 정적 qualifier

다른 패키지의 하위 클래스가 상속받은 `protected` 인스턴스 멤버를 읽을 때는 하위 클래스 문맥이 필요하고, qualifier를 붙였다면 그 qualifier의 컴파일 타입도 제한됩니다. `Sub` 타입의 참조를 통해 `sub.value`를 쓰는 사례는 통과하지만, `Base` 타입 변수 `base.value`를 쓰는 사례는 실제 객체가 `Sub`인지와 무관하게 거절되어야 합니다. 이 차이는 overload를 실제 객체의 타입으로 다시 고르는 것이 아니라 표현식의 정적 타입으로 먼저 해석한다는 기존 호출 모델과 같은 방향입니다.

실습의 `access/src/client/Sub.java`는 성공 입력과 실패 입력을 나눕니다. `readOwnQualifier(Sub sub)`는 성공 대상이고 `readThroughBaseQualifier(Base base)`는 `BadProtectedQualifier.java`에서 의도된 실패 대상입니다. 실행 프로그램은 성공 입력을 컴파일한 뒤 `Sub` qualifier 결과가 `1`인지 확인합니다. 실패 입력은 harness가 `javac`의 비영(0이 아닌) 종료를 검사하므로, 오류 메시지의 특정 문구나 컴파일러 구현에 의존하지 않습니다.

### private nest와 package-private 타입

`private` 멤버는 단순히 “바로 선언한 인스턴스 메서드만”의 경계가 아닙니다. 같은 최상위 타입 본문에 속한 nested type은 소유 객체의 private 멤버를 읽을 수 있습니다. `PrivateNest.Reader`는 `PrivateNest.value`를 읽고 성공 프로그램은 `7`을 확인합니다. `BadPrivateAccess`는 같은 패키지에 있어도 nested type의 허용 문맥 밖이므로 실패 입력입니다.

최상위 타입이 package-private이면 그 안의 public 메서드가 다른 패키지의 일반 소스에 공개되는 것은 아닙니다. `PackageOnly`와 `BadPackageAccess`는 멤버 modifier만 보지 말고 선언 타입의 이름을 먼저 확인해야 하는 이유를 보여 줍니다. 이 사례는 API 반환 타입이나 매개변수 타입이 내부 타입으로 새어 나갈 때 생기는 공개 경계 부담을 작은 컴파일 오류로 바꾸어 관찰합니다.

### exports와 opens

`provider` 모듈은 `provider.api`만 `exports`하고 `provider.internal`은 export하지 않습니다. `consumer`는 `requires provider`를 선언하므로 `PublicApi`를 사용할 수 있지만, `BadMain`의 `InternalApi` import는 package가 export되지 않아 컴파일에서 거절되어야 합니다. 이 검사는 일반 소스 이름 해석의 경계입니다.

`opens`는 별도 실행 계약입니다. `module-info-open.java`는 설명용 fixture로 `provider.internal`을 특정 모듈에 열 수 있음을 보여 주지만, 현재 harness는 reflection 호출자 모듈까지 구성하지 않으므로 이 fixture를 컴파일·실행했다고 말하지 않습니다. 공식 `AccessibleObject` API는 다른 모듈의 private·package access·protected instance member를 reflection으로 열 때 package가 caller module에 open되어야 하고, export만으로는 그 조건을 대신하지 않는다고 설명합니다. 따라서 이 lab의 검증 범위는 일반 소스 `exports` 차단이며, reflection 성공은 미실행 범위입니다.

### final class와 final method

`FinalRules`는 class와 method modifier를 reflection으로 관찰하는 성공 입력입니다. `BadFinalClass`는 final class를 상속하려 하고, `BadFinalMethod`는 final method를 재정의하려 하므로 각각 컴파일 실패가 예상됩니다. reflection assertion은 class 파일에 final bit가 있는지 확인하는 보조 관찰이고, 상속·재정의 금지 자체는 compiler acceptance test로 확인하는 것이 핵심입니다. final field의 안전한 publication이나 객체 그래프 내부의 가변성은 이 실습의 final class/method 범위에 포함하지 않습니다.

## 컬렉션 순회 계약

### synchronized wrapper의 잠금 범위

`Collections.synchronizedList`는 backing list를 감싼 live wrapper입니다. 모든 접근을 wrapper를 통해 수행해야 하고, iterator·spliterator·stream으로 순회할 때는 반환된 wrapper 자체를 모니터로 잠근 상태를 순회 전체에 유지해야 합니다. `LegacyCollectionChecks.synchronizedWrapperNeedsTraversalLock`은 `synchronized (list)` 내부에서 iterator를 만들고 끝까지 읽는 최소 성공 경로를 보여 줍니다. backing alias에 직접 `add`한 뒤 wrapper 크기가 변하는 것은 wrapper가 snapshot이 아니라 backing collection을 감싼다는 사실을 확인하는 단서입니다.

`contains` 후 `add` 같은 복합 작업도 메서드별 synchronization만으로는 전체 조건 검사를 보호하지 못합니다. 이 lab은 경쟁 스케줄을 재현하는 테스트가 아니라 lock 범위를 코드로 드러내는 계약 예제이므로, “한 번 실행되어 통과했다”를 일반적인 concurrent correctness 증명으로 해석하지 않습니다.

### Vector와 Hashtable

Java SE 25 API 문서는 `Vector`와 `Hashtable`이 synchronized라고 설명하면서도, iterator의 fail-fast 동작은 unsynchronized concurrent modification에서 보장할 수 없는 best effort라고 명시합니다. `Vector` iterator는 생성 후 구조 변경을 감지할 수 있지만 이 예외에 correctness를 의존하면 안 됩니다. 반면 `elements()` enumeration은 fail-fast가 아니며 구조 변경 뒤 결과가 undefined입니다. `Hashtable`의 `keys()`와 `elements()`도 같은 legacy enumeration 경계를 가지며, key와 value에 `null`을 허용하지 않습니다.

실습은 Vector iterator에서 구조를 변경한 뒤 `ConcurrentModificationException`이 관찰되는 대표 경로를 확인하지만, 이것이 모든 동시 실행에서 예외를 보장한다고 쓰지 않습니다. enumeration 사례는 예외가 발생하지 않는다는 관찰을 안전성 보장으로 바꾸지 않도록 한 번 이상의 원소를 읽는 수준만 assertion합니다. Hashtable은 `null` key가 `NullPointerException`을 일으키는 계약과 유효 key enumeration을 확인합니다.

### snapshot과 weak consistency

`CopyOnWriteArrayList`는 변경마다 underlying array를 복사하므로 쓰기 비용을 지불하는 대신 iterator가 생성된 시점의 array를 읽습니다. iterator를 만든 후 `C`를 추가해도 기존 iterator에는 `A`, `B`만 남고, iterator의 `remove`·`set`·`add`는 지원되지 않습니다. 새 iterator는 새 상태를 읽습니다. 이는 live view도 deep copy도 아닌 “원소 참조 배열의 시점 snapshot”입니다.

`ConcurrentLinkedQueue`의 iterator는 weakly consistent입니다. 생성 시점 또는 그 이후의 어느 상태를 반영할 수 있고 `ConcurrentModificationException`을 던지지 않으며 다른 연산과 겹쳐 진행할 수 있습니다. 따라서 queue iterator assertion은 “수정 후에도 사용할 수 있다”만 확인하고, 새 원소가 반드시 보인다고 요구하지 않습니다. `size()`나 여러 원소를 보는 bulk action을 순회 snapshot의 대체 수단으로 사용하지 않습니다.

## 상태 추적

다음은 성공·실패를 한 실행으로 뭉개지 않고 단계별로 기록하는 예입니다.

1. `Base.value`는 `protected`이고 `Sub sub = new Sub()`입니다. `sub.value`에서 qualifier 정적 타입은 `Sub`이므로 컴파일 성공, 실행 값은 `1`입니다.
2. `Base base = sub`로 별칭을 만들면 실제 객체는 같아도 `base.value`의 qualifier 정적 타입은 `Base`입니다. 외부 패키지의 하위 클래스 본문에서 이 접근은 컴파일 거절입니다.
3. `PrivateNest.Reader.read(new PrivateNest())`는 같은 최상위 타입 본문에 속한 nested class이므로 `private value`를 읽고 `7`을 반환합니다. 별도 `BadPrivateAccess`는 거절됩니다.
4. `provider.api.PublicApi`는 `exports`를 통과해 `consumer`가 읽습니다. `provider.internal.InternalApi`는 public class여도 package가 export되지 않아 소스 import 단계에서 거절됩니다.
5. synchronized wrapper는 `list`의 모니터 아래 iterator를 만들고 `A`를 읽습니다. backing에 `B`가 추가되면 같은 live wrapper의 현재 크기는 `2`가 되지만, 이전 iterator snapshot이라고 말할 수는 없습니다.
6. Copy-on-write iterator를 만든 뒤 list에 `C`를 추가하면 현재 list는 `[A,B,C]`이고 기존 iterator 결과는 `[A,B]`입니다. weakly consistent queue iterator는 같은 입력 trace에서 관찰 집합이 실행 시점에 따라 달라질 수 있으므로 고정 결과 assertion을 두지 않습니다.

## 코드 해설

`run.sh`는 먼저 `javac -version`과 `java -version`을 별도 파일에 기록합니다. 명령이 없거나 Java runtime을 시작할 수 없으면 `NOT_RUN`을 출력하고 끝납니다. Java가 있는 환경에서는 정상 소스만 먼저 컴파일하고 실행한 뒤, 각 `Bad*.java` 묶음에 대해 컴파일이 성공하면 harness 자체를 실패시킵니다.

컬렉션 소스는 특정 thread scheduling을 재현하기 위해 sleep이나 무제한 stress를 사용하지 않습니다. `Vector`의 대표 fail-fast 경로와 COW snapshot은 deterministic한 단일 스레드 순서로도 계약의 차이를 설명할 수 있고, queue는 약한 일관성의 보장 범위를 넘지 않도록 `hasNext()`의 사용 가능성만 확인합니다. 오류 정리는 harness 시작 때 scratch `build`를 지우고 다시 만들도록 하며 저장소나 외부 서비스에는 쓰지 않습니다.

## 실행 절차

저장소 루트에서 실행합니다.

```sh
sh examples/knowledge/java-access-and-collections-lab/run.sh
```

Java가 설치된 개발 환경의 정상적인 기대 출력은 다음 종류를 포함합니다.

```text
PASS: protected qualifier, private nest access
PASS: protected Base qualifier rejected
PASS: package-private top-level type rejected
PASS: private access outside nest rejected
PASS: exported public type is readable
PASS: non-exported module package rejected
PASS: final class extension rejected
PASS: final method override rejected
PASS: synchronized wrapper, Vector, Hashtable, CopyOnWriteArrayList, ConcurrentLinkedQueue
```

2026-09-18 Homebrew OpenJDK 21.0.12.1에서 정상 컴파일·실행, 의도한 컴파일 거절, 모듈 경계, 컬렉션 assertion을 통과했습니다. 기본 `java`가 JDK를 찾지 못한다면 `PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH sh examples/knowledge/java-access-and-collections-lab/run.sh`처럼 설치된 JDK 경로를 지정합니다. 문서 기준 Java SE 25와 실제 실행 JDK 21은 구분합니다.

## 실패 주입과 진단

### protected 오류

`BadProtectedQualifier.java`를 컴파일했는데 성공한다면 파일이 정말 다른 package인지, `Base.value`가 protected인지, `javac`가 올바른 source root를 읽는지 확인합니다. 오류가 나지만 원인이 모호하면 `Base base = sub`와 `Sub sub`의 선언 타입을 출력하는 것이 아니라 소스 선언을 먼저 대조합니다. 실제 객체 타입을 근거로 성공을 예상하는 것이 이 사례의 대표 오진입니다.

### 모듈 오류

`BadMain`이 컴파일된다면 consumer가 module path가 아니라 classpath로 우회되고 있거나, provider module descriptor가 실제 컴파일 입력에서 빠졌는지 확인합니다. `--module-path`와 `-d` 출력 위치를 기록하고, `module-info.java`의 module name과 consumer의 `requires`가 일치하는지 확인합니다. `opens`를 추가해도 일반 source import 오류가 자동으로 사라진다고 판단하지 않습니다.

### final 오류

final 확장 실패가 통과하면 `FinalRules`가 실제로 final인지, `BadFinalClass`가 다른 `FinalRules`를 참조하는지, stale class 파일을 사용하고 있는지 확인합니다. harness는 매 실행 시 build를 지우므로 stale output 가능성을 줄입니다. final method 사례에서는 method signature와 `@Override` 대상이 정말 같은지 확인합니다.

### 순회 오류

synchronized wrapper에서 간헐적인 `ConcurrentModificationException`이 발생하면 iterator를 wrapper lock 밖에서 만들었거나 backing collection을 직접 수정했는지 확인합니다. Vector/Hashtable에서 예외가 보이지 않는다고 안전 판정하지 말고, legacy enumeration이면 문서의 undefined 결과 경계를 적용합니다. COW list의 새 원소가 기존 iterator에 보이기를 기대했다면 snapshot 생성 시점을 잘못 모델링한 것입니다. concurrent queue에서 특정 새 원소가 항상 보여야 한다고 assertion했다면 weak consistency 범위를 넘은 테스트이므로 기대값을 낮춥니다.

## 검증 범위와 한계

공식 API 확인 범위는 Java SE 25/JDK 25 문서에 한정했고 확인일은 `2026-09-17`입니다. 이는 이 패키지가 Java SE 25 API를 기준으로 작성되었다는 뜻이며, 이 환경에서 JDK 25로 실행했다는 뜻은 아닙니다. `Vector`, `Hashtable`, `Collections.synchronizedList`, `CopyOnWriteArrayList`, `ConcurrentLinkedQueue`, `AccessibleObject`, `ModuleDescriptor`, `Modifier`의 관련 문구는 아래 공식 API 링크와 적용 범위로 확인합니다. JLS §6.6 및 final class/method의 substantive text는 공식 fetch가 목차만 반환했으므로 전문 인용을 만들지 않았습니다.

이 lab은 protected qualifier, private nested access, package-private top-level visibility, ordinary source `exports`, final class/method compiler rejection, legacy collection traversal distinctions의 bounded example입니다. module layers, automatic/open module 전체 효과, class loader, security policy, JMM proof, all concurrent schedules, JMH/JFR 성능, production I/O와 framework integration은 범위 밖입니다. private method의 `trySetAccessible()`은 기본 모듈 경계에서 false, 명시적인 `--add-opens`에서 true인 경우를 각각 실행했습니다. 다른 JDK 버전이나 전체 모듈 조합의 검증은 아닙니다.

## 참고 자료

- [Java SE 25 JLS §6.6](https://docs.oracle.com/javase/specs/jls/se25/html/jls-6.html#jls-6.6) — 접근 제어 확인 대상. 전문 본문은 이번 fetch에서 회수되지 않았습니다.
- [Vector API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Vector.html) — synchronized, fail-fast iterator, non-fail-fast enumeration.
- [Hashtable API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Hashtable.html) — synchronized, null 금지, iterator와 enumeration 경계.
- [Collections.synchronizedList API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Collections.html#synchronizedList(java.util.List)) — wrapper 전체 접근과 순회 시 수동 동기화.
- [CopyOnWriteArrayList API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/CopyOnWriteArrayList.html) — snapshot iterator와 mutation 비용.
- [ConcurrentLinkedQueue API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ConcurrentLinkedQueue.html) — weakly consistent iterator와 bulk operation 비원자성.
- [AccessibleObject API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/reflect/AccessibleObject.html) — reflection 접근에서 exports와 opens의 차이.
- [ModuleDescriptor API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/module/ModuleDescriptor.html) — open module의 유효 runtime 처리.
- [Modifier API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/reflect/Modifier.html) — final modifier bit 관찰.
