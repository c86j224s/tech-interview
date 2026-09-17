---
id: rest-reactive-foundations
title: REST와 반응형 처리의 기초
topic: 언어·런타임
summary: REST의 자원·표현·무상태 제약과 반응형 스트림의 수요·취소·완료 경계를 주문 진행 API에 적용합니다.
questionIds: []
prerequisites: [software-design-foundations, client-foundations]
related: [api-meaning, http-method-retry, http-cache, http-preconditions, async-execution]
reviewedAt: '2026-09-17'
---

# REST와 반응형 처리의 기초

## 자원과 표현

REST는 특정 Java 프레임워크나 HTTP endpoint 작성법이 아니라, 웹 자원을 연결하는 아키텍처 스타일입니다. 자원은 주문·상품·작업처럼 식별할 수 있는 대상이고, 표현은 그 자원의 상태를 전송 가능한 데이터와 메타데이터로 나타낸 것입니다. 같은 주문도 JSON, HTML, 요약 화면이라는 서로 다른 표현을 가질 수 있습니다.

HTTP는 자원의 내부 구현을 알아야 하는 대신 요청의 의미, 표현, 메타데이터와 응답 상태를 교환하는 공통 인터페이스를 제공합니다. RFC 9110은 HTTP 의미가 HTTP/1.1·HTTP/2·HTTP/3에 공통으로 적용되는 층을 설명합니다. 그렇다고 JSON을 주고받는 모든 endpoint가 REST의 모든 제약을 만족하는 것은 아닙니다. 자원 식별, 표현에 의한 조작, 무상태 요청, 캐시와 균일한 인터페이스를 어디까지 채택했는지 구분해야 합니다.

반응형 처리는 이 글에서 결과를 나중에 하나씩 전달하는 스트림과, 소비자가 감당할 수 있는 양을 생산자에게 알리는 흐름을 뜻합니다. 화면 진행률이나 로그처럼 여러 값이 도착하는 문제에서는 HTTP의 자원 계약과 스트림의 실행 수명 계약이 함께 필요합니다. “비동기”라는 이름만으로 느린 소비자, 취소, 과거 이벤트 복구가 해결되지는 않습니다.

## 메서드와 안전성

`GET /orders/42`는 주문 자원의 표현을 조회한다는 의미를 전달합니다. `PUT /orders/42`는 대상 자원에 원하는 표현을 적용하는 의미를, `POST /orders`는 컬렉션이나 대상이 본문을 처리하게 하는 의미를 가질 수 있습니다. URI가 `/delete`처럼 생겼다는 이유로 GET이 상태를 바꾸게 만들면 링크 미리 가져오기, 크롤러, 새로고침이 변경을 일으킬 수 있습니다.

안전성은 클라이언트가 요청한 의미가 상태 변경을 요구하지 않는 성질입니다. 서버 로그 증가 같은 관찰적 부수 효과가 없다는 뜻은 아니지만, 보상 지급을 GET의 처리에 넣는 것은 안전한 메서드의 목적과 어긋납니다. 멱등성은 같은 의도된 요청을 반복했을 때 의도한 최종 효과가 한 번 수행한 것과 같은 성질입니다. 안전성과 멱등성은 같은 축이 아닙니다.

| 요청 | 자원 의미 | 반복·실패 경계 |
| --- | --- | --- |
| `GET /orders/42` | 주문 표현 조회 | 캐시·인가·표현 선택 |
| `POST /orders` | 새 주문 처리 | 요청 키·불확정 결과 |
| `PUT /orders/42` | 대상 표현 대체 | 전체 표현·조건부 버전 |
| `DELETE /orders/42` | 삭제 의도 | 실제 효과와 반복 결과 |

응답 상태 코드도 실행 결과의 단일 증거가 아닙니다. 게이트웨이가 504를 반환해도 원본 서버가 이미 커밋했을 수 있습니다. 응답을 받지 못했다는 사실은 요청 효과가 없었다는 증명이 아니므로, 외부 변경에는 요청 식별자·결과 조회·멱등 키·불확정 상태를 함께 설계합니다.

## REST 제약과 비용

Fielding의 2000년 박사학위 논문 5장은 REST의 클라이언트-서버 분리, 무상태 통신, 캐시, 균일한 인터페이스, 계층화와 선택적인 코드 다운로드를 제약으로 설명합니다. 각 제약에는 목적과 비용이 있습니다. 클라이언트와 서버를 분리하면 독립 배포와 대체가 쉬워지지만 표현 변환이 늘 수 있습니다. 무상태 요청은 서버 확장에 유리하지만 인증과 문맥을 반복 전달하는 비용이 생깁니다.

캐시는 통신과 지연, 원본 부하를 줄일 수 있지만 낡은 표현과 사용자 간 데이터 혼합을 막는 계약이 필요합니다. `Cache-Control`은 저장·재사용 정책을, `ETag`는 표현 검증자를, `Vary`는 요청 헤더에 따른 표현 선택을 나타냅니다. 개인 응답에는 공유 재사용 가능성을 신중히 제한하고, 계정 전환 시 브라우저와 중간 캐시의 범위를 함께 검토합니다.

무상태는 TCP 연결을 매번 끊고 매 요청마다 완전히 새 인증을 하라는 뜻이 아닙니다. 각 요청의 의미를 이전 요청의 서버 세션 기록에 의존하지 않도록 필요한 문맥을 요청에 포함하거나 별도 자원으로 식별하는 것입니다. 연결 재사용은 전송 계층의 문제이고 요청 의미의 독립성은 애플리케이션 계약의 문제입니다.

균일한 인터페이스는 자원 식별, 표현에 의한 조작, 자기 설명적 메시지, 하이퍼미디어를 통해 다음 상태로 이동하는 규칙을 통일합니다. 일관성은 클라이언트·프록시·관측 도구의 이해를 높이지만, 특정 업무에 최적화한 짧은 호출보다 표현과 링크가 커질 수 있습니다. 실제 시스템에서는 적용한 제약과 의도적으로 완화한 제약을 기록합니다.

## 주문 상태와 불확정 결과

주문 생성 요청이 timeout되었다고 하겠습니다. 클라이언트는 첫 `POST /orders`에 `Idempotency-Key: user-42:checkout-981`을 붙입니다. 서버가 결제와 주문 저장 사이에서 응답을 잃으면 클라이언트는 새 키를 만들어 재전송하지 않고, 같은 논리 요청의 결과를 조회하거나 같은 키로 재시도합니다.

서버는 키와 요청 본문의 지문을 저장하고, 같은 키에 다른 본문이 오면 거절합니다. 키 기록과 주문 효과를 같은 거래 경계에 둘 수 있으면 함께 커밋합니다. 외부 결제가 끼어 한 거래로 묶을 수 없다면 `pending`, `confirmed`, `unknown` 같은 상태를 내구화하고, 대사 작업이 `unknown`을 외부 결제 상태와 비교해 다음 전이를 결정하게 합니다.

숫자로 따라가면 처음 요청의 논리 키는 K이고 서버가 결제 승인 P를 기록한 뒤 응답 전송 전에 연결이 끊길 수 있습니다. 클라이언트가 K를 다시 보내면 서버는 새 주문이 아니라 K의 기존 결과를 찾아 P와 주문 상태를 반환합니다. K의 보관 기간이 끝난 뒤 재시도가 오면 이미 다른 논리 요청으로 해석될 수 있으므로, 만료 후 정책과 늦은 재시도의 응답을 정의해야 합니다.

```diagram
{"title":"주문 요청의 표현과 실제 효과","caption":"timeout은 서버 효과의 부재를 증명하지 않습니다. 같은 논리 키로 결과를 조회하고, 확인되지 않은 외부 효과는 별도 상태로 남깁니다.","rows":[[{"id":"post","label":"POST 주문 · 키 K"}],[{"id":"timeout","label":"응답 timeout","detail":["효과가 있었는지 불확정"]}],[{"id":"lookup","label":"K 결과 조회"}],[{"id":"confirmed","label":"확정 표현"},{"id":"unknown","label":"대사 필요 표현","detail":["외부 상태 확인"]}]],"edges":[{"from":"post","to":"timeout","label":"응답 유실"},{"from":"timeout","to":"lookup","label":"새 키 금지"},{"from":"lookup","to":"confirmed","label":"저장 결과 확인"},{"from":"lookup","to":"unknown","label":"외부 효과 미확인"}]}
```

POST의 기본 의미만으로 중복 방지가 생기는 것은 아닙니다. HTTP 메서드, 업무 요청 키, 원장 변경, 외부 결제 확인이 각각 책임지는 보장을 나눠야 합니다. 실패 응답의 본문과 상태 표현도 클라이언트가 새 요청인지 조회인지 결정할 충분한 정보를 가져야 합니다.

## 수요와 백프레셔

반응형 스트림에서 생산자는 항목을 만들고 소비자는 항목을 처리합니다. 소비자가 초당 20개를 처리하는데 생산자가 초당 100개를 계속 만들면, 단순한 고정 유입 모형에서는 초당 80개가 대기열에 남습니다. 10초 뒤에는 800개가 쌓입니다. 백프레셔는 소비자가 처리 가능한 수요를 생산자에게 알리는 계약이며, 무제한 버퍼에 지연을 저장하는 것과 다릅니다.

Java의 `Flow.Publisher<T>`는 항목을 전달하는 생산자이고, `Flow.Subscriber<T>`는 이를 받는 소비자입니다. 구독이 성립되면 `onSubscribe`로 `Flow.Subscription`이 전달되고, 소비자는 그 객체로 `request(n)`과 `cancel()`을 호출합니다. 한 구독 안의 callback 순서는 지켜져야 하지만 서로 다른 구독 사이의 전역 순서는 별도 보장이 아닙니다.

Reactive Streams는 비동기 스트림 처리와 논블로킹 백프레셔의 공통 규칙을 정의합니다. 이 글에서 확인한 1.0.4 릴리스는 2022-05-26 공개 상태입니다. Java 9 이상의 `java.util.concurrent.Flow`는 Java API 안에 같은 의미의 네 인터페이스를 제공합니다. 라이브러리 이름이 다르면 실제 구현이 어떤 버퍼와 실행기를 쓰는지 확인해야 합니다.

`request(5)`는 기존 미충족 수요에 5개를 더하는 누적 요청입니다. 0 이하 요청은 오류 신호가 될 수 있습니다. `cancel()`은 이후 전달을 멈추도록 요청하지만 호출 직후 늦은 항목이 관찰될 수 있고, `onComplete`나 `onError`가 반드시 도착한다고 가정할 수 없습니다. 취소와 외부 I/O 중단은 같은 사건이 아니므로 하위 작업의 종료도 확인해야 합니다.

## 구독 구현과 수명

다음은 Java `Flow` API를 사용하는 축약 예제입니다. 한 화면에서 최대 32개를 받도록 처음에 `request(32)`를 한 번만 보내고, 추가 수요를 보내지 않습니다. 모든 callback과 `dispose()`는 같은 직렬 실행기에서 실행된다는 전제입니다. 실제 publisher가 다른 스레드에서 callback을 호출하면 그 경계를 먼저 직렬화해야 합니다.

```java
final class OrderSubscriber implements Flow.Subscriber<Order> {
    private Flow.Subscription subscription;
    private int remaining;
    private boolean done;

    @Override
    public void onSubscribe(Flow.Subscription next) {
        if (subscription != null) {
            next.cancel();
            return;
        }
        subscription = next;
        remaining = 32;
        next.request(32);
    }

    @Override
    public void onNext(Order order) {
        if (done || remaining == 0) {
            subscription.cancel();
            return;
        }
        try {
            render(order);
            remaining--;
            if (remaining == 0) dispose();
        } catch (RuntimeException failure) {
            dispose();
            recordLocalFailure(failure);
        }
    }

    @Override
    public void onError(Throwable failure) {
        if (!done) { done = true; recordFailure(failure); }
    }

    @Override
    public void onComplete() {
        if (!done) { done = true; recordComplete(); }
    }

    void dispose() {
        if (!done) {
            done = true;
            if (subscription != null) subscription.cancel();
        }
    }

    private void render(Order order) { /* UI 경계 */ }
    private void recordLocalFailure(RuntimeException failure) { /* 관측 */ }
    private void recordFailure(Throwable failure) { /* 관측 */ }
    private void recordComplete() { /* 관측 */ }
}
```

이 코드는 callback 재진입과 UI 실행기 제약까지 모든 구현을 해결하는 완성품이 아닙니다. publisher가 callback 중 `request`를 동기적으로 다시 호출할 수 있는지, `render`가 어떤 실행기에서 실행되는지, 화면 수명 종료가 어느 스레드에서 발생하는지 실제 계약을 확인해야 합니다. `remaining`은 한 화면의 처리 예산이지 publisher가 더 이상 항목을 만들지 않는다는 뜻이 아닙니다.

## 진행률과 복구

주문 화면은 먼저 `GET /orders/42`로 현재 스냅샷과 기준 sequence를 받고, 그 다음 sequence부터 진행률 스트림을 구독할 수 있습니다. 네트워크가 끊겼다면 마지막으로 적용한 sequence를 보내 재생을 요청하고, 로그 보관 범위를 벗어났다면 새 스냅샷과 그 기준 sequence를 받아야 합니다. 재연결 성공만으로 누락이 복구된 것은 아닙니다.

최신 진행률은 새 값이 이전 값을 대체할 수 있지만 결제 완료·환불·배송 시작은 내구 로그와 중복 적용 방지가 필요한 업무 이벤트입니다. 로컬 상태 변경과 다음 cursor 저장을 같은 저장 경계에 두고, 외부 효과에는 별도 멱등 키를 둡니다. 동일한 이벤트가 다시 와도 이미 적용한 ID를 확인해 효과를 반복하지 않으며, 같은 ID에 다른 payload가 오면 조용히 합치지 않고 계약 위반으로 격리합니다.

SSE는 서버에서 브라우저로 텍스트 이벤트를 보내는 데 단순할 수 있고, WebSocket은 양방향·바이너리 교환에 적합할 수 있습니다. 어느 채널도 연결 자체가 과거 이벤트 복구나 정확히 한 번 적용을 보장하지 않습니다. `Last-Event-ID` 또는 애플리케이션 cursor, snapshot, 보관 기간, 중복 처리 규칙을 업무 계약으로 함께 둡니다. 자세한 채널·커서·snapshot 전환은 [SSE·WebSocket의 재연결과 상태 복구](/tech-interview/notes/event-stream-recovery/)를 이어서 읽습니다.

## 스트림 실패와 출력 상한

HTTP 응답이 이미 200 헤더를 보낸 뒤 스트림 중간에서 실패하면 나중에 상태 코드를 바꾸기 어렵습니다. 오류 이벤트나 완료 표식, 작업 ID와 별도 상태 조회를 함께 두고, 클라이언트가 부분 응답을 최종 성공으로 저장하지 않게 합니다. 프록시·CDN 버퍼링, 압축, 브라우저 읽기, 화면 반영 시각을 나눠 기록해야 원본 이벤트 발생과 화면 지연을 구분할 수 있습니다.

느린 소비자에게는 연결별 출력 바이트, 이벤트 수, 가장 오래된 대기 시간과 버퍼 크기 상한을 둡니다. 최신 진행률은 합칠 수 있지만 거래 이벤트는 내구 로그로 보내고 연결을 종료한 뒤 cursor로 재생할 수 있습니다. 상한에 도달했을 때 생산자를 늦출지, 오래된 진행률만 합칠지, 연결을 닫고 복구 경로로 보낼지 선택합니다. 완료 이벤트를 일반 진행률처럼 폐기하면 상태가 영원히 미확정으로 남을 수 있습니다.

## 구현과 진단

REST API를 만들 때 URI 명명보다 먼저 자원, 표현, 메서드, 상태 코드, 캐시, 인증, 실패 후 재시도 계약을 적습니다. 반응형 경계에서는 생산 속도, 소비 속도, 누적 request 수요, 버퍼 바이트, cancel 전파, terminal signal, 실제 하위 작업 종료를 같은 요청 식별자로 기록합니다.

검증 순서는 주문 POST timeout 뒤 같은 키 조회, 504 뒤 원본 commit 대사, 사용자 A 응답 뒤 B 사용자 전환, 느린 subscriber의 수요 감소, 0 이하 `request` 오류, cancel 직후 늦은 `onNext`, cursor gap과 보관 만료의 snapshot 전환입니다. “callback이 호출되었다”와 “주문이 한 번만 확정되었다”는 서로 다른 성공 기준입니다.

이 문서의 작성 과정에서는 Java publisher나 네트워크 서버를 실행하지 않았습니다. 따라서 초당 20개와 100개, 10초 뒤 800개는 차이를 설명하는 산술 모형이며 측정 결과가 아닙니다. 실제 운영에서는 subscriber별 p95·p99 지연, 최대 버퍼 바이트, 취소 후 하위 작업 종료 시간, 재연결 복구 시간, 중복 이벤트 수를 대표 부하로 측정합니다.

## 참고 자료와 검증 범위

- [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110) — RFC 9110 / STD 97, 2022 Internet Standard. HTTP 메서드 의미, 표현, 상태 코드와 공통 HTTP 의미를 확인했습니다.
- [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111) — RFC 9111 / STD 98, 2022 Internet Standard. freshness와 검증 후 재사용의 경계를 확인했습니다.
- [Representational State Transfer](https://www.ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm) — Roy Thomas Fielding 박사학위 논문, 2000년 5장. REST 제약의 학술 원문이며 HTTP API 구현 사양은 아닙니다.
- [Reactive Streams](https://www.reactive-streams.org/) — Reactive Streams 1.0.4, 2022-05-26 릴리스. 논블로킹 백프레셔와 인터페이스 목적을 확인했습니다.
- [Java SE 25 `Flow.Publisher`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/Flow.Publisher.html) — Java SE 25/JDK 25. publisher와 구독 수명 의미를 확인했습니다.
- [Java SE 25 `Flow.Subscriber`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/Flow.Subscriber.html) — Java SE 25/JDK 25. callback·terminal signal 계약을 확인했습니다.
- [Java SE 25 `Flow.Subscription`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/Flow.Subscription.html) — Java SE 25/JDK 25. 누적 수요, 0 이하 요청 오류, best-effort 취소를 확인했습니다.
- [SSE·WebSocket의 재연결과 상태 복구](/tech-interview/notes/event-stream-recovery/) — 기존 note. 채널 선택, cursor, snapshot, 프록시 버퍼링과 느린 소비자 상한을 연결합니다.

REST 설명은 2000년 Fielding 원문, HTTP 의미는 2022년 RFC 9110/9111, Java `Flow` API는 2026-09-17에 확인한 Java SE 25/JDK 25 문서에 한정합니다. Reactive Streams 페이지는 1.0.4 릴리스 상태를 표시하지만 이 문서의 작성 과정에서 TCK나 Java 코드를 실행하지 않았습니다. 실행하지 않은 코드는 교육용 예제이며, 어떤 수치도 벤치마크 결과로 해석하지 않습니다.
