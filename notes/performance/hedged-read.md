---
id: hedged-read
title: 느린 읽기의 Hedge와 실제 중복 작업 예산
topic: 성능
summary: 지연된 보조 요청·유효한 첫 성공·replica freshness·상관된 병목·취소의 실제 종료·증폭 예산을 구분합니다.
questionIds: [hedged-requests-tail]
---

# 느린 읽기의 Hedge와 실제 중복 작업 예산

Hedge는 tail latency를 줄이기 위해 한 논리 요청을 여러 물리 시도로 확장하는 선택입니다. 유효한 결과를 고르는 규칙과 실제 loser 종료, 하위 용량 예산을 함께 세지 않으면 지연 개선이 포화를 앞당길 수 있습니다.

## 지연 임계값과 보조 요청 실행 조건

조회 A가 평소 20ms에 끝나지만 일부가 500ms 걸린다면, 80ms까지 유효 응답이 없을 때 B replica로 보조 요청을 보내 먼저 얻은 유효한 결과를 사용할 수 있습니다. 이것이 **헤지 요청**(hedged request)입니다. 시작과 동시에 모두에게 보내는 fan-out과 다르고 실패 후 다시 시도하는 retry와도 겹치는 비용이 있습니다.

80ms는 보편적인 권장값이 아닙니다. 실제 분포·남은 deadline·보조 서버 용량·추가 요청 비용으로 정합니다. 정상 요청 대부분을 복제할 만큼 짧으면 오히려 포화를 키울 수 있습니다.

임계값은 p50·p95·p99 분포와 남은 deadline을 함께 보고 정합니다. 80ms에 B를 시작했는데 남은 deadline이 30ms뿐이면 B는 성공할 가능성이 낮고 증폭만 만들 수 있습니다. 즉시 fan-out, hedge, retry를 attempt timeline으로 그려 동시에 살아 있는 작업 수를 구분합니다.

## 첫 응답과 첫 유효 성공의 선택 기준

빠른 503이나 오래된 replica의 값이 승자가 되어서는 안 되므로, 각 응답의 상태 코드·응답 schema·권한 범위·최소 데이터 version·일관성 요구를 먼저 확인합니다. `read-your-writes token`이 version 42를 요구하는데 B가 version 40을 돌려주면, B가 먼저 도착해도 그 결과를 버리고 다른 replica의 응답이 조건을 만족하는지 확인합니다. 어느 replica도 조건을 만족하지 못하면 전체 deadline 안에서 조건을 만족하는 결과가 없었다는 오류를 명확히 반환합니다.

```diagram
{"title":"지연된 보조 요청과 유효 결과의 선택","caption":"화살표는 요청과 결과 검증입니다. 먼저 도착했다는 사실만으로 승자가 되지 않으며 남은 물리 작업은 별도로 종료를 확인합니다.","rows":[[{"id":"request","label":"논리 조회 · 하나의 deadline"}],[{"id":"a","label":"주 요청 A"},{"id":"b","label":"임계 지연 후 보조 B"}],[{"id":"valid","label":"인가·freshness를 만족한 첫 성공"}],[{"id":"stop","label":"다른 시도 취소·실제 종료 추적"}]],"edges":[{"from":"request","to":"a","label":"즉시 시작"},{"from":"request","to":"b","label":"예산이 있을 때"},{"from":"a","to":"valid","label":"결과 검사"},{"from":"b","to":"valid","label":"결과 검사"},{"from":"valid","to":"stop","label":"승자 확정"}]}
```

A가 503을 10ms에, B가 version 42의 정상값을 90ms에, C가 version 40을 70ms에 돌려주는 경우 승자는 B입니다. 상태·schema·권한·freshness 검사를 통과한 결과만 논리 응답의 후보이며, 조건을 만족하는 응답이 deadline 안에 없으면 명확한 실패로 남깁니다.

## 공유 병목과 Hedge 복제 효과

A와 B가 같은 DB·disk·네트워크 경로·tenant quota를 공유하면 한 경로의 포화가 두 요청을 함께 늦출 수 있어 지연이 상관될 수 있습니다. 따라서 두 독립 지연의 최솟값으로 계산한 기대 개선을 그대로 적용하지 말고, 장애 도메인과 replica 부하를 확인한 뒤 포화하면 hedge를 억제합니다. circuit breaker·retry 정책이 각각 호출을 추가하면 논리 요청 하나가 만드는 전체 물리 시도 수를 합산해 상한을 다시 계산해야 합니다.

| 예산 | 제한하는 대상 |
| --- | --- |
| 논리 요청 deadline | 사용자 전체 대기 |
| 요청별 추가 시도 상한 | 한 조회의 증폭 |
| 서비스 전체 hedge permit | 동시에 남은 중복 실행 |
| 하위 자원별 한도 | 같은 병목으로 몰리는 실제 작업 |

A와 B가 같은 DB pool을 공유하면 독립 replica의 최솟값 가정이 깨질 수 있습니다. 총 attempt/논리 요청, hedge permit, 하위 CPU/IO, tenant quota를 함께 보고, circuit breaker와 retry가 중첩될 때 최대 물리 시도 수를 곱셈이 아니라 실제 정책 그래프로 계산합니다.

## 취소 통지와 물리 작업 종료의 구분

사용자에게 먼저 응답했어도 승자가 아닌 loser의 DB query·network I/O가 남을 수 있으므로, 취소 신호를 보낸 사실만으로 작업이 끝났다고 세지 않습니다. 완료 callback·연결 정리·자원 반환을 확인한 뒤에야, 동시에 살아 있는 hedge 작업 슬롯인 물리 permit을 해제합니다. caller timeout 직후 permit을 되돌리면 아직 실행 중인 중복 작업 수가 한도를 넘어 하위 자원이 더 포화될 수 있습니다.

읽기도 과금·감사·cache 갱신 같은 부수 효과가 있을 수 있습니다. 쓰기에 적용하려면 같은 논리 idempotency key·원자적 중복 억제·재시도 결과 회수가 필요하며 “보통 읽기니까 안전”으로 끝내지 않습니다.

승자 응답을 먼저 보내고 loser에 cancel을 보낸 뒤에도 연결과 query가 남아 있으면 permit은 유지합니다. 완료 callback과 자원 반환을 확인한 시각이 실제 종료 시각이며, caller timeout을 물리 종료로 기록하면 동시 작업 상한을 거짓으로 낮추게 됩니다.

## Tail 지연 개선과 하위 부하 비교

사용자 p99·성공률·총 attempt/논리 요청·B 승리율·취소 후 생존 시간·하위 CPU/IO·timeout을 같은 부하에서 측정합니다. 상관 지연·보조 replica stale·첫 오류·둘 다 성공·취소 실패를 별도 주입합니다. 이 노트는 설계와 검증 기준이며 실제 hedge 부하 시험을 실행한 결과는 아닙니다.

hedge 전후에 p99만 비교하지 말고 성공률, attempt 증폭, B 승리율, loser 생존 시간, 하위 error/IO, deadline 초과를 같은 부하에서 측정합니다. 본문에 적은 결과는 입력과 예측이며 이 환경에서 실제 replica hedge 부하를 실행한 결과가 아닙니다.
