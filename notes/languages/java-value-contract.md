---
id: java-value-contract
title: Java 래퍼 숫자·Unboxing·부재 표현
topic: 언어·런타임
summary: 참조 비교와 숫자 승격을 구분하고 null·Integer 캐시·다른 래퍼 equals·Optional 지연 기본값과 외부 부재 의미를 설명합니다.
questionIds: [java-boxing-null, java-unboxing-promotion-order, java-absence-optional-default]
---

# Java 래퍼 숫자·Unboxing·부재 표현

## 같은 127이 같은 참조라고 모든 숫자를 ==로 비교할 수는 없습니다

int를 Integer로 바꾸는 boxing과 Integer에서 int를 꺼내는 unboxing은 컴파일러가 자동으로 넣을 수 있습니다. 하지만 두 Integer를 ==로 비교하면 기본적으로 참조 동일성을 비교합니다. 일부 상수 표현식 값의 boxing은 언어 명세가 참조 공유를 보장하므로 작은 수에서 값 비교처럼 보입니다. 더 큰 값의 공유는 구현이 확장할 수 있어 “128 이상이면 반드시 다른 참조”라고도 단정하지 않습니다.

```java
Integer a = 127;
Integer b = 127;
System.out.println(a == b); // 이 상수 표현식에서는 true
Integer n = null;
System.out.println(n == null); // true
// n == 0 은 unboxing 중 NullPointerException
```

실행문은 main 같은 메서드 안에 놓습니다. `n == null`은 참조 비교이고 `n == 0`은 숫자 비교를 위해 n의 기본형 값을 필요로 합니다. null을 자동으로 0으로 바꾸지 않습니다.

## 산술식의 첫 변환에서 실패할 수 있습니다

`Integer left = null; Long right = 2L; left + right`를 보면 결과 타입을 long으로 정하기 전에 피연산자의 숫자 값을 꺼내야 합니다. left의 unboxing에서 예외가 나므로 실제 덧셈은 수행되지 않습니다. 래퍼를 혼합한 조건 연산자에서도 타입 규칙에 따라 예상하지 못한 unboxing이 생길 수 있습니다.

| 식 | 비교·계산의 의미 | 주의점 |
| --- | --- | --- |
| Integer == Integer | 참조 동일성 | 숫자 값 비교가 아님 |
| Integer == int | unboxing 후 숫자 비교 | null 실패 |
| Objects.equals(a,b) | null-safe 객체 equals | 다른 래퍼 타입의 수학적 비교 아님 |
| Integer(1).equals(Long(1)) | 서로 다른 래퍼 타입 | false |
| map.get(key) + 1 | 부재값 unboxing 가능 | 먼저 누락 정책 필요 |

표의 Integer(1)·Long(1)은 값 개념을 뜻하며 실제 코드는 valueOf 등을 사용합니다. Objects.equals는 null 안전성만 제공하므로 범위·형식·숫자 타입 통일은 따로 해야 합니다. boxing을 반복하는 합산 코드는 객체 할당·참조 교체 비용을 만들 수 있어 원시형이 적합한지 실제 할당 프로파일로 확인합니다.

## 0·없음·조회 실패는 서로 다른 결과입니다

재고가 0인 것과 재고 정보가 없는 것, DB 조회가 실패한 것은 같지 않습니다. 모든 부재를 기본 0으로 바꾸면 품절·미등록·장애가 섞입니다. 외부 입력에서 null을 허용하는지, 생략이 기존값 유지인지, 0이 실제 값인지 먼저 정합니다.

```diagram
{"title":"숫자 계산 전에 부재와 실패를 구분합니다","caption":"화살표는 입력 해석 순서입니다. null-safe 비교는 부재 의미를 정하지 않으므로 유효한 값일 때만 기본형 계산으로 넘깁니다.","rows":[[{"id":"input","label":"DB·API의 숫자 결과"}],[{"id":"meaning","label":"값·정상 부재·조회 실패 분리"}],[{"id":"validate","label":"숫자 타입·범위 확정"}],[{"id":"calc","label":"기본형 또는 도메인 계산"}]],"edges":[{"from":"input","to":"meaning","label":"계약 해석"},{"from":"meaning","to":"validate","label":"값이 있는 경우"},{"from":"validate","to":"calc","label":"unboxing 전 조건 충족"}]}
```

nullable Integer는 호출자가 null 분기를 처리해야 하는 계약입니다. Optional<Integer> 또는 OptionalInt 같은 반환형은 부재 분기를 API에 드러낼 수 있지만 필드·직렬화·컬렉션에서 항상 최선은 아닙니다. 프레임워크 지원과 비용·사용 위치를 봅니다. 정상 부재만 Optional.empty로 표현하고 오류를 자동으로 empty에 숨기지 않습니다.

## 기본값 함수의 실행 시점도 다릅니다

`optional.orElse(expensiveDefault())`는 optional에 값이 있어도 메서드 인자 평가로 expensiveDefault가 실행됩니다. `orElseGet(() -> expensiveDefault())`는 값이 없을 때 supplier를 실행합니다. 기본값 함수가 외부 조회·로그·자격 발급을 하면 단순 성능 문제가 아니라 불필요한 부수 효과가 됩니다.

값이 없으면 거절해야 하는 API는 임의 기본값을 만들기보다 명확한 도메인 오류로 처리할 수 있습니다. DB NULL·JSON null·필드 생략·기본값의 왕복 의미도 테스트합니다. 모든 숫자가 int 범위에 들어가는지와 overflow·반올림 문제는 boxing과 별도입니다.

## 컴파일 타입과 실행 오류를 각각 확인합니다

래퍼-래퍼·래퍼-기본형·null·서로 다른 래퍼·조건식·overload의 작은 예를 만들어 컴파일 타입과 결과를 대조합니다. Optional에 값이 있을 때와 없을 때 기본값 함수 호출 횟수를 검사합니다. 기본 PATH의 javac는 JDK를 찾지 못했지만, 이후 Homebrew OpenJDK 21.0.12.1을 찾아 `scripts/VerifyJavaStudy.java`로 상수 boxing·null unboxing·다른 래퍼 equals·지연 기본값 예제를 확인했습니다. 모든 overload·조건식·외부 DB 부재 변환까지 실행한 것은 아닙니다.
