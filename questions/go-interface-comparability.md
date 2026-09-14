---
id: "go-interface-comparability"
title: "Go interface 두 값을 ==로 비교했더니 일부 입력에서 panic이 납니다. 어떤 동적 타입이 비교 가능한가요?"
answerMinutes: 5
followups: [{"id": "go-interface-typed-nil", "prompt": "nil 포인터를 interface에 넣었을 때 동적 타입과 값 때문에 비교가 어떻게 달라지나요?"}, {"id": "hash-collision-resolution", "prompt": "해시 후보 위치와 실제 키 동일성, 삭제·재검색의 계약을 어떻게 유지하나요?"}, {"id": "java-equals-hashcode", "prompt": "키 객체의 상태가 바뀌면 해시 위치와 동등 비교가 어긋나는 이유는 무엇인가요?"}]
difficulty: "중하"
category: "언어·런타임"
tags: ["Go", "언어·런타임"]
related: ["go-interface-typed-nil", "hash-collision-resolution", "java-equals-hashcode"]
---

# Go interface 두 값을 ==로 비교했더니 일부 입력에서 panic이 납니다. 어떤 동적 타입이 비교 가능한가요?

## 구두 답변

interface 비교는 동적 타입과 값의 비교 가능성에 영향을 받습니다. slice·map·function처럼 일반적으로 직접 비교할 수 없는 동적 값을 담은 interface를 같은 타입끼리 비교하면 panic이 발생할 수 있습니다.

### 동작 원리와 전제

interface에 int나 비교 가능한 struct가 담긴 경우와 slice가 담긴 경우를 구분합니다. struct도 필드에 slice가 있으면 비교 가능하지 않습니다. nil 비교와 두 interface 값의 동등 비교는 같은 문제가 아니며 typed nil의 차이도 남습니다.

### 선택과 실패 처리

map 키에 interface를 쓰면 비교 불가능한 동적 값을 넣는 경로를 제한해야 합니다. 도메인상 안정적인 ID나 명시적인 비교 함수를 사용하고 DeepEqual을 무조건 업무 동등성으로 쓰지 않습니다. nil slice와 빈 slice의 의미 같은 정책을 정합니다.

### 구체적인 사례와 검증

예를 들어 any 안에 []int{1}을 넣은 두 값을 ==로 비교하는 것은 int가 들어 있는 경우와 다르게 실패할 수 있습니다. API가 any를 받는다면 허용 동적 타입을 좁히거나 비교 의미를 명시한 함수를 제공합니다. 동등 비교가 필요한 키는 문자열 ID처럼 안정적인 값으로 정규화할 수 있지만 서로 다른 값을 같은 키로 합치지 않게 규칙을 검증합니다. reflect 기반 비교는 편리해도 성능과 nil·빈 컬렉션·포인터의 의미를 업무 규칙에 맞춰야 합니다. interface의 타입 추상화가 그 안의 모든 값에 동일한 연산을 가능하게 만드는 것은 아니라는 점을 테스트와 문서에 남깁니다.

동적 타입별 입력·nil·중첩 struct·키 삽입을 시험합니다. 컴파일된 interface API가 모든 런타임 값에 안전한 연산을 보장하는 것은 아닙니다. 타입 추상화와 그 값이 지원하는 연산 계약을 함께 설명하겠습니다.

## 득점 포인트

- 핵심 구분: interface 비교는 동적 타입과 값의 비교 가능성에 영향을 받습니다.
- 선택 조건: map 키에 interface를 쓰면 비교 불가능한 동적 값을 넣는 경로를 제한해야 합니다.
- 검증 기준: 동적 타입별 입력·nil·중첩 struct·키 삽입을 시험합니다.

## 감점 포인트

- interface 타입으로 감싸면 모든 동적 값에 ==와 map 키 사용이 가능하다고 한다.

## 더 파고들 거리

- nil 포인터를 interface에 넣었을 때 동적 타입과 값 때문에 비교가 어떻게 달라지나요?
- 해시 후보 위치와 실제 키 동일성, 삭제·재검색의 계약을 어떻게 유지하나요?
- 키 객체의 상태가 바뀌면 해시 위치와 동등 비교가 어긋나는 이유는 무엇인가요?
