---
id: cache-freshness
title: 부재 캐시와 Stale 응답의 유효 기간
topic: 성능
summary: 없는 값과 조회 실패를 구분하고 negative cache·생성 무효화·fresh/stale 경계·재검증 합치기·늦은 갱신의 역전을 설명합니다.
questionIds: [cache-negative-results, cache-stale-while-revalidate]
---

# 부재 캐시와 Stale 응답의 유효 기간

## 부재 결과의 의미와 만료 정책

상품 ID 42가 없을 때 요청마다 DB를 조회하면 존재하지 않는 ID의 반복 요청이 원본을 압박합니다. **부재 캐시**(negative cache)는 원본 조회가 정상적으로 끝나 대상이 없다는 결과만 짧게 저장하고, DB timeout·연결 오류는 부재 표식으로 저장하지 않습니다. 또 인가 범위에서만 보이지 않는 결과라면 해당 사용자·tenant·권한 문맥을 cache key에 포함하거나 다른 문맥과 공유하지 않아야 하므로, 다른 사용자에게 존재 여부가 드러나지 않게 처리합니다.

| 결과 | 저장 판단 | 주의점 |
| --- | --- | --- |
| 권한 범위에서 확정한 부재 | 짧고 명시적인 부재 TTL | 생성 직후 가림 |
| DB timeout·연결 오류 | 부재로 저장하지 않음 | 오류를 정상 404로 은폐 |
| 값 존재 | 일반 freshness 정책 | 삭제·갱신 지연 |
| 사용자별 접근 불가 | 인가 문맥별 처리 | 존재 여부·다른 사용자 정보 노출 |

tenant·권한·query 정규화가 결과 의미를 바꾸면 cache key에도 그 경계를 반영합니다. 임의 ID가 계속 들어오면 짧은 TTL만으로 메모리 상한을 보장하지 못하므로 entry/bytes 한도·입력 검증·rate limit도 필요합니다.

## 생성 시 캐시 삭제와 지연된 부재 결과의 재게시 경합

시각 1에 조회 A가 상품 42의 부재를 읽고, 시각 2에 생성 B가 commit한 뒤 cache에서 키를 삭제해도, 시각 3에 A가 돌아와 부재를 다시 쓰면 새 상품이 가려집니다. 따라서 refill은 부재를 읽을 때 본 key generation·version을 기억하고, 현재 generation·version 검사와 캐시 쓰기를 원자적으로 묶어 값이 달라졌으면 오래된 결과를 거절하거나, 원본 변경과 cache 갱신을 연결하는 일관성 정책을 적용해야 합니다.

TTL은 이 경주가 일어났을 때 불일치가 남는 최대 기간을 제한할 뿐 즉시 일관성을 증명하지 않습니다.

## Fresh·Stale 허용 시간 분리

값에 `fetchedAt`, `freshUntil`, `staleUntil`, 원본 version을 둔다고 가정합니다. fresh 구간에는 바로 반환하고, stale 허용 구간에는 이전 값을 반환하면서 제한된 재검증을 시작합니다. staleUntil 뒤에는 원본 성공을 기다리거나 명시적 오류로 끝냅니다. 매번 읽혔다고 staleUntil을 늘리면 영구히 낡은 값을 제공할 수 있습니다.

```diagram
{"title":"값의 나이마다 다른 반환 정책","caption":"화살표는 시간이 흐를 때의 상태 전이입니다. 재검증 실패는 기존 값의 최대 허용 나이를 자동 연장하지 않습니다.","rows":[[{"id":"fresh","label":"Fresh · 즉시 반환"}],[{"id":"stale","label":"Stale 허용 · 반환과 재검증"}],[{"id":"expired","label":"최대 나이 초과 · 기다림 또는 오류"}]],"edges":[{"from":"fresh","to":"stale","label":"freshUntil 경과"},{"from":"stale","to":"expired","label":"staleUntil 경과"}]}
```

예를 들어 fresh 30초·최대 stale 120초는 상품 설명에는 허용될 수 있지만 접근권한 철회·결제 잔액에는 맞지 않을 수 있습니다. stale을 사용자에게 표시할지, 특정 작업에서는 강제 원본 확인할지도 API 계약입니다.

## 재검증 동시성과 실패 예산

같은 key에 대한 refresh가 동시에 여러 번 시작되면 한 프로세스 안의 여러 요청을 하나의 실행으로 합치는 **singleflight**를 사용할 수 있습니다. 이때 전체 refresh 동시 수·queue bytes·deadline을 함께 제한합니다.

replica가 여러 개면 각 프로세스가 한 번씩 refresh할 수 있으므로, 로컬 singleflight만으로 전체 replica에서 실행이 1회가 되지는 않습니다. 분산 lease를 쓰더라도 lease가 만료된 owner의 늦은 결과가 최신 값을 덮거나 중복 실행을 일으킬 수 있으므로 이에 대비해야 합니다.

실패 시 backoff·jitter·재시도 상한을 두되 요청마다 새 refresh를 무제한 만들지 않습니다. foreground 요청 취소가 공유 refresh 전체를 불필요하게 취소하지 않도록 owner와 수명을 정합니다. 더 최신 version이 cache에 들어갔다면 늦은 refresh가 덮지 못하게 조건부 갱신합니다.

## 적중률과 캐시 정책 평가 지표

부재 hit·일반 hit·stale hit·원본 오류·refresh 중복·가장 오래된 반환값·생성 후 보이는 시간·key churn을 따로 기록합니다. 생성과 늦은 refill, 원본 장기 장애, 모든 key 동시 만료, 권한 철회, refresh 취소를 시험합니다. 이 노트는 캐시 상태와 경쟁 조건의 설계이며 실제 분산 cache 실험 결과는 아닙니다.
