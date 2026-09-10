---
id: java-threadlocal-pool
title: "요청별 사용자 정보를 ThreadLocal에 넣은 뒤 스레드 풀에서 다음 요청이 잘못된 사용자를 봅니다. 재사용 스레드와 remove의 관계는 무엇인가요?"
difficulty: 중하
category: 언어·런타임
tags: ["Java","ThreadLocal","스레드 풀","remove","요청 격리"]
related: ["java-synchronized-volatile"]
---

# 요청별 사용자 정보를 ThreadLocal에 넣은 뒤 스레드 풀에서 다음 요청이 잘못된 사용자를 봅니다. 재사용 스레드와 remove의 관계는 무엇인가요?

## 구두 답변

`ThreadLocal`은 하나의 변수를 스레드마다 독립된 값으로 보관하게 합니다. 같은 `ThreadLocal` 객체를 여러 작업이 사용해도 `get`과 `set`은 현재 실행 스레드의 값을 대상으로 하며, 값을 자동으로 복제해 주는 기능은 아닙니다. 이 성질은 요청 컨텍스트처럼 스레드 사이에 공유하지 않을 상태에 유용하지만, 스레드 풀에서는 작업이 끝나도 스레드 자체가 종료되지 않는다는 점이 핵심 위험입니다.

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

`set(null)`은 값을 null로 설정하는 것이지 `remove()`와 동일한 의미가 아닙니다. 이후 `get()`에서 초기화 동작을 다시 기대한다면 remove를 사용해야 합니다. 비동기 작업이 다른 스레드로 넘어가는 구조에서는 ThreadLocal이 자동 전파되지 않으므로 명시적인 컨텍스트 전달이나 프레임워크의 검증된 전파 기능을 선택하겠습니다. 요청 종료 훅만 믿지 말고 작업 단위의 `try/finally`를 기본 계약으로 두는 것이 안전합니다.

## 득점 포인트

- ThreadLocal 값이 스레드별로 분리되지만 스레드 풀의 워커와 함께 살아남을 수 있음을 설명한다.
- set 이후 finally에서 현재 작업 스레드가 remove해야 요청 오염을 막는다는 실행 순서를 제시한다.
- set(null)과 remove, 자동 컨텍스트 전파의 부재를 구분한다.

## 감점 포인트

- ThreadLocal을 쓰면 요청마다 값이 자동 복제되고 작업 종료 시 자동 삭제된다고 말한다.
- 다른 스레드가 remove를 호출하면 원래 워커의 값을 지울 수 있다고 가정한다.
- 스레드 풀이 워커를 재사용한다는 사실을 무시하고 메모리 유지·권한 오염 가능성을 놓친다.

## 더 파고들 거리

- ThreadLocalMap의 키·값 참조 특성이 장수 스레드의 메모리 유지에 어떤 영향을 주나요?
- 비동기 콜백과 가상 스레드에서 요청 컨텍스트를 전달하는 선택지는 어떻게 달라지나요?
- ThreadLocal 대신 메서드 인자로 컨텍스트를 전달할 때 테스트성과 안전성이 어떻게 달라지나요?
