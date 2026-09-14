---
id: hedged-read
title: 느린 읽기의 Hedge와 실제 중복 작업 예산
topic: 성능
summary: 지연된 보조 요청·유효한 첫 성공·replica freshness·상관된 병목·취소의 실제 종료·증폭 예산을 구분합니다.
questionIds: [hedged-requests-tail]
---

# 느린 읽기의 Hedge와 실제 중복 작업 예산

## 첫 요청이 느릴 때만 다른 경로를 시도합니다

조회 A가 평소 20ms에 끝나지만 일부가 500ms 걸린다면, 80ms까지 유효 응답이 없을 때 B replica로 보조 요청을 보내 먼저 얻은 유효한 결과를 사용할 수 있습니다. 이것이 **헤지 요청**(hedged request)입니다. 시작과 동시에 모두에게 보내는 fan-out과 다르고 실패 후 다시 시도하는 retry와도 겹치는 비용이 있습니다.

80ms는 보편적인 권장값이 아닙니다. 실제 분포·남은 deadline·보조 서버 용량·추가 요청 비용으로 정합니다. 정상 요청 대부분을 복제할 만큼 짧으면 오히려 포화를 키울 수 있습니다.

## 첫 응답이 아니라 첫 유효한 성공을 고릅니다

빠른 503이나 오래된 replica의 값이 승자가 되어서는 안 됩니다. 상태 코드·응답 schema·권한 범위·최소 데이터 version·일관성 요구를 검사합니다. read-your-writes token이 version 42를 요구하는데 B가 40이면 빨라도 사용할 수 없습니다. 어느 replica에서도 조건을 만족하지 못하면 전체 deadline 안에서 오류를 명확히 반환합니다.

```diagram
{"title":"지연된 보조 요청과 유효 결과의 선택","caption":"화살표는 요청과 결과 검증입니다. 먼저 도착했다는 사실만으로 승자가 되지 않으며 남은 물리 작업은 별도로 종료를 확인합니다.","rows":[[{"id":"request","label":"논리 조회 · 하나의 deadline"}],[{"id":"a","label":"주 요청 A"},{"id":"b","label":"임계 지연 후 보조 B"}],[{"id":"valid","label":"인가·freshness를 만족한 첫 성공"}],[{"id":"stop","label":"다른 시도 취소·실제 종료 추적"}]],"edges":[{"from":"request","to":"a","label":"즉시 시작"},{"from":"request","to":"b","label":"예산이 있을 때"},{"from":"a","to":"valid","label":"결과 검사"},{"from":"b","to":"valid","label":"결과 검사"},{"from":"valid","to":"stop","label":"승자 확정"}]}
```

## 서로 같은 병목을 기다리면 복제의 이득이 줄어듭니다

A와 B가 같은 DB·disk·네트워크 경로·tenant quota를 공유하면 지연이 상관될 수 있습니다. 두 독립 지연의 최솟값으로 계산한 기대 개선을 그대로 적용할 수 없습니다. 장애 도메인·replica 부하를 확인하고 포화 시 hedge를 억제합니다. circuit breaker·retry도 각각 추가 호출을 만들면 전체 물리 시도 수가 예상보다 커집니다.

| 예산 | 제한하는 대상 |
| --- | --- |
| 논리 요청 deadline | 사용자 전체 대기 |
| 요청별 추가 시도 상한 | 한 조회의 증폭 |
| 서비스 전체 hedge permit | 동시에 남은 중복 실행 |
| 하위 자원별 한도 | 같은 병목으로 몰리는 실제 작업 |

## 취소 통지는 물리 작업 종료가 아닙니다

사용자 응답을 반환했어도 loser의 DB query·network I/O가 남을 수 있습니다. 취소 요청을 보내고 완료 callback·연결 정리·자원 반환을 확인한 뒤 물리 permit을 해제합니다. caller timeout 때 즉시 예산을 되돌리면 살아 있는 중복 작업 수가 한도를 넘을 수 있습니다.

읽기도 과금·감사·cache 갱신 같은 부수 효과가 있을 수 있습니다. 쓰기에 적용하려면 같은 논리 idempotency key·원자적 중복 억제·재시도 결과 회수가 필요하며 “보통 읽기니까 안전”으로 끝내지 않습니다.

## Tail 개선과 하위 부하를 함께 비교합니다

사용자 p99·성공률·총 attempt/논리 요청·B 승리율·취소 후 생존 시간·하위 CPU/IO·timeout을 같은 부하에서 측정합니다. 상관 지연·보조 replica stale·첫 오류·둘 다 성공·취소 실패를 별도 주입합니다. 이 노트는 설계와 검증 기준이며 실제 hedge 부하 시험을 실행한 결과는 아닙니다.
