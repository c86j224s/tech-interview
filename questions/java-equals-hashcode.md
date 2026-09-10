---
id: java-equals-hashcode
title: "객체의 필드를 바꾼 뒤 HashSet에서 그 객체를 찾지 못합니다. equals와 hashCode의 계약과 가변 키의 문제를 설명해 보세요."
difficulty: 중하
category: 언어·런타임
tags: ["Java","equals","hashCode","HashSet","가변 키"]
related: ["java-boxing-null"]
---

# 객체의 필드를 바꾼 뒤 HashSet에서 그 객체를 찾지 못합니다. equals와 hashCode의 계약과 가변 키의 문제를 설명해 보세요.

## 구두 답변

`equals`는 두 참조가 같은 객체인지 또는 클래스가 정의한 의미상 같은 값인지 판단하는 메서드이고, `Object`의 기본 구현은 참조 동일성만 비교합니다. 내용 기반 동등성을 정의한다면 반사성·대칭성·추이성·일관성을 지키고 null이 아닌 객체가 `null`과 같다고 하지 않아야 합니다. `hashCode`는 별도의 식별자가 아니라 해시 컬렉션이 후보 위치를 빠르게 찾기 위한 값입니다. `a.equals(b)`가 true이면 두 객체의 해시는 반드시 같아야 하지만, 해시가 같다고 equals가 true일 필요는 없습니다.

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

실무에서는 키를 불변으로 만들거나, 키에 쓰이는 필드를 변경할 일이 있으면 먼저 컬렉션에서 제거한 뒤 변경하고 다시 삽입하겠습니다. `equals`를 재정의할 때는 같은 기준으로 `hashCode`를 함께 재정의하고, 상속 관계에서 대칭성과 추이성이 깨지지 않는지도 확인해야 합니다. 단순히 해시 충돌을 없애려 하기보다 동등성 기준과 키 수명을 먼저 고정하는 것이 올바른 수정입니다.

## 득점 포인트

- equals의 동치 관계와 equals가 true일 때 같은 hashCode여야 한다는 방향을 정확히 구분한다.
- 해시 컬렉션이 삽입·조회 시 해시를 위치 결정에 사용한다는 인과를 연결한다.
- 가변 키를 불변화하거나 제거-변경-재삽입하는 구체적인 대응을 제시한다.

## 감점 포인트

- hashCode가 같으면 두 객체가 반드시 같은 객체이거나 equals가 true라고 말한다.
- equals만 재정의하고 hashCode는 자동으로 내용에 맞게 바뀐다고 가정한다.
- contains가 false이므로 객체가 컬렉션에서 자동으로 삭제됐다고 설명한다.

## 더 파고들 거리

- 상속 기반 equals에서 대칭성과 추이성이 깨지는 대표적인 상황은 무엇인가요?
- HashMap의 값 변경과 키 변경이 각각 조회에 어떤 차이를 만드는지 비교해 보세요.
- 불변 레코드나 방어적 복사가 키 설계에 어떤 이점을 주나요?
