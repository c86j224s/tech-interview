---
id: rate-burst
title: Rate·Burst·가중 비용·동시성 제한
topic: 설계
summary: 고정/슬라이딩 window와 token bucket의 시간 범위를 비교하고 원자 충전·가중 차감·큰 작업·분산 총량·재시작·장애 정책을 설명합니다.
questionIds: [rate-limiting-algorithms, rate-limit-weighted-request-cost]
---

# Rate·Burst·가중 비용·동시성 제한

## 분당 한도와 임의 구간 한도

고정 minute window에서 12:00:59에 100개, 12:01:00에 100개를 허용하면 각 분의 한도는 지켰지만 2초에 200개가 몰립니다. 고정 구간 정산에는 설명이 쉬워도 부드러운 유입 제한과 같지 않습니다. sliding log는 실제 최근 구간을 볼 수 있지만 timestamp 저장·정리 비용이 들고 sliding counter는 근사 방식의 오차를 정의해야 합니다.

**token bucket**은 충전률 r과 용량 B를 나눕니다. r=10 token/s, B=20에서 가득 찬 상태라면 즉시 20개, 이후 1초의 추가 충전 10개를 사용할 수 있습니다. 길이 t 구간에 허용되는 비용은 이상적인 연속 충전 모델에서 최대 B+r·t로 제한됩니다. 정확한 구현의 경계·시간 단위를 확인합니다.

## 원자적 검사·차감

```text
under one atomic state update:
  elapsed = max(0, now - last)
  tokens = min(B, tokens + elapsed * r)
  last = now
  if cost > B: return TooLargeForThisBucket
  if tokens < cost: return Limited
  tokens -= cost
  return Allowed
```

여러 요청이 같은 bucket 상태를 읽는 순간 각각 남은 token이 충분해 보이더라도, 검사와 차감을 하나의 atomic state update 안에서 끝내 각 요청이 같은 남은 token을 동시에 차감하지 않게 합니다. 시간은 권위 계산 지점의 monotonic/저장소 시간 계약으로 다루고 여러 host의 벽시계를 무작정 섞지 않습니다. 상태가 eviction되거나 restart될 때 매번 full bucket으로 시작하면 초기화가 반복될수록 전체 허용량이 늘 수 있으므로, 그 재시작·상태 유실 정책도 한도 계산에 포함합니다.

| 제한 | 의미 | 별도로 필요한 것 |
| --- | --- | --- |
| refill rate | 지속 허용 비용 | burst 크기 |
| bucket capacity | 저장된 순간 여유 | backend 동시 실행 |
| weighted cost | 요청별 추정 부담 | 자원별 실제 hard limit |
| concurrency limit | 살아 있는 실행 수/비용 | 대기 queue 상한 |
| queue limit | 대기 수·bytes·age | 과부하 거절·만료 |

## 대형 요청의 Token 비용과 무한 대기 방지

작은 조회 1, 큰 보고서 20으로 차감할 수 있으나 하나의 숫자가 CPU·memory·DB I/O를 정확히 대표하지는 않습니다. 추정과 실제 비용을 측정하고 자원별 동시성·bytes 상한도 둡니다. B=10인데 cost=20이면 기다려도 영원히 허용되지 않으므로 분할·별도 큐·거절 정책이 필요합니다.

```diagram
{"title":"Rate를 통과해도 실행과 대기의 별도 예산이 남습니다","caption":"화살표는 수락 단계입니다. 토큰은 시간당 비용이고 permit은 실제 실행 수명에 묶여 서로 대체하지 않습니다.","rows":[[{"id":"request","label":"인증된 범위·요청별 비용"}],[{"id":"rate","label":"rate·burst token 검사"}],[{"id":"queue","label":"bounded queue·deadline"}],[{"id":"run","label":"실행 permit·자원별 한도"}],[{"id":"finish","label":"실제 완료 후 실행 예산 반환"}]],"edges":[{"from":"request","to":"rate","label":"원자 차감"},{"from":"rate","to":"queue","label":"허용된 수요"},{"from":"queue","to":"run","label":"유효 작업만"},{"from":"run","to":"finish","label":"취소 통지와 구분"}]}
```

## 로컬·전역 한도의 총량 산정 차이

instance마다 100/s이면 10개에서 1000/s이고 scale-out 뒤 총량이 바뀝니다. 전역 원자 저장소는 정확한 공유를 돕지만 왕복·hot key·장애를 추가합니다. 할당된 로컬 예산은 재배치·반환·오차 상한을 정해야 전역 약속과 연결됩니다.

IP만 제한하면 공유 NAT 사용자가 같이 막힐 수 있고 계정만 보면 여러 계정으로 분산되는 남용을 놓칠 수 있습니다. IP·계정·tenant·API key의 역할을 나누며 관련 인가도 별도 적용합니다. 보안상 민감한 로그인과 일반 API는 저장소 장애 시 fail-open/closed 비용이 다릅니다.

## 거절·재시도 관측

정책에 맞는 Retry-After·backoff·jitter를 안내하되 client가 반드시 따르리라 가정하지 않습니다. window 경계·burst·cost>B·instance 증감·상태 유실·hot key·저장소 장애를 시험하고 허용 비용·큰 작업 기아·작은 요청 p99·오탐·retry 증폭을 봅니다. 이 노트는 제한 모델이며 분산 limiter 부하 시험 결과는 아닙니다.
