---
id: singleflight
title: Singleflight 중복 조회 병합
topic: 분산 시스템
summary: 한 키의 동시 miss를 공유 조회로 합치면서 대기자 취소·실패 재시도·프로세스 범위와 원본 예산을 분리합니다.
questionIds: [cache-stampede-singleflight, singleflight-waiter-cancellation, cache-outage-origin-admission]
---

# Singleflight 중복 조회 병합

## 천 명이 같은 빈 캐시를 봅니다

인기 상품 캐시가 만료된 순간 요청 1,000개가 동시에 들어옵니다. 모두 DB를 읽으면 같은 값 하나를 얻기 위해 같은 비싼 조회를 1,000번 수행합니다. 첫 요청이 조회를 시작하고 나머지는 그 결과를 함께 기다리게 하면 중복 작업을 줄일 수 있습니다. 이 구조를 **singleflight**, 즉 같은 키의 진행 중 작업 합치기라고 부릅니다.

결과 캐시와는 다릅니다. 캐시는 완료된 값을 나중 요청에 재사용하고, singleflight는 **아직 끝나지 않은 실행**을 공유합니다. 결과를 오래 보관할지, 실패를 얼마나 기억할지는 별도 정책입니다.

## 공유 작업은 첫 요청자의 소유물이 아닙니다

```diagram
{"kind":"class","title":"공유 조회와 개별 대기자의 수명","caption":"화살표는 참조·소유 관계입니다. 각 요청은 같은 결과를 기다리지만 공유 작업의 실행 기한은 어느 한 요청자의 기한과 같지 않습니다.","rows":[[{"id":"a","label":"요청 A","detail":["기한 100ms"]},{"id":"b","label":"요청 B","detail":["기한 500ms"]}],[{"id":"flight","label":"Flight","detail":["key · 고유 실행 ID","결과 promise · 대기자 수","독립 실행 기한"]}],[{"id":"loader","label":"DB 조회","detail":["원본 동시성 예산 점유"]}]],"edges":[{"from":"a","to":"flight","label":"결과 대기"},{"from":"b","to":"flight","label":"결과 대기"},{"from":"flight","to":"loader","label":"실행 소유"}]}
```

A가 먼저 왔다는 이유로 A의 취소 토큰을 그대로 DB 조회에 연결하면, A가 떠날 때 여전히 기다리는 B도 실패합니다. 각 요청은 자기 기한에 기다림을 끝내되 공유 조회는 별도 기한으로 관리할 수 있습니다. 모든 대기자가 떠나면 조회를 취소할지 캐시를 채우기 위해 계속할지는 서비스 정책입니다.

## 등록부터 완료까지 한 키를 추적합니다

| 시점 | 요청 A | 요청 B | 공유 상태 |
| --- | --- | --- | --- |
| 0ms | 캐시 miss, flight 생성 | | 조회 1개, 대기자 1명 |
| 10ms | 대기 | 같은 flight 참가 | 조회 1개, 대기자 2명 |
| 100ms | 자신의 기한 만료, 참가 해제 | 계속 대기 | 조회 1개, 대기자 1명 |
| 180ms | 이미 응답 종료 | 결과 수신 | 결과 확정, 대기자 정리 |

원본 호출은 하나로 줄었지만 대기자 수는 둘입니다. 실제 1,000명이라면 1,000개의 요청 상태·연결·응답 메모리가 남습니다. 키별·전체 대기자 상한과 원본 조회 상한을 따로 둬야 합니다.

## 맵의 원자 등록과 실행은 분리합니다

다음은 하나의 프로세스에서 실행하는 슈도코드입니다. 요청 주체에 따라 값이 달라지면 키에 테넌트·권한 범위까지 포함해야 합니다. 다른 사용자의 결과를 같은 상품 ID 하나로 합치면 안 됩니다.

```text
getOrJoin(key, callerDeadline):
    lock(flightsMutex)
    flight = flights.get(key)
    if globalWaiterBudgetFull() or (flight exists and waiterLimitExceeded(flight)):
        unlock(flightsMutex)
        return overloaded
    reserveGlobalWaiterBudget()
    if flight is absent:
        flight = new Flight(uniqueId(), independentDeadline())
        flights[key] = flight
        created = true
    else:
        created = false
    flight.waiters += 1
    unlock(flightsMutex)

    if created:
        startOnceOrSetFailure(flight, () => loadWithOriginBudget(key))
    try:
        return awaitWithoutCancellingSharedPromise(flight.result, callerDeadline)
    finally:
        detachWaiterExactlyOnce(flight)

onLoadFinished(key, flight, outcome):
    publishOutcomeExactlyOnce(flight.result, outcome)
    lock(flightsMutex)
    if flights.get(key) is flight:
        flights.remove(key)
    unlock(flightsMutex)
```

먼저 전체 대기 예산을 예약하고 잠금 안에서 flight 생성 또는 참가와 대기자 수 증가를 함께 처리합니다. 예산이 찬 뒤 반환하는 경로를 따로 두면 실행되지 않은 flight가 맵에 남거나, 등록은 됐는데 예산을 세지 않은 대기자가 생길 수 있습니다. 생성·등록이 실패하면 예약을 되돌리고, 대기자가 빠질 때는 각 대기자마다 수와 전체 예산을 한 번만 줄이며 실행기 제출 실패도 공유 결과의 실패로 게시해 남은 대기자를 깨웁니다.

예를 들어 flight A가 끝난 뒤 정리되기 전에 같은 키로 flight B가 등록되면, A의 완료 처리가 `flights.remove(key)`를 무조건 호출할 때 B까지 사라집니다. 따라서 삭제할 때 현재 맵의 값이 A의 **flight 객체 또는 고유 세대**와 같은지 조건부로 비교하고, 다르면 그대로 둡니다. DB 조회 같은 실행은 맵 잠금 밖에서 시작해 다른 키의 등록·참가를 막지 않습니다.

## 취소할 수 없는 조회도 실제 비용은 남습니다

대기자가 모두 떠나 공유 작업 취소를 요청해도 DB가 계속 실행될 수 있습니다. 이때 맵을 지우고 같은 키의 새 조회를 무제한 시작하면 겹친 실행이 늘어납니다. 정책상 기존 실행을 계속 추적하거나 새 실행을 제한하고, 원본 동시성 허가는 실제 종료 시점에 반환해야 합니다.

실패 직후 엔트리를 지우면 다음 요청이 즉시 같은 실패 조회를 반복할 수 있습니다. 짧은 실패 backoff나 서킷을 둘 수 있지만 “상품 없음”, “권한 거절”, “DB 장애”를 같은 캐시 값으로 저장하지 않습니다. 오류의 의미와 공유 가능한 범위가 다릅니다.

## 한 프로세스 밖의 한계

인스턴스가 10개라면 로컬 singleflight로 최대 각 인스턴스의 한 번씩 조회가 남을 수 있습니다. 이를 더 줄이려면 공유 임대나 중앙 조정이 필요하지만, 임대 만료 뒤 옛 조회가 계속될 수 있어 정확히 하나의 실행을 보장한다고 말할 수 없습니다.

또한 서로 다른 키 100만 개가 모두 miss인 전체 캐시 장애는 키별 합치기만으로 막지 못합니다. 원본 DB로 우회할 전체 동시성·요청률·대기 상한이 필요합니다. TTL 지터는 여러 키의 동시 만료를 분산하지만 하나의 인기 키에 대한 동시 miss는 직접 해결하지 못합니다.

| 상황 | 유효한 장치 | 남는 확인 |
| --- | --- | --- |
| 한 프로세스의 같은 키 miss | 로컬 singleflight | 대기자 수·수명 |
| 여러 인스턴스의 같은 키 miss | 공유 조정 또는 중복 허용 예산 | 임대 만료·조정 장애 |
| 많은 서로 다른 키 miss | 전체 원본 진입 제어 | 공정성·핵심 기능 용량 |
| 늦은 옛 조회가 새 캐시를 덮음 | 버전 기반 게시 | singleflight만으로 해결 안 됨 |

## 테스트는 호출 수와 대기자 결과를 함께 봅니다

같은 키 요청을 동시에 시작해 실제 원본 호출이 하나인지 확인합니다. 첫 요청만 취소해도 두 번째 요청이 결과를 받는지, 실행기 제출 실패가 모든 대기자에게 전달되는지 시험합니다. 옛 flight 완료와 새 flight 등록을 교차시켜 새 항목이 지워지지 않는지도 확인합니다.

마지막에는 키를 모두 다르게 바꿉니다. 호출 합치기 비율이 0에 가까워도 전체 DB 상한은 유지되어야 합니다. 캐시 적중률이 아니라 원본 호출 수, 공유 대기 시간, 실패 반복률, 실제 활성 작업 수로 설계를 판단합니다.
