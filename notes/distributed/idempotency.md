---
id: idempotency
title: 멱등성 키로 중복 요청 다루기
topic: 분산 시스템
summary: 응답을 받지 못한 주문 요청을 같은 논리 작업으로 다시 처리하기 위해 키의 범위, 요청 fingerprint, DB 트랜잭션, 결과 재현, 만료를 하나의 저장 규칙으로 연결합니다.
questionIds: [request-timeout-idempotency, idempotency-record-expiry-contract]
---

# 멱등성 키로 중복 요청 다루기

주문 생성 API에 요청을 보냈는데 클라이언트의 응답 제한 시간이 지났다고 가정해 보겠습니다. 서버가 아예 요청을 받지 못했을 수도 있지만, 주문을 DB에 확정한 직후 응답만 네트워크에서 사라졌을 수도 있습니다. 이 둘은 클라이언트가 관찰하는 결과만으로 구별되지 않습니다. 따라서 다시 보낼 때 새 주문을 만들지 않으려면, 네트워크 시도 하나가 아니라 사용자의 한 번의 주문 의도를 계속 가리키는 **멱등성 키**(idempotency key)가 필요합니다.

이 노트의 범위는 한 DB 안에서 주문 변경과 중복 요청 기록을 안전하게 묶는 방법입니다. 결제사나 메시지 브로커 같은 외부 효과를 이 키 하나가 원자적으로 묶는다고 가정하지 않습니다.

## 먼저 같은 요청의 범위를 고정합니다

키만 같으면 무조건 같은 요청이라고 보면 다른 주문을 삼킬 수 있습니다. 한 사용자가 같은 상품을 오늘 두 번 주문하려는 것은 본문이 같아도 서로 다른 정상 요청입니다. 반대로 응답 제한 시간 뒤 다시 보낸 요청은 HTTP request ID나 trace ID가 바뀌어도 같은 작업입니다.

그래서 서버는 다음 세 값을 함께 식별합니다.

- `scope`: 인증된 `tenant_id` 또는 `user_id`, 작업 종류 `create-order`, 그리고 클라이언트가 보낸 키
- `request_fingerprint`: 요청의 의미를 정규화한 뒤 계산한 fingerprint
- `status`: `PROCESSING`, `SUCCEEDED`, `FAILED_FINAL`, `EXPIRED` 같은 처리 상태

예를 들어 주문 생성 요청은 다음과 같습니다.

```http
POST /orders
Authorization: Bearer <user-42>
Idempotency-Key: checkout-20260914-001
Content-Type: application/json

{"currency":"KRW","items":[{"sku":"A-10","qty":2}],"amount":12000}
```

서버는 사용자 `user-42`, 작업 `create-order`, 키 `checkout-20260914-001`을 한 범위로 묶습니다. JSON의 공백이나 필드 순서는 무시하되, 상품·수량·통화·금액처럼 결과를 바꾸는 값은 포함해 정규화합니다. 인증 헤더, trace ID, 이번 시도의 수신 시각처럼 재전송마다 달라지는 값은 fingerprint에서 제외합니다. 선택 필드에 기본값이 있다면 기본값을 채운 뒤 비교해야 합니다. 그러면 같은 의미의 본문은 같은 fingerprint가 되고, 금액만 바꾼 재사용은 충돌로 판별할 수 있습니다.

저장 구조는 다음처럼 잡을 수 있습니다.

```text
idempotency_records
-------------------
principal_id        -- user-42
operation            -- create-order
key                 -- checkout-20260914-001
request_fingerprint  -- fp-A
status               -- SUCCEEDED
response_status      -- 201
response_body        -- {"orderId":"o-901", ...}
resource_id          -- o-901
created_at
expires_at

UNIQUE (principal_id, operation, key)
```

fingerprint는 같은 키를 다른 내용으로 쓰지 못하게 하는 비교값이지 인증 수단은 아닙니다. 요청자는 매번 정상적으로 인증되어야 하고, 다른 사용자가 우연히 같은 키를 보내도 자신의 범위 밖의 결과를 읽지 못해야 합니다.

## 두 요청이 같은 키를 동시에 잡으려 할 때

가장 위험한 구현은 `SELECT ... WHERE key = ?`로 기록이 없는지 확인한 다음 주문을 만드는 방식입니다. 두 요청이 동시에 조회하면 둘 다 “없음”을 보고 주문을 만들 수 있습니다. 확인한 순간과 실제로 쓰는 순간 사이에 다른 요청이 끼어드는 이 상황을 **TOCTOU**(time-of-check to time-of-use)라고 부릅니다. 최종 판정은 애플리케이션의 if 문이 아니라 DB의 고유 제약이 해야 합니다.

첫 번째 요청 A가 `idempotency_records`에 `PROCESSING` 행을 삽입하면, 같은 범위의 요청 B는 같은 키를 삽입하려고 할 때 그 고유 제약과 부딪힙니다. 이 `PROCESSING` 행은 아직 A의 DB 트랜잭션(transaction) 안에 있으므로 일반 독자는 보지 못합니다. A가 확정하면 B는 삽입 충돌을 확인하고, A가 확정 전에 중단되어 되돌려지면 B가 키를 차지할 수 있습니다. 즉 이 짧은 작업에서 `PROCESSING`은 다른 요청에게 이미 확정된 진행 상태를 알리는 기록이 아니라, 현재 트랜잭션 안에서 키를 선점했다는 잠정 상태입니다. 별도 트랜잭션으로 `PROCESSING`을 먼저 확정하는 설계라면 lease와 복구 주체를 추가로 설계해야 하며, 아래 흐름의 보장 범위가 아닙니다.

B는 삽입 충돌을 곧바로 성공으로 바꾸지 말고, 실패한 문장을 정리하거나 트랜잭션을 끝낸 뒤 새 읽기 경로에서 기록을 확인해야 합니다. 일부 DB는 고유 제약 오류 뒤 같은 트랜잭션에서 추가 쿼리를 허용하지 않으므로 이 순서가 중요합니다.

```diagram
{"title":"멱등성 키의 원자 처리 경계","caption":"화살표는 요청과 결과 조회의 흐름입니다. 멱등성 원장과 주문 행은 같은 DB 트랜잭션에서 함께 확정되고, 재시도 결과는 저장해 둔 응답을 그대로 재현합니다.","rows":[[{"id":"client","label":"클라이언트","detail":["같은 논리 키 재전송","응답 유실 뒤 재시도"]}],[{"id":"api","label":"주문 API","detail":["fingerprint 계산","고유 키 선점"]}],[{"id":"ledger","label":"멱등성 원장","detail":["상태·응답 저장","고유 범위"]},{"id":"orders","label":"주문 테이블","detail":["실제 주문 변경","resource_id"]}],[{"id":"reply","label":"응답","detail":["확정 뒤 반환","저장 결과 재현"]}]],"edges":[{"from":"client","to":"api","label":"같은 key로 재시도"},{"from":"api","to":"ledger","label":"insert 또는 조회"},{"from":"api","to":"orders","label":"같은 트랜잭션 쓰기"},{"from":"orders","to":"ledger","label":"결과 저장"},{"from":"ledger","to":"reply","label":"기존 결과 반환"}]}
```

그림의 핵심은 `주문 테이블`과 `멱등성 원장`이 같은 DB 트랜잭션의 양쪽 쓰기라는 점입니다. 원장만 먼저 확정하거나 주문만 먼저 확정하면, 어느 쪽이 실제 효과를 남겼는지 재시도에서 안전하게 판별할 수 없습니다.

## 주문과 그 결과를 한 번에 확정합니다

짧은 로컬 작업이라면 다음 세 가지를 하나의 DB 작업 단위에 넣습니다.

1. 키와 fingerprint를 가진 원장 행을 고유 제약으로 선점합니다.
2. 선점에 성공한 요청만 주문을 삽입합니다.
3. 생성된 `order_id`, HTTP status, 응답 body를 원장에 저장한 뒤 함께 확정합니다.

주문 삽입이 일시적인 DB 오류로 실패하면 원장 행도 되돌려져 다시 보낼 때 새 처리자로 들어갈 수 있습니다. 반면 재고 부족은 다른 주문의 선행 차감이나 재입고에 따라 다음 시도 결과가 달라질 수 있습니다. 그러므로 이를 “같은 입력을 반복해도 바뀌지 않는 오류”라고 부르지 않고, **이번 요청을 최종 거절로 고정할지** API 정책으로 정해야 합니다.

이 예에서는 다음 계약을 택합니다. 재고 행을 잠그고 모든 최종 거절 조건을 먼저 판정한 뒤에 주문과 재고 변경을 시작합니다. 구현상 판정 뒤 부분 변경이 생길 가능성이 있다면 savepoint를 만든 뒤, `FinalBusinessError`가 발생할 때 그 지점으로 되돌린 다음에만 `FAILED_FINAL`과 오류 응답을 기록합니다. 부분적으로 주문이나 재고를 바꾼 채 최종 거절을 함께 확정해서는 안 됩니다. 재고가 다시 들어오면 같은 키를 새로 성공시키고 싶다면 `FAILED_FINAL`로 고정하지 않고 별도의 재시도 정책을 택해야 합니다.

응답은 모든 쓰기를 확정한 뒤에만 반환합니다. 그러면 확정 직후 프로세스가 죽어도 주문과 `SUCCEEDED` 원장이 함께 남습니다. 클라이언트가 같은 키로 다시 오면 현재 주문을 다시 계산하지 않고 원장에 보관한 status와 body를 그대로 돌려줍니다. 현재 주문이 나중에 배송되거나 취소되어도 최초 생성 응답의 `order_id`와 형식이 달라지지 않는 이유입니다. 응답에 생성 시각이나 페이지네이션 토큰이 들어간다면 그것도 저장된 결과에 포함해야 같은 요청에 같은 응답을 보낼 수 있습니다.

## 실제 처리 순서와 재시도 한도

아래는 특정 DB 문법을 그대로 복사하는 코드가 아니라, 고유 삽입 충돌 뒤 새 읽기, 최종 거절의 savepoint 복구, 재시도 횟수와 전체 기한을 포함한 실행 순서를 나타내는 의사코드입니다. `retryContext.attempts`는 현재 요청 시도의 번호이며 처음에는 `1`, `MAX_ATTEMPTS`는 전체 시도 상한, `deadline`은 이 요청에 허용된 전체 기한입니다.

```text
MAX_ATTEMPTS = 3
REQUEST_DEADLINE = 30 seconds

handleCreateOrder(request):
    initialContext = {
        attempts: 1,
        deadline: now() + REQUEST_DEADLINE
    }
    return handleCreateOrderAttempt(request, initialContext)

retryWithSameKey(request, context, exhaustedResponse):
    nextAttempt = context.attempts + 1
    delay = backoffWithJitter(nextAttempt)
    if nextAttempt > MAX_ATTEMPTS or now() + delay >= context.deadline:
        return exhaustedResponse

    sleep(delay)
    nextContext = {
        attempts: nextAttempt,
        deadline: context.deadline
    }
    return handleCreateOrderAttempt(request, nextContext)

handleCreateOrderAttempt(request, retryContext):
    principal = authenticate(request)
    normalized = normalizeOrderInput(request.body)
    fingerprint = hash(principal.id, "create-order", normalized)
    key = (principal.id, "create-order", request.idempotencyKey)
    validate(normalized)

    if retryContext.attempts > MAX_ATTEMPTS or now() >= retryContext.deadline:
        return http503("RETRY_DEADLINE_EXCEEDED")

    tx = db.begin()
    try:
        won = tx.insertIdempotencyIfAbsent(
            key=key,
            fingerprint=fingerprint,
            status="PROCESSING",
            expiresAt=retentionDeadline()
        )

        if won == false:
            tx.rollback()                 // 충돌 문장 뒤의 읽기와 분리
            record = db.readIdempotency(key)

            if record == null:
                return retryWithSameKey(
                    request,
                    retryContext,
                    http409("REQUEST_STATUS_UNCONFIRMED")
                )
            if record.requestFingerprint != fingerprint:
                return http409("IDEMPOTENCY_KEY_REUSED")
            if record.status in ["SUCCEEDED", "FAILED_FINAL"]:
                return replay(record.responseStatus, record.responseBody)
            if record.status == "EXPIRED":
                return http410("IDEMPOTENCY_KEY_EXPIRED")
            if record.status == "PROCESSING":
                return retryWithSameKey(
                    request,
                    retryContext,
                    http409("REQUEST_IN_PROGRESS")
                )
            return http500("UNKNOWN_IDEMPOTENCY_STATE")

        savepoint = tx.savepoint()
        try:
            stock = tx.lockStockRows(normalized)  // 잠금만 얻고 아직 변경하지 않음
            tx.assertFinalBusinessRules(normalized, stock)
            order = tx.insertOrder(principal.id, normalized)
            tx.decreaseStock(stock, normalized)
            response = makeCreatedResponse(order)
            tx.updateIdempotency(
                key,
                status="SUCCEEDED",
                resourceId=order.id,
                responseStatus=response.status,
                responseBody=response.body
            )
        except FinalBusinessError as error:
            tx.rollbackTo(savepoint)       // 부분 변경이 있었다면 모두 되돌림
            response = makeFinalErrorResponse(error)
            tx.updateIdempotency(
                key,
                status="FAILED_FINAL",
                responseStatus=response.status,
                responseBody=response.body
            )

        tx.commit()
        return response
    except TransientError:
        tx.rollback()
        return retryWithSameKey(
            request,
            retryContext,
            http503("RETRY_LIMIT_REACHED")
        )
    except:
        tx.rollback()
        raise
```

이 계약에서는 `lockStockRows`가 관련 재고 행을 잠그므로, 재고를 확인한 뒤 차감하기 전에 다른 주문이 끼어들지 않습니다. 모든 최종 거절을 쓰기 전에 판정하는 구현이라면 savepoint는 방어적으로 남아 있는 것이고, `decreaseStock` 같은 후속 단계에서 예상 밖의 `FinalBusinessError`가 나와도 부분 변경을 남기지 않습니다. `retryWithSameKey`는 다음 시도가 상한을 넘거나 기다릴 시간까지 전체 기한을 넘으면 재귀 호출하지 않고 지정된 응답을 반환합니다. 따라서 `record == null`, `PROCESSING`, 일시 오류의 세 경로가 모두 반환값과 한도를 가집니다.

실제 구현은 DB 연결·잠금·문장 실행에도 남은 기한을 전달해야 합니다. 반복 시작 전에 시계를 확인하는 것만으로 이미 실행 중인 DB 호출을 30초 안에 끝낼 수는 없습니다. 커밋 응답 유실도 실패 확정이 아니므로, 예외 정리 때 활성 트랜잭션만 되돌리고 같은 키의 저장 결과로 상태를 다시 확인합니다. `expires_at`은 정리 작업이 결과를 `EXPIRED` 표식으로 바꿀 기준이며, 정리 전에는 기존 결과를 재현하는 정책입니다.

실제 DB에서는 `insertIdempotencyIfAbsent`를 고유 인덱스와 충돌 처리 구문으로 구현하더라도, “먼저 SELECT하고 나중에 INSERT”로 대체하면 안 됩니다. 같은 키를 동시에 받은 두 요청의 처리 흐름은 다음처럼 보입니다.

| 시점 | 요청 A | 요청 B | 멱등성 원장 | 주문 테이블 | 관찰되는 결과 |
| --- | --- | --- | --- | --- | --- |
| t0 | `fp-A`로 시작 | `fp-A`로 시작 | 없음 | 없음 | 아직 효과 없음 |
| t1 | `PROCESSING` 삽입 후 주문 작업 중 | 같은 고유 키 삽입에서 대기 또는 충돌 | A 작업 단위 안에만 있음 | A 작업 단위 안에만 있음 | 일반 조회에는 두 행 모두 없음 |
| t2 | 주문 `o-901`과 `SUCCEEDED`를 함께 확정 | 고유 충돌을 확인하고 새 읽기를 수행 | `fp-A`, `SUCCEEDED`, `o-901` | 주문 1개 | A가 응답을 잃어도 결과 보존 |
| t3 | 같은 키로 다시 보내지 않음 | `fp-A`를 확인하고 저장 결과 반환 | 그대로 | 그대로 | B도 동일한 `201`과 `o-901` |
| t4 | 해당 없음 | 같은 키에 금액 `15000`인 `fp-B` 전송 | 기존 `fp-A` 유지 | 주문 1개 | `409 IDEMPOTENCY_KEY_REUSED`, 새 주문 없음 |

A가 t1에서 중단되면 주문과 `PROCESSING` 원장이 함께 되돌려집니다. 그때 B가 키를 차지해 정상 처리할 수 있습니다. 반대로 A가 t2 확정 뒤 응답을 잃으면 B는 주문 생성 로직을 다시 실행하지 않고 저장된 응답만 읽습니다.

## 만료는 키를 재사용해도 된다는 뜻이 아닙니다

멱등성 원장을 무조건 보관 기간 뒤 삭제하면, 오래된 클라이언트의 재시도가 새 요청으로 오인될 수 있습니다. 예를 들어 t0에 주문이 성공하고 24시간 뒤 원장 행을 삭제한 다음, 네트워크에 갇혔던 같은 키가 도착하면 두 번째 주문이 만들어질 수 있습니다. 따라서 보관 기간은 캐시 청소 시간이 아니라 “이 키를 얼마 동안 같은 요청으로 인정할지”라는 API 계약입니다.

주문 생성처럼 중복 비용이 큰 작업은 다음 중 하나를 택해야 합니다.

- 가능한 재시도·오프라인 재전송·수동 재생 기간보다 길게 원장과 응답을 보관합니다.
- 응답 본문을 지워야 한다면 `EXPIRED` tombstone과 fingerprint, `resource_id`만 더 오래 남겨 같은 키의 실행을 거절하고 결과 조회로 안내합니다.
- 재사용을 허용하지 않는 별도의 주문 참조 고유 제약을 두고, 만료된 키가 새 주문을 직접 만들지 못하게 합니다.

정리 작업은 `SUCCEEDED`나 `FAILED_FINAL`인 terminal row만 대상으로 해야 하며, 아직 처리 중인 행을 시간만 보고 지우면 안 됩니다. 만료된 행이 남아 있는 동안 같은 fingerprint라도 자동 실행하지 않고 `410` 또는 결과 조회를 반환하는 정책이 재사용 사고를 막습니다. 새로 주문하려는 사용자는 새 키를 발급해야 합니다.

## 중단 지점별 실패 표

| 실패를 넣은 지점 | 확정된 원장 | 주문 상태 | 같은 키 재시도 | 설계 판단 |
| --- | --- | --- | --- | --- |
| 원장 INSERT에 도달하기 전 | 없음 | 없음 | 새로 선점해 실행 | 전송 전 실패와 같음 |
| 원장 INSERT 뒤, 주문 INSERT 전 | 없음(되돌림) | 없음 | 새로 실행 | 두 쓰기가 함께 취소됨 |
| 주문 INSERT 뒤, 원장 응답 저장 전 | 없음(되돌림) | 없음 | 새로 실행 | 주문만 남는 창이 없음 |
| 두 쓰기 확정 뒤 HTTP 응답 전 | `SUCCEEDED`와 응답 저장 | 주문 1개 | 저장 결과 반환 | 응답 유실을 미실행으로 보지 않음 |
| 같은 키 두 요청이 동시에 선점 | 한 행만 성공 | 주문 최대 1개 | 승자는 처리, 패자는 결과 반환 | unique 제약이 판정 |
| 같은 키에 다른 fingerprint | 기존 fingerprint 유지 | 기존 주문만 | `409`로 거절 | 조용한 결과 재사용 금지 |
| 최종 거절 중 부분 변경 발생 | `FAILED_FINAL`만 확정 | 부분 주문·재고 변경 없음 | 같은 오류 반환 | savepoint 되돌림 후 기록 |
| terminal row 만료 뒤 늦은 재시도 | `EXPIRED` tombstone 유지 | 기존 주문 유지 | `410` 또는 조회 안내 | 키를 새 작업으로 재활용하지 않음 |

이 표에서 중요한 것은 실패한 시점의 HTTP 문구가 아니라 확정된 실제 행 수입니다. 응답이 두 번 도착했는지는 관찰 신호일 뿐이고, 주문과 원장에 최종적으로 몇 행이 남았는지가 중복 방지의 기준입니다.

## 직접 확인할 입력과 예상 결과

구현을 점검할 때는 다음 순서로 입력을 넣어 보겠습니다.

1. 빈 DB에 예제 요청을 한 번 보내면 주문 1개, `SUCCEEDED` 원장 1개, 응답의 `order_id`가 생깁니다.
2. 같은 body와 같은 키를 다시 보내면 주문 수는 그대로이고 status·body·`order_id`가 처음 응답과 같습니다.
3. 같은 키를 두 worker에서 동시에 보내면 하나의 고유 삽입만 성공하고 주문은 하나만 확정됩니다.
4. 같은 키의 금액이나 상품을 바꾸면 `409`가 오고 두 번째 주문은 생기지 않습니다.
5. savepoint 뒤 `FinalBusinessError`를 발생시키고 오류 처리와 커밋까지 진행하면 부분 주문·재고 변경 없이 `FAILED_FINAL`만 남아야 합니다. 반면 커밋 전에 프로세스를 종료하면 원장도 함께 되돌려져야 합니다.
6. 고유 키 충돌 뒤 원장 읽기가 잠시 `null`인 상황을 만들면 같은 키 재시도가 상한과 전체 기한 안에서만 이어지고, 한도를 넘으면 불확정 상태 응답으로 끝나야 합니다.
7. 응답을 보관 기간 만료 상태로 만든 뒤 늦은 같은 키를 보내면 새 주문이 아니라 `EXPIRED` 정책으로 거절되어야 합니다.

이 결과를 통과해야 “다시 보내도 안전하다”고 말할 수 있습니다. 단순히 두 번째 요청에 성공 문구를 돌려주는 것만으로는 같은 키의 payload 충돌, 동시 선점, 부분 변경을 남긴 최종 거절, 만료 뒤 재실행까지 해결되지 않습니다.
