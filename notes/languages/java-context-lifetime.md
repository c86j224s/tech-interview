---
id: java-context-lifetime
title: ThreadLocal의 요청 격리와 비동기 문맥 전달
topic: 언어·런타임
summary: 스레드 슬롯·요청 수명을 나누고 finally remove·중첩 복원·약한 키와 강한 값·executor 전파·명시 인자의 장단점을 설명합니다.
questionIds: [java-threadlocal-pool, threadlocal-weak-key-value-retention, threadlocal-versus-explicit-context]
---

# ThreadLocal의 요청 격리와 비동기 문맥 전달

## 요청이 끝나도 풀 Worker의 슬롯은 남습니다

한 worker에서 사용자 A 요청을 처리하며 ThreadLocal에 A를 넣었습니다. 작업이 반환해도 worker는 풀에서 재사용됩니다. 다음 B 요청이 값을 설정하지 않은 경로로 들어오면 A를 읽을 수 있습니다. ThreadLocal은 스레드별 값이지 요청별 자동 격리·삭제 기능이 아닙니다.

큰 객체를 넣으면 메모리 보유 문제가 되고 사용자·테넌트·권한이면 잘못된 인가로 이어질 수 있습니다. 값을 설정한 worker의 finally에서 정리해야 합니다. 다른 스레드가 remove해도 원래 worker 슬롯이 지워지지 않습니다.

## Set과 정리를 같은 실행 범위로 묶습니다

```java
static final ThreadLocal<String> USER = new ThreadLocal<>();

static void handle(String userId) {
    USER.set(userId);
    try {
        processRequest();
    } finally {
        USER.remove();
    }
}
```

위는 클래스 안의 설명용 코드이며 processRequest는 실제 처리 함수입니다. 정상 반환·예외·조기 반환 모두 finally를 통과하게 합니다. set(null)은 null을 값으로 넣는 것이고 remove는 현재 슬롯 항목을 제거하는 것이므로 이후 get의 initialValue 실행 등 의미가 다릅니다.

| 상황 | 필요한 정책 | 흔한 오해 |
| --- | --- | --- |
| 최상위 요청 | 설정 후 finally remove | 요청 반환이 자동 삭제 |
| 중첩 문맥 | 이전 값 저장·복원 | 하위 remove가 상위값 보존 |
| executor 전환 | 명시적 capture·install·restore | ThreadLocal 자동 이동 |
| worker 종료 | 스레드 수명 정리 | 장수 풀도 곧 종료됨 |

중첩 호출이 같은 ThreadLocal을 덮은 뒤 remove하면 상위 문맥도 사라집니다. 중첩을 지원하는 API는 검증된 scope 객체로 이전 문맥을 복원하거나 명시적 인자로 전달합니다. 없는 상태와 명시적 null을 구분해야 하면 단순 get/set만으로 추측하지 않고 문맥 모델에 표현합니다.

## 약한 Key는 Value의 즉시 회수를 뜻하지 않습니다

일반적인 OpenJDK의 `ThreadLocalMap`에서 entry는 키를 약한 참조로 들고 value를 강한 참조로 보유할 수 있습니다. 키가 더 이상 다른 곳에서 참조되지 않아 GC가 키를 지워도, 장수 worker의 map에 stale entry가 남아 정리되기 전까지 value는 계속 남을 수 있습니다. 따라서 키가 수집됐다는 사실을 요청 자원이 곧 해제됐다는 계약으로 사용하지 말고, 값을 설정한 요청 범위에서 `remove()`를 실행해야 합니다.

```diagram
{"title":"장수 Worker가 옛 요청 값을 붙잡을 수 있습니다","caption":"화살표는 강한 보유 경로를 단순화한 그림입니다. 약한 키가 사라져도 value 경로가 즉시 없어지는 것은 아니므로 요청 범위에서 remove합니다.","rows":[[{"id":"thread","label":"살아 있는 pool worker"}],[{"id":"map","label":"ThreadLocalMap entry","detail":["키는 약한 참조"]}],[{"id":"value","label":"옛 요청 value","detail":["사용자·큰 데이터·앱 타입"]}]],"edges":[{"from":"thread","to":"map","label":"스레드 보유"},{"from":"map","to":"value","label":"남을 수 있는 강한 값"}]}
```

정적 키를 쓰더라도 요청 정리가 필요하고, 매 요청 새 키를 만드는 것으로 해결되지 않습니다. value가 재배포된 앱 타입이면 옛 클래스 로더까지 붙잡을 수 있습니다. 힙 덤프에서 실제 root→worker→entry→value 경로를 찾아야 합니다.

## 비동기 전달은 필요한 의미만 옮깁니다

`InheritableThreadLocal`은 새 자식 스레드를 만드는 순간 부모 값을 상속하는 규칙이며, 이미 만들어진 executor 풀의 worker에 매 요청마다 값을 옮기는 기능이 아닙니다. 다른 executor에 작업을 제출할 때는 필요한 불변 문맥을 명시적으로 캡처합니다. 실행 직전에 설치하고 `finally`에서 이전 값을 복원하는 검증된 전파 기능을 사용하거나, 함수 인자로 전달합니다.

로그 상관 ID를 전달하는 것과 인증된 주체·DB transaction 객체를 복사하는 것은 다른 문제입니다. 주체의 범위·만료·대상 인가가 유지되어야 하고 스레드 종속 거래를 임의로 공유하면 안 됩니다. ThreadLocal에 저장한 객체 참조가 여러 곳에서 공유되면 그 객체의 동시 수정은 여전히 보호해야 합니다.

가상 스레드는 각 스레드의 슬롯 비용을 없애지 않습니다. 요청당 큰 캐시를 ThreadLocal에 두면 많은 가상 스레드만큼 메모리가 늘 수 있습니다. 필요한 자원은 별도 명시적 풀·수명으로 관리합니다.

## 명시적인 인자는 테스트의 입력을 드러냅니다

context 인자를 전달하면 함수 의존성이 보이고 두 사용자 테스트를 독립 값으로 실행하기 쉽습니다. ThreadLocal은 깊은 호출 경로의 인자 전달을 줄이지만 설치·정리·비동기 hop이 숨은 전제가 됩니다. 둘을 모든 코드에서 일괄 치환하기보다 인증·거래 같은 핵심 입력은 명시하고 프레임워크 문맥은 좁은 경계에 둡니다.

단일 worker에서 A 성공·A 예외 뒤 B를 실행해 누출을 검사합니다. 중첩 B 문맥 뒤 A 복원, 다른 executor, 취소 후 늦은 callback도 시험합니다. Homebrew OpenJDK 21.0.12.1의 `scripts/VerifyJavaStudy.java`로 같은 단일 worker에서 첫 작업의 finally remove 뒤 다음 작업이 null을 읽는 사례를 확인했습니다. 중첩 scope·비동기 전파·weak key 보유 경로의 heap dump 검증은 실행하지 않았습니다.
