---
id: java-equals-hashcode
title: "객체의 필드를 바꾼 뒤 HashSet에서 그 객체를 찾지 못합니다. equals와 hashCode의 계약과 가변 키의 문제를 설명해 보세요."
answerMinutes: 5
followups: [{"id":"java-final-immutability","prompt":"키를 불변 객체로 만들기 위해 final 필드와 방어적 복사 중 무엇을 함께 적용해야 할까요?"},{"id":"java-boxing-null","prompt":"equals 구현에서 null 필드를 비교할 때 직접 호출 대신 어떤 null 안전 비교를 사용할까요?"},{"id":"java-generics-erasure","prompt":"제네릭 키의 타입 소거와 해시 컬렉션의 런타임 동등성 검사가 어떤 층에서 일어나나요?"}]
difficulty: 중하
category: 언어·런타임
tags: ["Java","equals","hashCode","HashSet","가변 키"]
related: ["java-boxing-null"]
---

# 객체의 필드를 바꾼 뒤 HashSet에서 그 객체를 찾지 못합니다. equals와 hashCode의 계약과 가변 키의 문제를 설명해 보세요.

## 구두 답변

`equals`는 두 참조가 같은 객체인지 또는 클래스가 정의한 의미상 같은 값인지 판단하는 메서드이고, `Object`의 기본 구현은 참조 동일성만 비교합니다. 내용 기반 동등성을 정의한다면 반사성·대칭성·추이성·일관성을 지키고 null이 아닌 객체가 `null`과 같다고 하지 않아야 합니다. `hashCode`는 별도의 식별자가 아니라 해시 컬렉션이 후보 위치를 빠르게 찾기 위한 값입니다. `a.equals(b)`가 true이면 두 객체의 해시는 반드시 같아야 하지만, 해시가 같다고 equals가 true일 필요는 없습니다.

### 버킷 위치와 동등성

아래는 설명용 코드 조각입니다. 타입·메서드 선언과 실행문을 나누어 배치하고, 실행문은 `main` 등 메서드 안에서 실행합니다.

```java
final class Key {
    String value;
    Key(String value) { this.value = value; }
    @Override public boolean equals(Object o) {
        return o instanceof Key k && java.util.Objects.equals(value, k.value);
    }
    @Override public int hashCode() { return java.util.Objects.hashCode(value); }
}

Key key = new Key("a");
java.util.Set<Key> set = new java.util.HashSet<>();
set.add(key);
key.value = "b";
System.out.println(set.contains(key)); // 일반적인 OpenJDK HashSet에서는 false
System.out.println(set.remove(key));   // 같은 구현에서 false
System.out.println(set.size());         // 1
```

처음 삽입할 때 `a`의 해시로 버킷을 정했는데, 변경 뒤 조회는 `b`의 해시 버킷을 찾아가기 때문에 같은 객체가 내부에 있어도 발견하지 못할 수 있습니다. 핵심은 특정 실패 출력이 모든 Set 구현의 명세라는 뜻이 아니라, 원소의 동등성에 영향을 주는 상태를 저장 중 바꾸면 Set 동작을 신뢰할 수 없다는 점입니다. `HashMap`의 키도 같은 원칙을 따릅니다.

### 키 불변성과 동시 변경

실무에서는 키를 불변으로 만들거나, 키에 쓰이는 필드를 변경할 일이 있으면 먼저 컬렉션에서 제거한 뒤 변경하고 다시 삽입하겠습니다. `equals`를 재정의할 때는 같은 기준으로 `hashCode`를 함께 재정의하고, 상속 관계에서 대칭성과 추이성이 깨지지 않는지도 확인해야 합니다. 단순히 해시 충돌을 없애려 하기보다 동등성 기준과 키 수명을 먼저 고정하는 것이 올바른 수정입니다.

### 선택 기준과 검증

값 필드가 키에 참여하는지와 표시용 필드인지 구분하면 가변 키 범위를 줄일 수 있습니다. 동시 갱신이 있다면 제거·변경·재삽입 사이에 조회가 끼지 않도록 컬렉션과 키 변경을 같은 보호 경계에 두겠습니다. 해시 충돌은 성능 문제일 수 있지만, 변경된 해시로 원래 버킷을 찾지 못하는 가변 키 문제를 해결하지는 않습니다.

equals가 성립하는 두 객체는 같은 hashCode를 가져야 하지만, 서로 다르다고 반드시 해시도 달라야 하는 것은 아닙니다. 충돌은 정상 가능성이므로 컬렉션은 후보를 찾은 뒤 equals를 검사합니다. 반대로 모든 객체가 같은 해시를 반환해도 계약상 동등성 방향은 지킬 수 있지만 탐색 비용이 악화될 수 있습니다. 정확성과 해시 분포의 성능을 분리하는 이유입니다.

상속에서는 부모가 좌표만 비교하고 자식은 색상까지 비교하면 대칭성이나 추이성이 깨질 수 있습니다. 동등성 기준이 달라지는 타입을 상속으로 묶을지, 조합과 별도 값 객체로 나눌지 먼저 결정하겠습니다. record도 구성 요소가 가변 배열이나 리스트이면 자동 생성된 메서드가 깊은 불변성을 보장하지 않습니다. 같은 값·다른 값·null·상속 조합과 저장 중 변경을 테스트해 동등성 계약을 확인하겠습니다.

## 득점 포인트

- equals와 hashCode의 방향성 계약을 정확히 말한다.
- 해시 버킷 탐색과 가변 키 실패를 인과로 설명한다.
- 불변 키 또는 제거·변경·재삽입으로 복구한다.

## 감점 포인트

- hashCode가 같으면 equals도 true이거나 같은 객체라고 말한다.
- equals만 재정의해도 hashCode가 자동으로 내용 기반이 된다고 가정한다.
- contains 실패를 객체가 Set에서 자동 삭제된 결과로 설명한다.

## 더 파고들 거리

- 상속 기반 equals에서 대칭성과 추이성이 깨지는 예를 어떻게 피할까요?
- HashMap에서 값 변경과 키 변경의 조회 결과는 왜 다를까요?
- 레코드와 방어적 복사가 키의 안정성을 어떻게 높이나요?
