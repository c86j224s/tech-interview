---
id: java-access-contracts
title: Java 접근 제어와 타입 경계
topic: 언어·런타임
summary: Java의 접근 제어와 타입 경계를 컴파일 시점의 이름 해석·상속·모듈 공개와 API 변경 운영으로 연결합니다.
questionIds: []
prerequisites: [programming-language-foundations]
related: [java-dispatch-erasure, java-equality-immutability, java-metadata, api-meaning]
reviewedAt: '2026-09-17'
---

# Java 접근 제어와 타입 경계

## 접근성·범위·공개 경계

Java에서 이름이 나타날 수 있는 범위와 선언을 실제로 사용할 수 있는 접근성은 다른 개념입니다. 범위는 이름 해석의 문맥이고, 접근성은 선택한 멤버·생성자·선언 타입을 호출자가 사용할 수 있는지를 판단하는 규칙입니다. 다른 클래스의 메서드를 호출할 때는 멤버의 접근 수준과 호출 표현식에 쓰는 타입의 접근 가능성을 함께 확인합니다. 비공개 상위 클래스의 public 멤버도 접근 가능한 하위 타입에 상속되면 그 하위 타입을 통해 호출할 수 있습니다.

접근 제어자는 구현 세부사항을 숨기면서 컴파일러가 지키는 API 경계를 만듭니다. `private` 상태를 직접 쓰지 못하게 하고 검증된 행동만 공개하면 객체의 불변식, 즉 항상 유지해야 하는 조건을 한곳에서 검사하기 쉽습니다. 그러나 모든 필드를 `private`으로 바꾼다고 권한·상태·동시성 규칙이 자동으로 생기는 것은 아닙니다. 외부에 어떤 행동과 변경 권한을 허용할지도 API의 일부입니다.

이 글은 일반 Java 소스 호출의 접근을 중심으로 설명합니다. 모듈의 `exports`·`requires`는 그 위에 놓이는 공개 경계이고, reflection의 접근 허용은 별도 실행 계약입니다. Java SE 25 JLS/JVMS의 해당 문서 본문은 이번 감사에서 전문으로 회수되지 않았으므로, 세부 규칙을 새로 인용하는 대신 확인된 API 의미와 검증할 컴파일 상황을 분명히 적습니다.

## 네 가지 멤버 수준

멤버와 생성자는 `public`, `protected`, package-private, `private` 가운데 하나의 접근 수준을 가집니다. package-private은 키워드를 생략한 상태를 가리키며, 선언 종류에 따라 생략된 멤버가 다른 기본 공개 규칙을 가질 수 있으므로 인터페이스·중첩 타입의 선언을 따로 확인합니다.

| 선언 | 선언 클래스 | 같은 패키지 | 다른 패키지의 하위 클래스 | 그 밖의 클래스 |
| --- | --- | --- | --- | --- |
| `public` | 허용 | 허용 | 허용 | 선언 타입과 모듈 공개 조건 아래 허용 |
| `protected` | 허용 | 허용 | 하위 클래스 문맥의 제한 아래 허용 | 불허 |
| package-private | 허용 | 허용 | 불허 | 불허 |
| `private` | 둘러싼 최상위 타입 본문 안에서 허용 | 불허 | 불허 | 불허 |

`public`은 모든 코드에서 무조건 보인다는 뜻이 아닙니다. 최상위 클래스는 `public` 또는 package-private만 될 수 있고, 다른 모듈의 코드는 선언 모듈을 읽을 수 있어야 하며 해당 패키지가 `exports`되어야 합니다. `opens`는 일반 소스 호출을 위한 `exports`의 대체가 아니라 주로 reflection 접근을 위한 모듈 정책입니다. 따라서 “메서드가 public이니 외부 호출 가능하다”라는 판단은 타입·패키지·모듈을 모두 통과한 뒤에 해야 합니다.

## 패키지와 최상위 타입

패키지는 이름을 정리하는 단위인 동시에 package-private 접근이 적용되는 컴파일 경계입니다. 다음 `ReportParser`는 메서드가 `public`이어도 클래스 자체가 package-private이므로 `report.internal` 밖의 일반 소스가 그 타입을 이름으로 사용할 수 없습니다.

```java
// report/internal/ReportParser.java
package report.internal;

class ReportParser {
    public Report parse(String text) { /* 교육용 생략 */ return null; }
}
```

호출자의 관점에서는 먼저 `ReportParser` 타입을 얻는 단계에서 막힙니다. 메서드 선언에 `public`이 적혀 있어도 접근 불가한 선언 타입이 공개 API로 변하지 않습니다. 외부 사용이 목적이면 최상위 타입을 `public`으로 만들되, 구현 타입을 그대로 반환하기보다 좁은 인터페이스나 불변 결과 타입을 반환하면 이후 구현 교체의 범위를 줄일 수 있습니다.

모듈까지 포함하면 공개 여부는 선언자, 패키지, 모듈의 세 층으로 나뉩니다. 한 층을 열었다고 나머지 층까지 열리는 것은 아닙니다. 반대로 내부 패키지를 무분별하게 export하면 현재 클래스 이름과 반환 타입이 외부 컴파일러에 노출되어, 나중에 구현을 교체할 때 호환성 부담이 됩니다.

## Protected 상속 경계

`protected`는 같은 패키지에서 package-private과 비슷하게 사용할 수 있고, 다른 패키지에서는 하위 클래스 본문 안에서 제한적으로 사용할 수 있습니다. “하위 클래스라면 부모의 protected 멤버를 어떤 부모 참조로도 읽을 수 있다”라고 이해하면 안 됩니다.

다른 패키지의 하위 클래스에서 인스턴스 필드나 메서드를 사용할 때는 접근을 한정하는 표현식의 컴파일 타입이 하위 클래스 자신 또는 그 하위 타입이어야 합니다. 실제 객체가 하위 객체인지보다 참조 변수의 정적 타입이 이 접근 검사의 기준이 됩니다.

```java
// package base
package base;
public class Base {
    protected int value;
}

// package client
package client;
import base.Base;

public class Sub extends Base {
    void test(Base base, Sub sub) {
        value = 1;       // 상속된 멤버: 허용
        sub.value = 2;   // qualifier 타입이 Sub: 허용
        // base.value = 3; // qualifier 타입이 Base: 컴파일 거절
    }
}
```

`base`가 실제로 `Sub` 객체를 가리켜도 마지막 표현식은 허용되지 않습니다. 이 규칙은 외부 패키지의 하위 클래스가 임의의 부모 참조를 통해 부모 구현 상태를 읽는 범위를 제한합니다. static `protected` 멤버와 protected 생성자는 인스턴스 접근 예제와 다른 규칙을 가지므로 위 사례를 전체 protected 규칙으로 확장하지 않습니다.

## Private와 중첩 타입

`private` 멤버는 선언을 둘러싼 최상위 클래스 또는 인터페이스의 본문 안에서 접근할 수 있습니다. 따라서 같은 최상위 타입 본문에 정의된 중첩 타입은 서로의 private 멤버를 사용할 수 있습니다. 이를 “private은 오직 바로 선언한 인스턴스 메서드만 접근 가능하다”라고 단순화하면 중첩 타입 경계를 놓칩니다.

```java
public class Account {
    private int cents;

    static class Auditor {
        static int read(Account account) {
            return account.cents;
        }
    }
}
```

`Auditor`의 코드는 `Account`의 최상위 본문 안에 있으므로 `cents`를 읽을 수 있습니다. 그렇다고 외부 호출자가 `cents`에 직접 접근할 수 있게 되는 것은 아닙니다. public getter를 새로 만들면 private 필드에 대한 직접 접근을 허용하는 대신 공개 행동을 추가하는 것이므로, 반환 타입과 변경 권한을 다시 설계해야 합니다.

가변 내부 목록을 getter로 그대로 반환하면 호출자가 목록의 구조를 바꿀 수 있습니다. 구조 변경만 막으려면 변경 불가 뷰를, 호출 시점의 원소 구성을 고정하려면 `List.copyOf` 스냅샷을 사용할 수 있습니다. 원소 객체까지 가변이면 어느 선택도 깊은 불변을 자동으로 만들지 않으므로, [Java 값 동등성·불변 키·방어적 복사](/tech-interview/notes/java-equality-immutability/)의 원소 수명과 복사 경계를 함께 읽습니다.

## 호출 선택과 재정의

접근 제어와 메서드 선택은 관련 있지만 같은 단계의 규칙은 아닙니다. 오버로드는 컴파일 시점에 호출 표현식의 정적 타입과 변환 가능성을 기준으로 후보를 고릅니다. 재정의는 실행 시점에 실제 객체의 구현을 선택합니다. 접근 검사에 실패한 호출은 허용되지 않으며, 하위 클래스는 상위 메서드의 접근 수준을 더 좁게 만들어 재정의할 수 없습니다.

```java
class Base {
    protected void write(Object value) { System.out.println("base"); }
}

class Sub extends Base {
    @Override
    public void write(Object value) { System.out.println("sub"); }
}
```

하위 구현이 `protected`를 `public`으로 넓히면 부모 타입으로 호출하던 기존 코드는 기존 접근 범위 안에서 계속 사용할 수 있습니다. 하지만 메서드가 컴파일된다는 사실만으로 행동 호환성이 보장되지는 않습니다. 반환값의 의미, 상태 변경, 예외, 스레드 안전성도 API 계약이므로 접근 수준 변경과 별도로 검토합니다. 호출 선택과 타입 소거의 세부 실행 흐름은 [Java 호출 선택과 제네릭 타입 소거](/tech-interview/notes/java-dispatch-erasure/)에서 이어집니다.

## 모듈 공개와 소비자 경계

외부 모듈이 `public` 타입을 사용하려면 선언 모듈을 읽을 수 있어야 하고, 타입이 속한 패키지가 외부 모듈에 export되어야 합니다. 예를 들어 `module billing.api { exports billing.api; }`라면 `billing.internal`의 public 타입은 모듈 밖 일반 컴파일러에게 공개되지 않습니다. 반대로 `opens billing.internal to framework;`는 지정된 framework의 reflection을 위한 열기일 수 있지만, 소스 코드의 타입 이름 해석을 허용하는 문장으로 읽으면 안 됩니다.

```diagram
{"title":"멤버에서 모듈까지의 접근 경계","caption":"외부 호출은 멤버와 호출 타입의 공개 조건을 함께 확인합니다. 비공개 상위 타입의 public 상속 멤버는 별도로 구분합니다.","rows":[[{"id":"member","label":"멤버 접근 수준","detail":["private · protected · public"]}],[{"id":"type","label":"선언 타입 접근","detail":["최상위 타입의 공개 여부"]}],[{"id":"package","label":"패키지 공개","detail":["모듈 exports"]}],[{"id":"module","label":"모듈 가독성","detail":["requires와 읽기 관계"]}]],"edges":[{"from":"member","to":"type","label":"멤버를 담은 타입"},{"from":"type","to":"package","label":"패키지 경계"},{"from":"package","to":"module","label":"모듈 경계"}]}
```

이 그림은 일반 Java 소스 호출의 경계입니다. reflection은 `opens`, 실행 옵션, 프레임워크의 접근 방식이라는 별도 조건을 가질 수 있습니다. 따라서 `IllegalAccessException`이나 reflection 실패를 source-level 접근 오류와 같은 원인으로 묶지 않습니다.

## 주문 API의 불변식

주문 객체의 상태를 직접 공개하지 않고 `cancel()` 행동을 제공한다고 하겠습니다. `cancel()`은 현재 상태가 결제 완료인지, 배송이 시작되었는지, 이미 취소되었는지를 확인한 뒤 상태 변경·취소 기록·환불 접수를 어떤 순서로 진행할지 결정합니다. `private status`는 임의 대입을 막는 데 도움을 주지만, 업무 검사를 수행하고 실패를 표현하는 책임은 행동 메서드에 있습니다.

HTTP controller가 `Order`의 내부 필드에 직접 의존하면 접근 수준과 JSON 표현이 업무 규칙에 엉킵니다. 요청을 도메인 명령으로 바꾸고, 도메인 서비스가 조건부 변경을 호출하며, 응답은 필요한 결과 표현으로 변환하면 각 경계의 변경 이유를 분리할 수 있습니다. 반환값을 public으로 열 때도 내부 객체의 가변 참조와 민감한 상태가 함께 노출되지 않는지 확인합니다.

상태 전이를 숫자로 추적하면 더 분명합니다. `PAID` 주문에 `cancel()`이 들어오면 도메인은 “취소 가능 여부 확인 → 새 상태 후보 `REFUND_PENDING` 생성 → 상태 버전 증가 → 환불 작업 ID 기록”을 거칩니다. 상태 저장 전에 refund 작업 ID를 먼저 외부에 알리면 재시도 때 중복 환불이 생길 수 있으므로, 공개 메서드의 접근 경계와 외부 효과의 멱등 경계를 별도로 둡니다.

## 변경과 진단

API를 설계할 때 외부에 필요한 행동, 읽기 전용 정보, 패키지 내부 협력용 확장점, 테스트 전용 경계를 분리합니다. 기본은 가장 좁은 접근 수준에서 시작하고, 하위 클래스 확장이 정말 필요한지 조합이나 포트가 더 적합한지 비교합니다. `protected`는 상속 사용자와 부모 구현을 결합하므로 하위 클래스의 수명과 변경 권한을 함께 검토합니다.

`public` 메서드를 추가했는데 호출자가 컴파일되지 않으면 선언 타입의 공개 여부, 패키지 export, 모듈 readability를 순서대로 확인합니다. 컴파일 후 `NoSuchMethodError`가 나면 런타임 classpath의 다른 바이너리나 불일치한 버전을, `IllegalAccessError`가 나면 링크된 접근 수준과 모듈을 확인합니다. reflection 예외는 일반 소스 접근 검사와 별도로 실행 옵션과 `opens`를 확인합니다.

검증 사례는 같은 패키지의 package-private 접근, 외부 패키지 하위 클래스의 `protected` qualifier 오류, private 중첩 타입 접근, 최상위 타입의 export 누락을 각각 작은 소스 단위로 나눕니다. 성공·실패를 한 실행 출력으로 대신하지 않고 컴파일러 진단, `module-info.java`, 실행 classpath와 모듈 경계를 각각 기록합니다. 이 문서의 작성 과정에서는 Java 컴파일·모듈 실행을 수행하지 않았으므로 아래 사례는 규칙에 따른 예상 결과입니다.

## 참고 자료와 검증 범위

- [Java SE 25 JLS §6.6](https://docs.oracle.com/javase/specs/jls/se25/html/jls-6.html#jls-6.6) — Java SE 25 Edition; 문서 날짜 2025-07-29로 표시된 공식 언어 사양. 접근성·protected·최상위 타입·모듈 경계의 해당 절을 확인 대상으로 삼았으나, 이번 회수에서는 실질 본문이 전문 반환되지 않아 exact quote로 사용하지 않았습니다.
- [Java SE 25 JVMS](https://docs.oracle.com/javase/specs/jvms/se25/html/index.html) — Java SE 25 Edition; 2025-07-29 문서 표시. 모듈·링크·접근의 JVM 수준 세부 본문은 이번 회수에서 확인되지 않아 일반 설명의 단독 근거로 사용하지 않았습니다.
- [Java SE 25 `Collection` API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Collection.html) — Java SE 25/JDK 25. 접근 경계에서 반환하는 변경 불가 뷰의 의미를 확인했습니다.
- [Java SE 25 `List` API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/List.html) — Java SE 25/JDK 25. `List.copyOf` 스냅샷과 가변 원소의 경계를 확인했습니다.

이 글의 Java 규칙 예제는 2026-09-17에 확인한 Java SE 25 문서에 맞춘 교육용 예상이며, 이 문서의 작성 과정에서 `javac`·`javap`·모듈 실행을 수행한 결과가 아닙니다. JLS/JVMS 실질 본문 미회수, 프로젝트의 실제 `module-info.java`, 빌드 도구, classpath와 reflection 설정은 미해결 검증 범위로 남깁니다.
