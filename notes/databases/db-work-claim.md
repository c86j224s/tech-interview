---
id: db-work-claim
title: SKIP LOCKED 작업 획득과 Lease·세대·공정성
topic: 데이터베이스
summary: 짧은 행 잠금과 내구 실행권을 구분하고 claim 후 중단·lease 만료·늦은 완료·멱등 효과·빈 조회와 FIFO의 한계를 설명합니다.
questionIds: [db-skip-locked-queue]
---

# SKIP LOCKED 작업 획득과 Lease·세대·공정성

## 잠긴 첫 행을 건너뛰면 등록 순서대로 처리되지 않습니다

worker A가 작업 1을 잡고 오래 실행하는 사이 B가 SKIP LOCKED로 작업 2·3을 가져갈 수 있습니다. 즉시 lock 경합을 줄이지만 엄격한 FIFO·기아 방지·정확히 한 번 실행을 보장하는 기능은 아닙니다. 서로 독립적인 작업을 분배하는지, 같은 계정의 선행 변경을 기다려야 하는지 먼저 정합니다.

일반 보고서에서 잠긴 행을 빠뜨리는 것은 잘못된 결과가 될 수 있지만 작업 큐에서는 지금 다른 worker가 소유한 후보를 건너뛰는 것이 유용할 수 있습니다. 선택된 행의 의미가 다릅니다.

## 짧은 Claim 거래가 끝난 뒤에는 Row Lock이 사라집니다

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

정확한 SQL·LIMIT·locking syntax와 엔진 지원은 별도로 맞춥니다. 핵심은 잠금 안에서 실행권 상태를 내구 기록한 뒤 거래를 끝내는 것입니다. 상태 기록 없이 lock만 풀면 다른 worker가 같은 pending 행을 다시 가져갈 수 있습니다. 외부 I/O 내내 거래를 유지하면 연결·lock·snapshot 비용이 커집니다.

| 중단 지점 | 남는 상태 | 복구 |
| --- | --- | --- |
| claim 커밋 전 | 거래 rollback·pending 가능 | 다른 worker 재획득 |
| claim 후 실행 전 | running lease만 남음 | 만료·재시도 정책 |
| 외부 효과 후 완료 기록 전 | 효과는 성공했을 수 있음 | 같은 effect key로 조회·중복 방지 |
| 완료 기록 후 응답 유실 | done 결과 존재 | 결과 재사용 |

## Lease 만료는 옛 Worker의 종료 증명이 아닙니다

worker A가 잠깐 멈춘 사이 lease가 끝나 B가 generation=8로 재획득했다고 합시다. A가 generation=7의 결과로 done을 저장하면 새 owner 상태를 덮을 수 있습니다. 완료 UPDATE에 job ID·owner·generation·허용 state 조건을 포함하고 영향 행 수로 적용 여부를 확인합니다.

```diagram
{"title":"재획득 뒤 옛 세대의 완료는 거절합니다","caption":"화살표는 완료 요청입니다. DB 상태 조건은 job 기록을 보호하고 외부 효과의 중복은 별도 멱등·펜싱 경계에서 보호해야 합니다.","rows":[[{"id":"old","label":"옛 worker · 세대 7"},{"id":"new","label":"현재 worker · 세대 8"}],[{"id":"record","label":"job 현재 generation=8"}],[{"id":"result","label":"세대 8 조건만 완료 적용"}]],"edges":[{"from":"old","to":"record","label":"7 완료 조건 불일치"},{"from":"new","to":"record","label":"8 완료 조건 일치"},{"from":"record","to":"result","label":"원자 UPDATE"}]}
```

하지만 이 조건은 job 행만 보호합니다. A가 이미 외부 결제를 했다면 완료 기록 거절로 결제가 사라지지 않습니다. 외부 저장 지점이 안정된 effect key·fencing을 검사하거나 실제 결과 대사를 지원해야 합니다. 서로 다른 세대가 새 지급 ID를 만들면 중복 효과를 막지 못합니다.

## 순서·기아·빈 조회를 별도로 관측합니다

ORDER BY가 있어도 잠긴 행을 건너뛰므로 엄격한 FIFO가 아닙니다. 오래 잠긴 작업·계속 실패하는 작업이 뒤로 밀릴 수 있어 가장 오래된 eligible 작업·시도 수·lease 경과·재획득을 관찰합니다. backoff·최대 시도·dead-letter·수동 보류와 필요한 키별 선행 상태 검사를 둡니다.

한 번의 빈 결과는 전체 큐가 비었다는 뜻이 아니라 모든 eligible 후보가 잠겨 있거나 지연 상태라는 뜻일 수 있습니다. 과도한 빈 polling을 줄이되 새 작업 발견 지연과 공정성을 유지합니다. claim batch가 너무 크면 한 worker가 많은 작업을 붙잡으므로 실제 활성·대기 바이트 예산과 맞춥니다.

## Claim·효과·완료 사이에 중단을 넣습니다

테스트에서 A가 첫 행을 잠근 동안 B가 다음 행을 받는지 확인합니다. claim 직후 종료·lease 만료·A의 늦은 완료·효과 성공 후 기록 실패를 각각 재현해 최종 effect 수와 job 세대가 맞는지 봅니다. 현재 작업에서는 실제 DB의 SKIP LOCKED 동시 실행을 시험하지 않았습니다. 본문은 내구 실행권 설계입니다.
