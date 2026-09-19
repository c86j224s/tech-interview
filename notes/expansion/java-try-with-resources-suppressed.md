---
id: java-try-with-resources-suppressed
title: Java try-with-resources와 Suppressed Exception
topic: 언어·런타임
summary: >-
  try-with-resources의 역순 close, 본문·정리 예외의 주 예외 선택, Java 9 자원 변수와 effectively
  final 경계를 설명합니다.
questionIds: []
prerequisites:
  - java-resource-reachability
  - java-execution-lifetime
related:
  - java-resource-reachability
  - java-execution-lifetime
reviewedAt: '2026-09-19'
---
# Java try-with-resources와 Suppressed Exception

`try-with-resources`는 `finally { close(); }`를 짧게 쓴 문법이 아니라, 자원 목록의 성공적인 초기화와 본문 결과를 보존한 뒤 정해진 순서로 정리하는 실행 계약입니다. 자원은 성공한 선언 순서의 역순으로 닫히고, 본문이 실패하면 본문 예외가 primary가 되며 close 실패는 suppressed로 남습니다. 본문이 정상 종료되면 close 단계에서 처음 발생한 예외가 primary가 되고 이후 close 실패가 suppressed가 됩니다. 중간 생성 실패, existing-variable 캡처, suppression API의 한계를 각각 분리해야 실제 장애 trace를 해석할 수 있습니다.

## 자원 소유와 합성 구조

```java
try (Resource first = open("first");
     Resource second = open("second")) {
    use(first, second);
}
```

정상 경로는 `open(first) → open(second) → body → second.close() → first.close()`입니다. 둘째 생성이 예외를 던지면 둘째는 자원 목록에 성공적으로 들어간 객체가 아니므로 `second.close()` 대상이 아니고, 이미 성공한 `first`만 닫습니다. 따라서 정확한 표현은 “괄호에 쓴 모든 변수를 닫는다”가 아니라 “성공적으로 초기화된 자원을 성공 순서의 역순으로 닫는다”입니다.

컴파일러가 내부적으로 예외 저장 변수와 중첩 `try/finally`를 사용한다고 이해할 수 있지만, 실제 바이트코드가 설명용 의사 코드와 문자 그대로 같다고 주장할 필요는 없습니다. 언어가 보장하는 관찰 결과는 호출 순서와 primary/suppressed 관계입니다. `AutoCloseable.close()`의 checked exception은 바깥 메서드의 `throws`, catch, 자원 타입의 선언에 반영해야 합니다.

## 역순 close와 중간 실패

`r1`이 성공하고 `r2` 생성이 실패한 trace를 적으면 다음과 같습니다.

| 단계 | 관찰 | 정리 대상 |
| --- | --- | --- |
| 1 | `open(r1)` 성공 | `r1` 등록 |
| 2 | `open(r2)` 예외 | `r2` 미등록 |
| 3 | `r1.close()` 호출 | `r1` 반납 |
| 4 | 호출자에 생성 예외 전달 | close 실패는 suppressed 가능 |

생성 단계에서 이미 파일 생성, 원격 lease 획득, DB 세션 등록 같은 외부 효과가 발생했다면 `close()`가 거래 rollback을 자동으로 제공하지는 않습니다. `AutoCloseable`은 핸들을 반납하는 수명 계약이지 외부 시스템의 원자성을 보장하는 거래 계약이 아닙니다. 필요한 보상은 `commit`, `abort`, 상태 표식과 재시도 정책으로 별도 설계해야 합니다.

## 본문 예외와 primary

본문과 close가 모두 실패하는 경우 본문 예외가 primary입니다.

```java
final class FailingResource implements AutoCloseable {
    private final String name;
    FailingResource(String name) { this.name = name; }
    @Override public void close() throws Exception {
        throw new Exception("close " + name);
    }
}

try (var r = new FailingResource("r")) {
    throw new Exception("body");
} catch (Exception e) {
    // 예상: e.message = body
    // e.getSuppressed()[0].message = close r
}
```

본문 예외가 이미 primary로 정착했기 때문에 close 예외를 새로 던져 본문 원인을 덮지 않고 `addSuppressed` 관계로 보존합니다. 둘 이상의 자원에서 본문이 실패하고 `r2`, `r1` close가 모두 실패하면 primary는 여전히 본문 예외이고 suppressed 배열에는 close가 실제 호출된 역순 실패 순서로 추가됩니다. 로그 수집기가 suppressed 목록을 생략하면 장애의 정리 실패가 사라질 수 있으므로 원인과 후속 실패를 분리된 필드로 저장하는 것이 좋습니다.

## 정상 본문과 close 실패

본문이 정상 종료하면 close 단계의 첫 실패가 primary가 됩니다.

```java
try (var r1 = new FailingResource("r1");
     var r2 = new FailingResource("r2")) {
    // 정상 본문
} catch (Exception e) {
    // 예상: primary = close r2
    // suppressed[0] = close r1
}
```

`r2`가 먼저 닫히므로 그 예외가 호출자에게 전달되고, 이어서 `r1.close()`가 실패하면 그 예외가 primary에 suppressed로 추가됩니다. 이 규칙은 선언 순서가 아니라 실제 close 호출 순서로 판단해야 합니다. close 실패 하나가 남은 close를 중단하는 수동 `finally`와 달리, try-with-resources의 합성 구조는 이미 성공한 나머지 자원의 정리를 계속 시도합니다.

그러나 `Throwable.addSuppressed`에는 API 경계가 있습니다. suppression이 비활성화된 Throwable은 추가된 예외를 저장하지 않을 수 있고, primary와 suppressed가 동일 인스턴스이면 self-suppression 때문에 `IllegalArgumentException`이 발생할 수 있습니다. 그러므로 “항상 배열 길이가 자원 수-1”이라고 말하지 말고, 일반적인 서로 다른 예외 인스턴스와 suppression 허용 상태에서의 결과라고 범위를 표시해야 합니다.

```diagram
{"title":"try-with-resources의 예외 선택","caption":"성공한 자원을 역순으로 닫되, 본문 실패 여부가 primary 선택을 가릅니다. 설명용 흐름입니다.","rows":[[{"id":"open","label":"자원 생성"}],[{"id":"bodyok","label":"본문 성공"},{"id":"bodyfail","label":"본문 실패"},{"id":"openfail","label":"중간 생성 실패"}],[{"id":"close","label":"성공 자원 역순 close"},{"id":"primary","label":"primary와 suppressed"}]],"edges":[{"from":"open","to":"bodyok","label":"모두 성공"},{"from":"open","to":"bodyfail","label":"본문 예외"},{"from":"open","to":"openfail","label":"다음 생성 실패"},{"from":"bodyok","to":"close","label":"정상 종료 후 close"},{"from":"bodyfail","to":"close","label":"본문 예외 보존"},{"from":"openfail","to":"close","label":"이미 성공한 자원만"},{"from":"close","to":"primary","label":"첫 close 실패 primary 또는 suppressed"}]}
```

## Existing variable과 캡처

Java SE 21 규칙에서는 자원 선언식뿐 아니라 이미 존재하는 변수도 자원 목록에 넣을 수 있습니다.

```java
var input = Files.newInputStream(path);
try (input) {
    read(input);
}
```

이 표현식의 `input`은 자원 목록에 들어갈 때 definitely assigned이고 final 또는 effectively final이어야 합니다. 핵심은 “컴파일러가 블록의 변수 이름을 계속 추적하다가 마지막에 현재 값의 객체를 닫는다”가 아닙니다. JLS의 실행 모델은 자원 목록 시점의 값을 fresh local resource variable에 캡처하고 그 캡처를 close하는 쪽입니다. 따라서 이후 재대입 가능한 변수를 허용하여 이름의 시점별 값을 섞지 않고, 문법으로 안정적인 캡처를 요구합니다.

`input`이 가리키던 같은 스트림의 소유권을 복사하거나 새 핸들을 만드는 것은 아닙니다. 캡처된 값의 객체가 닫히므로 다른 별칭이 같은 스트림을 계속 사용하면 닫힌 자원 접근이 됩니다. effectively final은 close 대상의 값 캡처 계약을 표현할 뿐, 별칭, 두 번 close, 외부 거래 rollback까지 해결하지 않습니다. API 문서에서 caller와 callee 중 누가 close 책임을 갖는지 정해야 합니다.

## 예외 관측과 검증

검증 행렬은 `본문 성공/실패 × 생성 성공/부분 실패 × close 성공/실패`로 구성하고, 자원 이름을 로그에 포함합니다. 두 자원에서 `open1, open2, body, close2, close1`을 기록하면 중간 생성 실패의 정리 범위와 primary 배열의 순서를 구별할 수 있습니다. 예외 검증은 `getClass()`, message, `getSuppressed()` 각 원소, cause를 함께 확인해야 하며, suppressed가 비어 있는 이유가 close 성공인지 suppression 비활성화인지 구분해야 합니다.

이 문서의 예시는 Java 컴파일러나 JVM에서 실행한 측정 결과가 아니라 JLS 규칙을 따라 산출한 예상 trace입니다. 프로세스 강제 종료, `System.exit`, 외부 kill이 일어나면 정상적인 close 경로가 실행된다고 가정할 수 없습니다. close 메서드가 내부에서 다른 자원을 닫거나 자체적으로 같은 예외 인스턴스를 재사용하면 일반적인 translation 결과와 다른 API 예외가 발생할 수 있습니다.

## 설계 선택

자원 객체의 `close()`는 핸들 반납과 종료 실패 보고에 집중시키고, 외부 변경의 commit과 보상은 별도 상태 기계로 둡니다. 본문 예외를 우선 보존해야 하는 경로에서는 catch에서 suppressed를 문자열로 합쳐 버리지 말고 구조화된 진단 필드로 남깁니다. 사용자 응답에는 내부 경로를 노출하지 않되, 운영 로그에는 primary와 suppressed의 순서 및 자원 식별자를 저장합니다.

이미 만들어진 자원을 메서드에 넘길 때는 callee가 닫는지 caller가 계속 소유하는지 명시합니다. try-with-resources가 소유권을 자동 이전한다고 생각하면 호출자에서 이중 close 또는 닫힌 객체 사용이 생깁니다. 자원 생성이 외부 lease를 만들면 실패 시 abort를 별도 호출하고, close 실패가 반복되면 누수, 네트워크 종료, 종료 순서 오류를 서로 다른 지표로 분류합니다.

## 비용과 한계

try-with-resources는 중첩 `finally`를 직접 작성하는 비용과 본문 예외 덮어쓰기 위험을 낮추지만, close가 성공한다는 보증이나 외부 rollback을 제공하지 않습니다. suppressed 예외를 보존하면 진단 정보는 늘어나지만, stack trace와 자원 이름을 외부 응답에 그대로 내보낼 때 내부 경로가 노출될 수 있습니다. existing variable은 편리하지만 effectively final과 값 캡처를 이해하지 못하면 별칭 소유권을 잘못 설계하게 됩니다.

근거는 [JLS 21 §14.20.3 try-with-resources](https://docs.oracle.com/javase/specs/jls/se21/html/jls-14.html#jls-14.20.3)이며, 자원 초기화·역순 close·기존 변수의 fresh local capture·primary/suppressed 규칙을 확인하는 데 사용했습니다. 해당 페이지의 핵심 규칙을 기준으로 작성했지만 이 환경에서는 Java 런타임 실행을 하지 않았습니다. Java 9 도입 시점이라는 역사적 진술은 이 문서의 JLS 21 현재 규칙과 분리해 다루며, 버전별 소스 호환성은 실제 빌드 도구의 `--release`로 확인해야 합니다.

### 참고자료

- [JLS 21 §14.20.3](https://docs.oracle.com/javase/specs/jls/se21/html/jls-14.html#jls-14.20.3), 2026-09-19 확인. 역순 close, 예외 우선순위, 기존 자원 변수 캡처의 규범 근거입니다.
- [Java SE 21 `Throwable` API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Throwable.html), suppression 활성화와 self-suppression API 경계를 확인하는 보조 자료입니다.
