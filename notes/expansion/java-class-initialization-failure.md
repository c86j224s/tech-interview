---
id: java-class-initialization-failure
title: Java 클래스 초기화 순서와 실패 상태
topic: 언어·런타임
summary: 'Java의 active use, 상수 변수 인라인, 텍스트 순서, 초기화 잠금과 erroneous 상태를 실제 접근 trace로 설명합니다.'
questionIds: []
prerequisites:
  - java-resource-reachability
related:
  - java-resource-reachability
reviewedAt: '2026-09-19'
---
# Java 클래스 초기화 순서와 실패 상태

Java에서 클래스가 로드되었다는 사실과 static 초기화가 끝났다는 사실은 같지 않습니다. 클래스 초기화는 active use를 만났을 때 실행되며, 정적 필드의 기본값 상태와 텍스트 순서, 다른 클래스의 의존, 초기화 실패 후 erroneous 상태가 서로 연결됩니다. `static final`이라는 표면 문법만으로 초기화 여부를 판단할 수 없는 이유도 constant variable 인라인이라는 예외가 있기 때문입니다. 이 글은 접근 하나를 “로드 → `<clinit>` → 성공 또는 실패”의 상태 전이로 쪼개고, 같은 클래스에 두 번째로 접근했을 때 왜 다른 오류가 관찰되는지까지 추적합니다.

## 생명주기 구분

JLS는 loading, linking, initialization을 같은 단계로 취급하지 않습니다. 타입 정보를 읽고 준비하는 단계가 끝나도 static initializer가 실행되었다고 볼 수 없습니다. 초기화가 필요한 active use가 발생하면 JVM은 클래스 초기화를 시작하고, 초기화가 완료될 때까지 그 클래스의 정적 상태를 다른 접근에 안정적으로 게시하려고 조정합니다.

다음 필드를 비교해 보겠습니다.

```java
final class Flags {
    static final int LIMIT = 8;
    static final Integer BOXED = 8;
    static { System.out.println("Flags init"); }
    static int value() { return 9; }
}
```

다른 클래스가 `int a = Flags.LIMIT;`를 컴파일하면 `LIMIT`가 JLS의 constant variable 조건을 만족하는 경우 값 8이 사용 코드에 들어갈 수 있습니다. 이 읽기만으로 `Flags`의 `<clinit>`가 실행된다고 단정할 수 없습니다. `Flags.BOXED`는 참조형 필드이고, `Flags.value()`는 메서드 본문 실행이 필요하므로 일반적인 active use 초기화 경로를 탑니다. 클래스 파일에서 이 차이를 확인하려면 소스 모양보다 constant variable 조건과 실제 바이트코드의 필드 접근을 봐야 합니다.

## Active use 경계

대표적인 active use는 static 메서드 호출, 컴파일 타임 상수가 아닌 static 필드의 읽기, static 필드에 값 쓰기, 특정 클래스의 인스턴스 생성입니다. 배열 타입을 참조하는 것과 배열 원소 타입의 초기화는 별도입니다. `SomeType.class`나 리플렉션 API도 호출 형태와 인자로 초기화를 요청하는지 구분해야 하므로 “클래스를 언급하면 무조건 `<clinit>`”라고 말하면 안 됩니다.

```diagram
{"title":"정적 접근에서 초기화로 가는 경계","caption":"constant variable은 값이 인라인될 수 있고, 일반 필드 읽기와 static 메서드 호출은 초기화 절차를 요구할 수 있습니다.","rows":[[{"id":"access","label":"정적 접근"}],[{"id":"const","label":"constant variable"},{"id":"field","label":"일반 필드"},{"id":"method","label":"static 메서드"}],[{"id":"inline","label":"값 인라인"},{"id":"init","label":"초기화 시작"}]],"edges":[{"from":"access","to":"const","label":"상수 조건"},{"from":"access","to":"field","label":"필드 값 필요"},{"from":"access","to":"method","label":"호출 대상 필요"},{"from":"const","to":"inline","label":"초기화 없이 가능"},{"from":"field","to":"init","label":"active use"},{"from":"method","to":"init","label":"active use"}]}
```

상수 필드 initializer에 registry 등록이나 로깅을 넣고 다른 클래스에서 그 상수를 읽으면 효과가 관찰되지 않을 수 있습니다. 부수 효과가 필요하면 명시적 메서드나 비상수 필드 접근으로 초기화 시점을 드러내는 편이 안전합니다. 컴파일 시점에 인라인된 상수는 라이브러리의 값 변경에도 클라이언트 재컴파일 전까지 옛 값을 사용할 수 있으므로, API 계약과 초기화 부수 효과를 분리해야 합니다.

## 텍스트 순서와 기본값

초기화가 시작되면 정적 저장 공간은 먼저 기본값 상태에서 출발합니다. 참조는 `null`, `int`는 0, `boolean`은 `false`이고, 그 뒤 클래스 본문에 나타난 static field initializer와 static block이 텍스트 순서대로 실행됩니다.

```java
final class Order {
    static int first = 10;
    static int second = first + 5;
    static int seen;
    static { seen = second; }
}
```

실행 상태는 `first=0, second=0, seen=0`에서 시작해 `first=10`, `second=15`, `seen=15`로 변합니다. 반대로 메서드를 통한 간접 읽기는 다음처럼 대입 전 기본값을 관찰할 수 있습니다.

```java
final class Indirect {
    static int value = read();
    static int source = 42;
    static int read() { return source; }
}
```

`value` initializer가 먼저 실행될 때 `read()`가 보는 `source`는 아직 42로 대입되지 않았으므로 0입니다. 이후 `source=42`가 실행되어도 `value`는 이미 0입니다. 같은 클래스의 단순 이름으로 forward reference를 쓰는 경우에는 컴파일 단계에서 금지되는 표현도 있지만, 메서드 호출로 간접화하면 컴파일된다는 사실과 초기화된 값을 읽는다는 사실이 분리됩니다.

## 실패 상태 전이

초기화 중 initializer가 `E`를 던지면 클래스는 정상 완료 상태가 되지 않고 erroneous 상태로 표시됩니다. JLS 12.4.2의 핵심 조건은 `E`가 `Error`이면 그 `Error`를 그대로 전파하고, `Error`가 아닌 `Throwable`이면 `ExceptionInInitializerError`로 감싸는 것입니다. 따라서 “초기화 실패는 항상 ExceptionInInitializerError”라고 답하면 틀립니다. 초기화 실패가 superclass 또는 default-method superinterface 초기화에서 발생한 경우에도 의존 클래스에 실패가 전파되는 경로를 별도로 구분해야 합니다.

```java
final class Broken {
    static final int value = Integer.parseInt("not-a-number");
    static int get() { return value; }
}

try { Broken.get(); } catch (Throwable first) { /* 첫 active use */ }
try { Broken.get(); } catch (Throwable second) { /* erroneous 상태 */ }
```

이 예의 첫 접근은 `NumberFormatException` 같은 비-Error 원인이 initializer에서 나오므로 초기화를 시작한 호출 경로에서 `ExceptionInInitializerError`로 관찰될 수 있습니다. 그 뒤 클래스는 erroneous 상태이며 `<clinit>`를 처음부터 재시도하지 않습니다. 후속 active use는 보통 `NoClassDefFoundError`를 관찰하고, 그 오류의 cause에는 초기화 실패와 관련된 정보가 연결될 수 있습니다. 이름 때문에 “class 파일이 없었다”고만 해석하면 진단을 놓칩니다.

첫 실패 시점에 이미 `Error`가 던져졌다면 wrapper가 아니라 그 `Error`의 전파를 우선 기록해야 합니다. 테스트에서는 실제 `Throwable` 타입, `getCause()`, initializer 실행 횟수, 클래스 로더를 함께 기록해야 하며 같은 JVM에서 다른 테스트가 먼저 클래스를 사용하면 첫 실패 경로가 사라질 수 있습니다.

## 초기화 잠금과 순환

클래스 초기화는 같은 클래스의 초기화 코드가 여러 스레드에서 동시에 실행되지 않도록 조정합니다. 그러나 이 직렬화가 서로 다른 클래스 사이의 순환 의존을 없애지는 않습니다. T1이 A 초기화를 시작하여 B의 active use로 들어가고, 동시에 T2가 B 초기화를 시작하여 A를 요구하면 다음 대기 그래프가 가능합니다.

| 시점 | T1 | T2 |
| --- | --- | --- |
| 1 | A 초기화 진행 | B 초기화 진행 |
| 2 | B 초기화 완료 대기 | A 초기화 완료 대기 |
| 3 | 순환 대기 | 순환 대기 |

단일 스레드에서 먼저 A를 사용하면 A→B 한 방향으로 진행되고, 재귀적 요청이 현재 초기화 흐름을 관찰하거나 기본값을 보는 경로가 될 수 있습니다. 따라서 순환 참조 소스가 있다고 해서 모든 실행이 교착한다고 단정하지 말고, 두 스레드가 각 클래스를 처음 동시에 사용하는 조건과 thread dump를 확인해야 합니다. `<clinit>`에서 외부 락, I/O, 다른 클래스의 복잡한 호출을 줄이는 것이 설계상 비용을 낮춥니다.

## 구현과 진단

초기화가 실패하면 자동 재시도를 기대하기 어렵습니다. 설정 파일, 네트워크 연결, 외부 서비스 확인처럼 복구가 필요한 작업은 static initializer에 숨기기보다 명시적 bootstrap 메서드가 `Uninitialized`, `Ready`, `Failed` 상태와 재시도 정책을 반환하도록 설계하는 편이 낫습니다. 반대로 불변인 작은 값과 순환이 없는 객체 그래프는 클래스 초기화의 안전한 게시 이점을 활용할 수 있습니다.

진단 순서는 다음과 같습니다. 먼저 어떤 클래스 로더가 타입을 정의했는지 확인합니다. 다음으로 active use가 상수 인라인인지 실제 필드 접근인지 바이트코드와 소스에서 분리합니다. 그 뒤 initializer의 텍스트 순서와 타 클래스 호출을 펼치고, 첫 예외와 후속 `NoClassDefFoundError`의 cause 체인을 각각 저장합니다. 교착 의심이면 스레드별 초기화 시작과 대기 대상, thread dump의 순환을 함께 기록합니다.

## 비용과 한계

클래스 초기화의 장점은 완료 전 접근을 조정하고 성공 후 정적 상태를 공유한다는 점이지만, 숨은 비용은 첫 active use에 지연과 외부 실패가 집중된다는 점입니다. 상수 인라인은 초기화 비용을 줄일 수 있으나 클라이언트 재컴파일 전 값 불일치와 부수 효과 누락을 만듭니다. 순환 초기화는 단일 스레드에서 우연히 작동하다 동시 부하에서 교착할 수 있습니다.

이 글의 규범 근거는 [Java Language Specification 21 Chapter 12](https://docs.oracle.com/javase/specs/jls/se21/html/jls-12.html)입니다. JLS 12.4.1의 trigger와 12.4.2의 초기화 순서·오류 상태·스레드 조정을 기준으로 했으며, 특정 JVM에서 반드시 같은 로그가 나온다고 주장하지 않습니다. Java 컴파일러와 JVM을 이 환경에서 실행하지 않았으므로 예제는 설명용 예상 trace이고, 실제 운영 판단에는 해당 Java 버전의 `javap`, 테스트 격리, thread dump를 추가해야 합니다.

### 참고자료

- [JLS 21 Chapter 12](https://docs.oracle.com/javase/specs/jls/se21/html/jls-12.html), 2026-09-19 확인. active use, constant variable, initialization lock, erroneous 상태와 Error 래핑 조건의 근거입니다.
- [Java SE 21 API Class](https://docs.oracle.com/en/java/javase/21/docs/api/), 버전별 API 관찰의 출발점으로만 사용하며 JLS 규칙과 JVM 구현 세부를 혼동하지 않습니다.
