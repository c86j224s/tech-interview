---
id: index-row-layout
title: 보조 인덱스의 행 위치·Covering·쓰기 경합
topic: 데이터베이스
summary: 논리 PK와 물리 저장을 구분하고 InnoDB·SQL Server·PostgreSQL locator·visibility map·키 폭·순차 삽입 latch 비용을 설명합니다.
questionIds: [clustered-secondary-index, heap-clustered-row-lookup, db-covering-index-visibility, sequential-key-page-contention]
---

# 보조 인덱스의 행 위치·Covering·쓰기 경합

## 고객 키를 찾은 뒤 원본 행을 다시 읽을 수 있습니다

고객 ID 인덱스로 주문 10만 개를 찾았어도 금액·배송지·상태가 인덱스에 없으면 원본 행을 추가로 읽어야 합니다. 후보 탐색이 빨라도 수많은 랜덤 페이지 접근과 반환 바이트가 전체 비용을 지배할 수 있습니다. seek가 보인다는 이유만으로 빠른 쿼리라고 결론 내리지 않습니다.

primary key는 논리 식별 제약이고 클러스터링은 행 저장 구조의 선택입니다. 모든 DB가 PK를 같은 물리 구조로 저장하는 것은 아닙니다.

## Locator는 엔진마다 다릅니다

| 엔진·구조 | 보조 인덱스 뒤 접근의 개념 | 주의점 |
| --- | --- | --- |
| InnoDB | 보조 키에서 primary key로 clustered 행 탐색 | PK 폭이 여러 보조 인덱스에 반복될 수 있음 |
| SQL Server clustered table | nonclustered locator로 clustering key 사용 | key lookup·비고유 키의 추가 정보 |
| SQL Server heap | RID 기반 행 접근 | forwarded record 등 추가 접근 가능 |
| PostgreSQL heap | tuple 위치와 MVCC 가시성 확인 | CLUSTER가 항상 유지되는 자동 저장 순서는 아님 |

이는 대표 저장 모형입니다. 버전·압축·포함 열·특수 인덱스에 따른 세부는 실제 메타데이터와 계획으로 확인합니다. 물리적으로 정렬된 리프라도 SQL 결과 순서는 ORDER BY로 요구해야 합니다.

```diagram
{"title":"보조 키 탐색과 원본 행 접근을 따로 셉니다","caption":"화살표는 조회 경로입니다. locator가 물리 위치인지 다른 트리의 키인지에 따라 추가 읽기와 가시성 검사 비용이 달라집니다.","rows":[[{"id":"secondary","label":"고객 보조 인덱스 구간"}],[{"id":"locator","label":"행 위치 또는 clustering key"}],[{"id":"row","label":"원본 행·버전 가시성"}],[{"id":"result","label":"요청 컬럼 반환"}]],"edges":[{"from":"secondary","to":"locator","label":"후보별 locator"},{"from":"locator","to":"row","label":"추가 lookup"},{"from":"row","to":"result","label":"필터·결과 구성"}]}
```

## Covering은 구조적 가능성이고 실제 Heap 접근은 별도입니다

필요 컬럼을 모두 가진 인덱스는 데이터 관점에서 covering입니다. PostgreSQL의 index-only scan은 해당 인덱스가 값을 반환할 수 있고 필요한 열이 포함되는 것 외에 MVCC 가시성을 확인해야 합니다. heap page가 visibility map에서 all-visible이면 heap 접근을 피할 수 있지만 최근 쓰기로 그 조건이 달라지면 Heap Fetches가 남습니다.

계획에 Index Only Scan이 있어도 Heap Fetches가 0이라는 뜻은 아닙니다. 읽기 위주 오래된 페이지와 최근 갱신 페이지를 나눠 봅니다. 다른 엔진의 covering·버전 검사도 별도 계약이므로 PostgreSQL 설명을 그대로 일반화하지 않습니다.

INCLUDE는 반환 데이터를 싣는 역할이며 key 열처럼 모든 탐색·정렬 조건에 같은 역할을 주는 것은 아닙니다. 지원 문법·압축·중복 처리도 엔진마다 다릅니다. 반환 컬럼을 전부 넣으면 인덱스가 넓어져 같은 메모리에 덜 들어가고 모든 쓰기의 로그·페이지 비용이 커집니다.

## 키 폭이 다른 인덱스까지 반복될 수 있습니다

clustering key가 보조 인덱스 locator로 저장되는 모형에서 8바이트 ID 대신 긴 문자열 키를 쓰면 각 보조 인덱스의 리프 크기·fan-out·비교·캐시 비용이 늘 수 있습니다. 커서 전송의 넓은 키 비용도 별도입니다. 짧은 키를 고르되 유일성·정렬·업무 의미를 몰래 잃지 않습니다.

전체 clustering key를 바꾸는 작업은 테이블·보조 인덱스 재구성과 로그·디스크·잠금 비용을 만들 수 있습니다. 읽기 이득만 측정하고 쓰기·백업·유지보수 비용을 제외하지 않습니다.

## 순차 키는 분할을 줄여도 마지막 페이지가 뜨거울 수 있습니다

증가하는 키는 끝쪽 삽입으로 무작위 위치의 페이지 분할을 줄일 수 있지만 고동시 삽입이 마지막 리프 페이지의 latch를 경쟁할 수 있습니다. latch는 짧은 내부 페이지 보호이고 거래 lock 대기와 동일한 개념이 아닙니다. 실제 wait 분류로 확인합니다.

임의 키는 위치가 분산되지만 페이지 분할·채움률·랜덤 I/O·캐시 지역성 비용을 늘릴 수 있습니다. 시간 정렬 ID도 완전한 전역 순서를 보장하는지는 생성기·시계·동점 규칙에 달렸습니다. 엔진의 순차 키 최적화·fill factor 같은 기능은 해당 workload와 버전에서 검토합니다.

## 적은 결과·큰 결과·쓰기 부하를 같이 비교합니다

고객별 1개·100개·10만 개 결과에서 실제 행·읽은 페이지·lookup·Heap Fetches·반환 바이트를 측정합니다. covering 전후의 쓰기 p99·로그량·인덱스 크기와 순차·임의 키의 latch·분할을 별도로 봅니다. 현재 작업에서 이 세 엔진의 저장 구조를 실행 측정하지 않았습니다. 본문은 비용 경계와 검증 설계입니다.
