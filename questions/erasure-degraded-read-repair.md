---
id: erasure-degraded-read-repair
title: >-
  Erasure-coded 객체에서 shard 하나가 없어 degraded read를 제공할 때 읽기 latency와 repair
  traffic을 어떻게 분리해서 보나요?
difficulty: 중하
category: 분산 시스템
tags:
  - erasure coding
  - degraded read
  - repair
  - latency
related:
  - storage-snapshot-database-consistency
---
# Erasure-coded 객체에서 shard 하나가 없어 degraded read를 제공할 때 읽기 latency와 repair traffic을 어떻게 분리해서 보나요?

## 구두 답변

degraded read는 missing shard를 요청 시점에 남은 shard에서 재구성해 응답하는 동기 경로이고, repair는 재구성한 결과를 새 shard로 durable하게 기록해 이후 정상 read로 돌아가는 백그라운드 경로입니다. 둘을 “읽기 한 번의 복구”로 합치면 읽기 latency와 repair backlog를 측정할 수 없습니다.

MDS/RS형 `k=4,m=2`에서 data shard 하나가 사라졌다고 하겠습니다. 정상 range가 data 1~2개만 읽던 layout이어도 missing data를 계산하려면 profile이 요구하는 4개 shard의 해당 stripe 범위를 병렬로 읽고 decode해야 할 수 있습니다. 따라서 fan-in, 네트워크 왕복, decode CPU, 가장 느린 shard의 tail이 p99에 추가됩니다. repair는 정상 shard를 다시 읽고 새 조각을 쓰며 checksum·generation·durability를 검증하므로 별도 read/write bandwidth를 소비합니다. worker를 늘려 backlog를 줄이면 foreground I/O를 압박할 수 있어 concurrency cap, degraded object 수, 남은 허용 손실, repair age를 함께 기준으로 삼습니다. 읽기 성공은 repair 완료가 아니며 다음 장애 전 복구가 우선입니다.

판단 순서는 먼저 해당 stripe의 유효 조각 수와 요청 범위를 계산하고, 그 다음 정상 경로와 degraded 경로의 shard 수를 비교하는 것입니다. 예를 들어 정상 read가 2개 shard와 1회 왕복으로 끝났는데 degraded read가 4개 shard와 decode를 요구하면, 평균 latency가 아니라 가장 느린 shard와 queue 대기를 p99로 봐야 합니다. repair가 끝나기 전에는 객체 상태를 healthy로 바꾸지 않고 degraded로 표시하여 추가 장애 시 보호 여유를 다시 계산합니다.

## 득점 포인트

- on-demand reconstruction과 durable background repair의 완료 조건을 구분합니다.
- `k=4`에서 작은 range도 4개 shard fan-in을 요구할 수 있는 trace를 제시합니다.
- p99, decode CPU, repair bandwidth, backlog와 다음 장애 여유를 별도 지표로 둡니다.

## 감점 포인트

- parity가 있으므로 degraded latency가 정상 경로와 같다고 말합니다.
- 요청 중 재구성한 바이트가 자동으로 새 shard에 durable하게 기록됐다고 가정합니다.
- repair worker를 늘리면 서비스 p99도 항상 좋아진다고 단정합니다.

## 더 파고들 거리

- slow shard 하나를 기다리지 않는 speculative read와 repair 정합성의 trade-off를 검토해 보세요.
- repair 중 두 번째 shard가 사라졌을 때 응답 가능성, 우선순위, fencing 조건을 정해 보세요.
