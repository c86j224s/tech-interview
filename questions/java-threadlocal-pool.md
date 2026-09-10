---
id: java-threadlocal-pool
title: "요청별 사용자 정보를 ThreadLocal에 넣은 뒤 스레드 풀에서 다음 요청이 잘못된 사용자를 봅니다. 재사용 스레드와 remove의 관계는 무엇인가요?"
answerMinutes: 5
followups: [{"id":"java-synchronized-volatile","prompt":"ThreadLocal 값 자체는 분리돼도 값이 가리키는 가변 객체를 여러 작업이 공유하면 무엇을 보호해야 할까요?"},{"id":"structured-concurrency-fanout","prompt":"하위 작업이 다른 풀로 넘어갈 때 요청 컨텍스트를 ThreadLocal 대신 어떤 수명 계약으로 전달할까요?"},{"id":"goroutine-lifecycle-and-leaks","prompt":"정리되지 않은 요청 컨텍스트가 장수 워커에 남는지 어떤 메모리·작업 지표로 확인할까요?"}]
difficulty: 중하
category: 언어·런타임
tags: ["Java","ThreadLocal","스레드 풀","remove","요청 격리"]
related: ["java-synchronized-volatile"]
---

# 요청별 사용자 정보를 ThreadLocal에 넣은 뒤 스레드 풀에서 다음 요청이 잘못된 사용자를 봅니다. 재사용 스레드와 remove의 관계는 무엇인가요?

## 구두 답변

`ThreadLocal`은 하나의 변수를 스레드마다 독립된 값으로 보관하게 합니다. 같은 `ThreadLocal` 객체를 여러 작업이 사용해도 `get`과 `set`은 현재 실행 스레드의 값을 대상으로 하며, 값을 자동으로 복제해 주는 기능은 아닙니다. 이 성질은 요청 컨텍스트처럼 스레드 사이에 공유하지 않을 상태에 유용하지만, 스레드 풀에서는 작업이 끝나도 스레드 자체가 종료되지 않는다는 점이 핵심 위험입니다.

### 스레드 슬롯의 요청 오염

아래는 설명용 코드 조각입니다. 타입·메서드 선언과 실행문을 나누어 배치하고, 실행문은 `main` 등 메서드 안에서 실행합니다. 예제 실행 메서드는 대기 중 발생할 수 있는 예외를 처리하거나 `throws Exception`으로 선언해야 합니다.

```java
static final ThreadLocal<String> USER = new ThreadLocal<>();

static void handle(String userId) {
    USER.set(userId);
    try {
        // USER.get()으로 현재 요청의 사용자 사용
    } finally {
        USER.remove();
    }
}

java.util.concurrent.ExecutorService pool =
    java.util.concurrent.Executors.newSingleThreadExecutor();
try {
    pool.submit(() -> handle("user-A")).get();
    pool.submit(() -> System.out.println(USER.get())).get();
} finally {
    pool.shutdown();
}
// 두 번째 작업의 출력: null
```

`remove()`를 빼면 첫 작업이 끝난 뒤에도 풀의 같은 워커 스레드에 `user-A`가 남아 두 번째 작업이 그 값을 읽을 수 있습니다. 값이 사용자 ID나 권한, 트랜잭션처럼 요청에 종속된 상태라면 다른 사용자의 정보 노출이나 잘못된 권한 적용으로 이어집니다. 큰 객체를 넣었다면 풀 스레드가 살아 있는 동안 그 객체가 계속 붙잡혀 메모리 압력도 만들 수 있습니다. `set` 뒤의 정상 경로뿐 아니라 예외 경로에서도 정리되도록 반드시 해당 값을 설정한 작업 스레드의 `finally`에서 제거해야 합니다. 다른 스레드에서 `remove()`를 호출해 대신 정리할 수는 없습니다.

### 정리와 비동기 전파

`set(null)`은 값을 null로 설정하는 것이지 `remove()`와 동일한 의미가 아닙니다. 이후 `get()`에서 초기화 동작을 다시 기대한다면 remove를 사용해야 합니다. 비동기 작업이 다른 스레드로 넘어가는 구조에서는 ThreadLocal이 자동 전파되지 않으므로 명시적인 컨텍스트 전달이나 프레임워크의 검증된 전파 기능을 선택하겠습니다. 요청 종료 훅만 믿지 말고 작업 단위의 `try/finally`를 기본 계약으로 두는 것이 안전합니다.

### 선택 기준과 검증

요청 ID만이 아니라 locale, 보안 주체, trace context도 누출될 수 있습니다. `ThreadLocalMap`의 키가 약한 참조로 사라져도 값이 장수 워커에 남는 경로가 있으므로, 매번 새 키를 만들기보다 정적 키와 `finally` 정리를 사용하겠습니다. 다른 풀로 넘기는 작업에는 ThreadLocal을 기대하지 말고 명시적인 컨텍스트 객체를 전달하겠습니다.

중첩 호출도 주의하겠습니다. 상위 작업이 값을 설정한 상태에서 하위 작업이 같은 ThreadLocal을 덮어쓰고 remove하면 상위 작업의 값까지 사라집니다. 중첩 컨텍스트를 지원할 API라면 이전 값을 저장했다 복원하는 범위 객체를 사용하거나 명시적 인자로 전달해야 합니다. 요청 끝에서 한 번 비운다는 규칙과 중첩 실행의 복원 규칙은 다릅니다.

InheritableThreadLocal은 새 자식 스레드 생성 때 값을 이어받는 기능이지 이미 만들어진 풀 워커의 매 요청에 자동 전파하는 기능이 아닙니다. 가상 스레드도 ThreadLocal을 지원할 수 있지만 요청당 대형 캐시를 두면 스레드 수만큼 비용이 커질 수 있습니다. 비동기 콜백을 제출할 때 불변 컨텍스트를 캡처하고 실행 범위에서 설치·복원하는 검증된 전파 방식을 쓰되, 권한·트랜잭션 객체를 무작정 다른 실행 흐름에 복사하지 않겠습니다.

## 득점 포인트

- 스레드별 슬롯과 요청별 수명을 구분한다.
- finally의 remove를 예외·풀 재사용 경로에 적용한다.
- 전파와 ThreadLocalMap 메모리 유지 한계를 설명한다.

## 감점 포인트

- 작업이 끝나면 ThreadLocal 값이 자동 삭제된다고 말한다.
- 다른 스레드의 remove가 원래 워커 값을 지운다고 가정한다.
- ThreadLocal이 비동기 작업과 다른 풀로 자동 전파된다고 설명한다.

## 더 파고들 거리

- ThreadLocalMap의 약한 키와 남은 값이 장수 워커에 미치는 영향은 무엇인가요?
- 가상 스레드에서 ThreadLocal 비용이 달라져도 정리 계약이 필요한 이유는 무엇인가요?
- 메서드 인자 전달과 ThreadLocal의 테스트 격리성을 어떻게 비교할까요?
