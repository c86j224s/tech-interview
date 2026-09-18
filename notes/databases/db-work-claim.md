---
id: db-work-claim
title: SKIP LOCKED 작업 획득과 Lease·세대·공정성
topic: 데이터베이스
summary: 짧은 행 잠금과 내구 실행권을 구분하고 claim 후 중단·lease 만료·늦은 완료·멱등 효과·빈 조회와 FIFO의 한계를 설명합니다.
questionIds: [db-skip-locked-queue]
---

# SKIP LOCKED 작업 획득과 Lease·세대·공정성

작업 큐의 핵심은 짧은 DB 행 잠금과 오래 걸리는 실제 작업의 실행권을 분리하는 데 있습니다. 잠금은 후보를 동시에 고르는 순간만 보호하고, 커밋된 claim·lease·generation이 트랜잭션 밖에서도 현재 worker를 식별하도록 만들어야 중단·재획득·늦은 완료를 설명할 수 있습니다.

## 잠금 행 건너뛰기와 FIFO·기아의 한계

worker A가 작업 1을 잡고 오래 실행하는 사이 B가 SKIP LOCKED로 작업 2·3을 가져갈 수 있습니다. 즉시 lock 경합을 줄이지만 엄격한 FIFO·기아 방지·정확히 한 번 실행을 보장하는 기능은 아닙니다. 서로 독립적인 작업을 분배하는지, 같은 계정의 선행 변경을 기다려야 하는지 먼저 정합니다.

일반 보고서에서 잠긴 행을 빠뜨리는 것은 잘못된 결과가 될 수 있지만 작업 큐에서는 지금 다른 worker가 소유한 후보를 건너뛰는 것이 유용할 수 있습니다. 선택된 행의 의미가 다릅니다.

## Claim 거래 종료와 Row Lock 해제 시점

```text
begin transaction
  select a bounded set of eligible jobs
      ordered by available_at, id
      for update skip locked
  update selected jobs:
      state = running
      owner = worker_id
      generation = generation + 1
      lease_until = authoritative_deadline
commit
execute claimed jobs outside the transaction
```

위 순서에서 A는 선택한 행에 `state='running'`, `owner`, `generation`, `lease_until`을 함께 내구적으로 기록하고 COMMIT해야, 그 COMMIT이 성공하고 lease가 유효한 동안 다른 worker가 그 행을 `pending`으로 다시 가져가지 않습니다. `FOR UPDATE SKIP LOCKED`와 `LIMIT`의 정확한 SQL·locking syntax 및 엔진 지원 범위는 DBMS별로 맞춰야 하며, 이 설명은 특정 문법을 단정하지 않습니다.

커밋 뒤 외부 I/O를 수행하면 실행 중인 transaction이 연결·lock·snapshot을 계속 붙잡지 않습니다. 반대로 상태를 기록하지 않고 lock만 풀거나 외부 I/O 내내 transaction을 열어 두면 각각 중복 claim 또는 연결·lock·snapshot 비용이 커집니다.

| 중단 지점 | 남는 상태 | 복구 |
| --- | --- | --- |
| claim 커밋 전 | 거래 rollback·pending 가능 | 다른 worker 재획득 |
| claim 후 실행 전 | running lease만 남음 | 만료·재시도 정책 |
| 외부 효과 후 완료 기록 전 | 효과는 성공했을 수 있음 | 같은 effect key로 조회·중복 방지 |
| 완료 기록 후 응답 유실 | done 결과 존재 | 결과 재사용 |

## Lease 만료와 옛 Worker 종료의 분리

worker A가 멈춘 사이 lease가 만료되어 B가 같은 job을 `generation=8`로 다시 claim했다고 합시다. A의 `generation=7` 완료 요청은 `job_id`, `owner`, `generation=7`, `state='running'`을 `WHERE`에 넣은 조건부 UPDATE로 보내고, 반환된 영향 행 수가 0이면 `done`으로 바꾸지 않습니다. 상태를 시간순으로 적으면 `A: pending,g=7 → running,g=7 → lease 만료`, `B: running,g=8`, `A 완료 UPDATE: 0행`입니다. 여기서 0행은 A의 작업이 실제로 아무 효과도 내지 않았다는 뜻이 아니라, 현재 job 상태에 대한 A의 기록 권한이 없어졌다는 뜻입니다. 따라서 효과 저장소의 멱등 키·fencing 결과와 job UPDATE 결과를 함께 대사해야 합니다.


```diagram
{"title":"재획득 뒤 옛 세대의 완료는 거절합니다","caption":"화살표는 완료 요청입니다. DB 상태 조건은 job 기록을 보호하고 외부 효과의 중복은 별도 멱등·펜싱 경계에서 보호해야 합니다.","rows":[[{"id":"old","label":"옛 worker · 세대 7"},{"id":"new","label":"현재 worker · 세대 8"}],[{"id":"record","label":"job 현재 generation=8"}],[{"id":"result","label":"세대 8 조건만 완료 적용"}]],"edges":[{"from":"old","to":"record","label":"7 완료 조건 불일치"},{"from":"new","to":"record","label":"8 완료 조건 일치"},{"from":"record","to":"result","label":"원자 UPDATE"}]}
```

다만 이 `WHERE` 조건은 DB의 job 행만 보호합니다. A가 세대 7에서 외부 결제를 먼저 성공시킨 뒤 완료 UPDATE가 0행이 되어도, 완료 기록이 적용되지 않았을 뿐 결제는 이미 남아 있습니다. 따라서 외부 저장 지점도 안정된 `effect key`로 같은 효과의 재요청을 구분하거나 세대가 늦은 요청을 거부하는 `fencing`을 검사해야 하며, 이를 지원하지 않으면 실제 결과를 대사해야 합니다. 세대마다 새 지급 ID를 만들기만 하면 A와 B가 서로 다른 ID로 결제해 중복 효과를 막지 못합니다.

## 순서·기아·빈 조회의 분리 관측

ORDER BY가 있어도 잠긴 행을 건너뛰므로 엄격한 FIFO가 아닙니다. 오래 잠긴 작업·계속 실패하는 작업이 뒤로 밀릴 수 있어 가장 오래된 eligible 작업·시도 수·lease 경과·재획득을 관찰합니다. backoff·최대 시도·dead-letter·수동 보류와 필요한 키별 선행 상태 검사를 둡니다.

한 번의 빈 결과는 전체 큐가 비었다는 뜻이 아니라 모든 eligible 후보가 잠겨 있거나 지연 상태라는 뜻일 수 있습니다. 과도한 빈 polling을 줄이되 새 작업 발견 지연과 공정성을 유지합니다. claim batch가 너무 크면 한 worker가 많은 작업을 붙잡으므로 실제 활성·대기 바이트 예산과 맞춥니다.

## Claim·효과·완료 사이의 중단 지점

테스트에서 A가 첫 행을 잠근 동안 B가 다음 행을 받는지 확인합니다. claim 직후 종료·lease 만료·A의 늦은 완료·효과 성공 후 기록 실패를 각각 재현해 최종 effect 수와 job 세대가 맞는지 봅니다. 실제 검증에서는 두 worker를 동시에 시작해 A가 첫 후보의 transaction을 잡은 동안 B가 다음 후보를 받는지 확인하고, claim commit 전·후를 강제 종료합니다. 그다음 lease 만료 후 옛 generation 완료와 외부 효과 후 완료 기록 실패를 재현해, 최종 job 상태만이 아니라 외부 effect 수까지 예상한 멱등 결과와 일치하는지 봅니다.

현재 작업에서는 실제 DB의 SKIP LOCKED 동시 실행을 시험하지 않았습니다.
