---
id: redis-atomic-execution
title: Redis 조건부 갱신의 원자 범위
topic: 데이터베이스
summary: 재고 한 칸을 안전하게 줄이는 상황을 따라가며 pipeline·MULTI/EXEC·WATCH·Lua가 판단과 실패를 어디까지 묶는지 비교합니다.
questionIds: [redis-pipeline-transaction-lua, redis-multi-queue-runtime-errors]
---

# Redis 조건부 갱신의 원자 범위

## 재고가 부족한데 왜 줄었을까요?

재고가 `1`인 상품을 두 요청이 동시에 주문한다고 해 보겠습니다. 원하는 규칙은 단순합니다. 남은 수량이 주문 수량보다 크거나 같을 때만 차감하고, 그렇지 않으면 거절해야 합니다. 그런데 애플리케이션이 `GET stock`을 한 뒤 값을 확인하고 `DECRBY stock 1`을 보내면, 두 클라이언트가 같은 `1`을 읽고 둘 다 차감할 수 있습니다. 두 번의 `DECRBY`가 각각 적용되므로 최종 재고는 `-1`입니다. 갱신 유실은 `GET`으로 읽은 값을 각 클라이언트가 계산한 뒤 `SET`으로 덮어쓰는 별도의 패턴입니다.

이때 “Redis 명령은 한 번에 하나씩 처리된다”는 설명만으로는 충분하지 않습니다. 여기서 묶어야 하는 것은 명령 하나가 아니라 **읽기 → 조건 판단 → 변경**이라는 업무 흐름입니다. 또 성공 응답을 받았다는 사실, 실행 중 다른 명령이 끼어들지 않았다는 사실, 오류가 났을 때 앞선 변경이 되돌아간다는 사실은 서로 다른 약속입니다.

## 먼저 원자성의 범위를 나눕니다

이 노트에서 `원자 범위`는 한 Redis 노드의 주 실행 경로에서 다른 클라이언트 명령이 끼어들 수 없는 구간을 뜻합니다. 이는 데이터베이스 transaction의 rollback과 같은 말이 아닙니다. `MULTI/EXEC`는 정해진 명령을 순서대로 격리해 실행하지만 실행 오류가 앞선 쓰기를 되돌리지는 않습니다. Lua도 스크립트 전체를 다른 명령이 관찰할 수 없게 실행하지만, 스크립트 중간에 이미 실행된 쓰기를 런타임 오류가 자동으로 rollback한다고 가정하면 안 됩니다.

또한 “판단을 어디서 하는가”를 고정해야 합니다.

- **클라이언트 판단**: `GET` 응답을 받은 뒤 애플리케이션이 `DECRBY`를 선택합니다. 두 요청 사이의 틈이 있습니다.
- **EXEC 안의 고정 명령**: `GET`과 `DECRBY`를 함께 큐에 넣지만, `GET` 결과로 `DECRBY`를 실행할지 말지를 클라이언트가 중간에 선택할 수는 없습니다.
- **WATCH를 사용한 클라이언트 판단**: 읽은 키가 바뀌었는지 `EXEC`에서 확인하고, 충돌이면 처음부터 다시 읽습니다.
- **서버 안 판단**: Lua가 값을 읽고 조건을 검사한 뒤 같은 실행 안에서 변경합니다.

## 네 가지 방법을 같은 문제에 놓습니다

| 방법 | 조건 판단 위치 | 실행 중 다른 명령 | 이 문제에서 남는 실패 책임 | 알맞은 경우 |
| --- | --- | --- | --- | --- |
| Pipeline | 클라이언트. 응답을 받아야 다음 판단 가능 | 명령 사이에 끼어들 수 있음 | 응답별 오류, 이미 실행됐을 수 있는 재시도 | 서로 독립적인 여러 GET·SET의 왕복 감소 |
| `MULTI/EXEC` | 조건 없는 고정 명령 목록 | `EXEC`가 실행되는 동안에는 끼어들지 않음 | `EXEC` 결과 배열 해석, rollback 없음 | 항상 함께 실행할 정해진 명령 묶음 |
| `WATCH` + `MULTI/EXEC` | `WATCH` 뒤 클라이언트가 읽고 판단 | 감시 키 변경이면 `EXEC`가 중단됨 | null 응답 뒤 최신 값 재조회와 제한된 재시도 | 읽은 값에 따라 명령 자체가 달라지는 CAS |
| Lua | Redis 서버 내부 | 스크립트 실행 중 다른 명령은 실행되지 않음 | 쓰기 전 검증, 짧은 실행, 응답 유실과 런타임 오류 | 짧은 읽기·판단·다중 키 변경 |

파이프라인은 여러 명령의 응답을 하나씩 기다리지 않고 보내 왕복 시간(RTT)을 줄이는 통신 방식입니다. 예를 들어 `GET stock`과 `DECRBY stock 1`을 한 파이프라인에 넣으면 응답은 `[1, 0]`처럼 돌아오더라도, 클라이언트가 `1`을 읽고 차감 여부를 선택한 것이 아닙니다. 두 명령을 처음부터 모두 보냈기 때문에 `stock`이 `0`이면 그대로 `-1`이 될 수 있습니다.

`MULTI` 뒤의 명령은 즉시 실행되지 않고 큐에 들어갑니다. `EXEC`는 큐를 순서대로 실행하므로 실행 구간의 격리는 얻지만, `GET`의 결과를 받은 뒤에 `DECRBY`를 큐에서 제거하는 기능은 제공하지 않습니다. 더구나 `WATCH`가 없다면 `MULTI`와 `EXEC` 사이에 다른 클라이언트가 `stock`을 바꿀 수 있습니다.

## 실행 경계를 그림으로 고정합니다

```diagram
{"title":"조건부 재고 변경의 원자 범위","caption":"화살표는 요청과 실행 결과의 흐름입니다. Lua 구간에서는 경쟁 요청이 대기하지만, 이 범위 밖의 외부 결제나 응답 재전송은 원자적으로 묶이지 않습니다.","rows":[[{"id":"client","label":"주문 클라이언트","detail":["상품 키·요청 수량"]},{"id":"rival","label":"경쟁 요청","detail":["같은 재고를 변경"]}],[{"id":"redis","label":"Redis 서버","detail":["EVAL 수신"]}],[{"id":"logic","label":"짧은 Lua 로직","detail":["읽기 → 검사 → 차감"]}],[{"id":"reply","label":"결과 반환","detail":["성공 또는 거절"]}]],"edges":[{"from":"client","to":"redis","label":"스크립트 호출"},{"from":"rival","to":"redis","label":"동시 명령"},{"from":"redis","to":"logic","label":"원자 실행"},{"from":"logic","to":"reply","label":"상태 반환"}]}
```

그림에서 `logic` 안의 세 단계가 이 문제의 핵심 경계입니다. Redis는 스크립트가 실행되는 동안 경쟁 요청을 끼워 넣지 않습니다. 반면 주문 서비스가 결제 승인 API를 호출하는 일, 클라이언트가 타임아웃 뒤 재전송하는 일, 새 primary 주소를 찾는 일은 그림 밖입니다. 따라서 Redis 안의 재고 차감이 원자적이어도 전체 주문이 exactly-once가 되는 것은 아닙니다.

## WATCH 방식은 충돌을 실패로 바꿉니다

Lua를 배포할 수 없거나 읽은 값으로 애플리케이션의 명령을 조립해야 한다면 `WATCH`를 사용합니다. 반드시 같은 연결에서 다음 순서를 지킵니다.

```text
WATCH stock
current = GET stock
if current >= 1:
    MULTI
    DECRBY stock 1
    result = EXEC
else:
    UNWATCH
    result = rejected
```

처음 값이 `1`이라고 하겠습니다. 클라이언트 A가 `WATCH stock`과 `GET stock`을 마친 직후, 클라이언트 B가 `SET stock 0`을 실행합니다. A가 `MULTI`와 `DECRBY`를 보낸 뒤 `EXEC`를 호출하면 Redis는 감시 키가 바뀐 것을 보고 null 응답을 반환합니다. A는 예전에 읽은 `1`을 믿고 계속 진행하지 말고, `WATCH`부터 다시 시작해 최신 값 `0`을 읽은 뒤 거절해야 합니다.

충돌이 없으면 `EXEC`는 명령별 응답 배열을 돌려주고 감시는 끝납니다. 재시도 횟수와 backoff를 제한하지 않으면 핫 키에서 애플리케이션이 Redis를 계속 두드리는 새로운 병목이 생깁니다. `WATCH`는 충돌을 감지할 뿐 충돌 없는 실행을 보장하지도, 무한 재시도가 안전하다는 것을 보장하지도 않습니다.

## Lua에서는 검증을 쓰기보다 먼저 끝냅니다

작은 재고 정책은 서버 안에서 다음처럼 표현할 수 있습니다. 아래는 실행 코드가 아니라 키와 인자의 의미를 드러낸 슈도코드입니다. `KEYS[1]`은 재고 해시이고 `KEYS[2]`는 이 요청만을 위한 기록 키입니다. `ARGV[1]`은 고유 요청 ID, `ARGV[2]`는 양수 주문 수량입니다.

요청 키는 클라이언트가 요청자 범위까지 포함해 미리 만들고 스크립트에 명시적으로 전달한다고 가정합니다. `parse_positive_integer`와 `parse_nonnegative_integer`는 실제 Redis Lua API의 함수가 아니라 입력 검증을 나타내는 추상 함수입니다.

실제 구현에서는 허용할 정수 형식·64비트 범위·overflow·Lua 숫자 정밀도 범위를 명시하고, 그 범위를 벗어난 값은 거절해야 합니다. 아래 숫자 비교는 이 안전한 정수 범위 안에서만 성립합니다.

```text
request_id = validate_and_canonicalize_request_id(ARGV[1])
qty = parse_positive_integer(ARGV[2])
if request_id invalid or qty invalid:
    return input_error                 # 아직 읽거나 쓰지 않음
retention_seconds = validated_positive_retention_from_service_config()
# 상품 키도 포함해 같은 요청 ID를 다른 상품에 쓰는 충돌을 감지합니다.
fingerprint = encode_fields(KEYS[1], canonical_decimal(qty))

# record는 fingerprint와 result를 함께 인코딩한 추상 레코드입니다.
record = GET(KEYS[2])
if record exists:
    if record.fingerprint != fingerprint:
        return "request_id_conflict"
    return record.result

stock = parse_nonnegative_integer(HGET(KEYS[1], "available"))
if stock invalid:
    return input_error                 # 아직 쓰지 않음

if stock < qty:
    SET(KEYS[2], encode(fingerprint, "rejected"), EX = retention_seconds)
    return "rejected"

HINCRBY(KEYS[1], "available", -qty)
SET(KEYS[2], encode(fingerprint, "accepted"), EX = retention_seconds)
return "accepted"
```

`SET(..., EX = retention_seconds)`는 재고 키가 아니라 요청 기록에만 만료를 설정한다는 뜻의 슈도코드입니다. 실제 구현에서는 요청 ID의 허용 형식·소유 범위·보관 기간을 서비스 계약으로 정하고, 인증된 주체·작업 종류·요청 ID를 바탕으로 신뢰된 서비스가 요청 키를 만들며, 재고 키와 요청 키가 서로 다른지 확인해야 합니다. Redis Cluster에서는 두 키가 같은 해시 슬롯에 있어야 이 두 키를 한 번에 처리할 수 있습니다.

예를 들어 같은 상품의 키에 공통 hash tag를 사용하는 방식이 있지만, 이는 그 슬롯의 원자 실행을 돕는 것이지 전역 트랜잭션을 만드는 것은 아닙니다. 기록이 TTL 만료·퇴거·장애로 사라지면 재차감 방지는 유지되지 않으므로, 이 예의 보장 기간과 외부 원장에 의한 복구 범위를 별도로 정해야 합니다.

요청 ID 기록을 같은 원자 실행 안에 두면 응답이 유실된 뒤 같은 요청을 다시 보낼 때 이미 처리한 결과를 반환할 수 있습니다. 단, 같은 ID를 다른 수량으로 재사용하면 기존 `accepted`를 그대로 반환해서는 안 됩니다. 예시처럼 수량 fingerprint를 결과와 함께 저장하고 불일치하면 `request_id_conflict`로 거절해야 합니다.

요청 ID의 허용 형식과 소유 범위도 정해야 합니다. 만료되지 않는 기록을 무한히 쌓으면 메모리가 계속 증가하므로, 재시도·대사에 필요한 보관 기간, TTL 또는 별도 원장으로 넘기는 시점, 기록을 지울 때 허용할 불확정 상태를 함께 정해야 합니다.

이 예도 “어떤 오류도 rollback된다”는 뜻은 아닙니다. 해시가 애초에 다른 타입이거나 인자가 잘못된 경우는 쓰기 전에 거절하고, 스크립트는 짧고 오류 가능성이 적게 유지해야 합니다. 메모리 부족이나 예기치 않은 런타임 오류가 쓰기 뒤에 발생할 수 있는 환경이라면 처리 기록과 재고를 대사할 보정 경로도 필요합니다.

Lua는 서버의 데이터에 접근할 키를 입력으로 명시하고, 무제한 반복이나 외부 네트워크 호출을 넣지 않아야 합니다. Redis 공식 문서처럼 스크립트는 실행 전체 동안 서버 활동을 막으므로, 원자성을 얻겠다고 큰 컬렉션 순회나 오래 걸리는 업무 로직을 넣으면 짧은 `GET`까지 함께 지연됩니다.

## 오류가 났을 때 무엇이 남는지 확인합니다

| 실패 지점 | 관찰되는 결과 | 이미 한 변경의 처리 | 다시 시도할 때의 규칙 |
| --- | --- | --- | --- |
| Pipeline의 개별 명령 | 응답 배열의 특정 항목만 오류 | 앞뒤 명령은 별도로 실행될 수 있음 | 각 응답을 순서대로 해석하고 요청 ID로 중복 확인 |
| `MULTI` 큐잉 단계의 문법·인자 오류 | Redis가 큐잉을 거부하고 `EXEC`가 transaction을 폐기하는 경우 | 큐에 들어가지 않은 명령은 실행되지 않음 | 큐잉 오류와 실행 오류를 구분 |
| `EXEC` 중 타입 오류 | 결과 배열의 한 항목이 `WRONGTYPE` 등으로 반환 | 다른 명령은 계속 실행되며 rollback 없음 | 부분 결과를 상태로 기록하고 자동 재전송하지 않음 |
| `WATCH` 충돌 | `EXEC`가 null 반환 | 해당 transaction 명령은 실행되지 않음 | 최신 값을 다시 읽어 새 판단을 수행 |
| Lua의 쓰기 뒤 런타임 오류 | 스크립트 오류 응답 | 앞서 수행된 쓰기가 자동 rollback되지 않을 수 있음 | 입력 사전 검증, 보정·대사, 멱등 결과 조회 |
| 요청 전송 뒤 응답 유실 | 클라이언트가 성공 여부를 모름 | Redis에서는 이미 실행됐을 수 있음 | 동일 요청 ID의 결과를 먼저 조회 |

특히 `MULTI`에서 잘못된 명령이 큐에 들어가지 못한 경우와 `EXEC` 안에서 `WRONGTYPE`이 난 경우를 같은 오류로 뭉개면 안 됩니다. 전자는 Redis가 전체 큐를 거부할 수 있지만, 후자는 오류가 난 명령을 제외한 나머지가 계속 처리됩니다. Redis transaction은 rollback을 제공하지 않으므로, 결과 배열을 확인하지 않고 “실패했으니 아무것도 안 됐겠지”라고 재시도하면 중복 차감이 생길 수 있습니다.

## 직접 확인할 입력과 예상 결과

아래 실험은 운영 데이터가 아닌 별도 Redis 인스턴스에서 실행한다고 가정합니다. 아직 실행한 결과가 아니라, 각 입력으로 확인해야 할 예상 관찰입니다.

1. `SET stock 0` 뒤 pipeline으로 `GET stock`과 `DECRBY stock 1`을 한 번에 보냅니다. 예상 결과는 GET이 `0`, 차감 뒤 값이 `-1`이 될 수 있다는 것입니다. pipeline이 조건부 분기를 만들지 않는지 확인합니다.
2. `SET stock 1` 뒤 `MULTI`, `GET stock`, `DECRBY stock 1`, `EXEC`를 보냅니다. `EXEC`에서 GET 응답을 보고 차감 명령을 선택할 수 없고 두 명령이 모두 실행되는지 확인합니다.
3. 두 연결에서 `WATCH stock` → `GET stock`을 한 뒤 한쪽에서 `SET stock 0`, 다른 쪽에서 `MULTI` → `DECRBY` → `EXEC`를 실행합니다. 경쟁 쪽 `EXEC`가 null이고 stock이 음수가 되지 않는지 확인합니다.
4. 재고 해시의 `available=1`에 대해 요청 ID `order-7`, 수량 `1`로 Lua 슈도코드와 같은 스크립트를 두 번 호출합니다. 첫 호출은 `accepted`와 `available=0`, 두 번째 호출은 같은 fingerprint의 `accepted`를 반환하며 두 번 차감하지 않아야 합니다. 같은 요청 ID로 수량 `2`를 보내면 `request_id_conflict`가 반환되어야 합니다. 요청 기록에 TTL을 적용한다면 만료 뒤 재시도가 새 주문으로 취급되는 경계도 별도로 확인합니다.
5. `SET a abc` 후 `MULTI`, `SET marker 1`, `LPOP a`, `EXEC`를 실행합니다. `EXEC` 응답에 `OK`와 `WRONGTYPE`가 함께 나타나고 `marker`가 남는지 확인해 rollback 오해를 제거합니다.

### 공식 문서에서 이어 읽기

- [Redis Transactions](https://redis.io/docs/latest/develop/using-commands/transactions/): `MULTI/EXEC`, transaction 오류, rollback 부재, `WATCH` 기반 낙관적 잠금
- [Redis Pipelining](https://redis.io/docs/latest/develop/using-commands/pipelining/): 왕복 시간 감소와 Pipelining 대 Scripting
- [Scripting with Lua](https://redis.io/docs/latest/develop/programmability/eval-intro/): 서버 안의 원자 실행, 키 인자, script cache와 오류
- [Redis programmability](https://redis.io/docs/latest/develop/programmability/): script 실행 시간과 느린 script의 차단 동작

이 문제의 결론은 “가장 강한 기능을 항상 선택한다”가 아닙니다. 독립 명령 묶음이면 pipeline, 조건 없는 고정 묶음이면 `MULTI/EXEC`, 클라이언트 판단과 충돌 재시도가 필요하면 `WATCH`, 짧은 조건부 읽기·판단·변경이면 Lua를 선택합니다. 어느 방법이든 응답 유실, 실행 오류, 재시도 중복은 Redis 밖의 별도 계약으로 끝까지 설계해야 합니다.
