---
id: profiling-cpu-offcpu
title: "서버 CPU 사용률은 낮은데 일부 요청이 오래 걸립니다. 계산이 느린 것과 자원을 기다리는 것을 어떻게 구분하나요?"
answerMinutes: 5
followups: [{"id":"distributed-tracing-boundaries","prompt":"off-CPU 원인을 trace의 서비스·큐·풀 span과 어떤 순서로 대조할까요?"},{"id":"context-switch-overhead","prompt":"낮은 CPU와 높은 컨텍스트 스위치가 함께 보일 때 정상 I/O와 과도한 경쟁을 어떻게 나눌까요?"},{"id":"db-pool-long-transactions","prompt":"쿼리는 짧지만 connection pool 대기가 긴 요청에서 연결을 오래 보유한 트랜잭션을 어떻게 찾을까요?"}]
difficulty: 하
category: 성능
tags:
  - "프로파일링"
  - "대기"
  - "CPU"
related: ["distributed-tracing-boundaries"]
---

# 서버 CPU 사용률은 낮은데 일부 요청이 오래 걸립니다. 계산이 느린 것과 자원을 기다리는 것을 어떻게 구분하나요?

## 구두 답변

CPU 사용률이 낮다는 것은 CPU 계산이 적다는 뜻이지 요청이 자원 대기 없이 빨리 끝난다는 뜻은 아닙니다. 스레드는 lock, DB connection pool, 디스크, 외부 RPC, 큐, 스케줄러를 기다리는 동안 CPU를 쓰지 않습니다. 연결 풀이 가득 차 쿼리 자체는 50ms인데 연결을 750ms 기다리는 요청도 전체 CPU를 낮게 보일 수 있습니다. 또 평균 CPU가 낮아도 한 event loop나 한 코어가 포화일 수 있으므로 코어별 사용률·run queue·event-loop lag·p99를 함께 봐야 합니다. CPU에서 실행된 시간과 실행되지 못한 시간을 나누는 관점을 **온·오프 CPU 프로파일링**(on/off-CPU profiling)이라고 합니다.

### 먼저 요청의 시간선을 좁힙니다
느린 요청 trace에서 DB pool acquire, query, result decode, 외부 호출, lock wait, 애플리케이션 계산을 별도 구간으로 확인합니다. CPU sampling profile은 실제 실행 중인 stack을 잘 보여 주지만 잠든 시간과 짧은 대기를 놓칠 수 있으므로 off-CPU·block profile, thread dump, 런타임별 대기 지표를 결합합니다. 락 대기라면 blocker가 언제 락을 잡았고 락 안에서 외부 호출을 했는지, DB가 원인이면 query execution과 connection acquire를 분리합니다. ‘가장 긴 구간’이 곧 계산 비용이라는 가정은 하지 않겠습니다.

대기 원인이 DB 연결 부족이면 worker를 늘릴수록 pool 대기와 DB 동시 실행 수가 함께 늘 수 있습니다. 외부 rate limit이 병목인데 재시도를 늘려도 회복되지 않고, 단일 event loop가 포화인데 프로세스 전체 평균만 보면 문제를 놓칩니다. 따라서 worker 수·pool 크기·락 범위를 조정하기 전에 하위 자원의 처리율과 queue를 확인하겠습니다. CPU가 낮아도 off-CPU 시간이 줄어드는 변경이 사용자에게 이득인지 p50이 아니라 p95·p99와 오류율로 판단합니다.

### 검증은 같은 부하로 합니다
수정 전후 동일한 요청 분포와 동시성으로 CPU time, off-CPU wait, run queue, pool·락·I/O 대기, 코어별 사용률, p50/p95/p99를 비교합니다. sampling 기간이 짧아 짧은 대기나 드문 경로를 놓칠 수 있으므로 trace와 장시간 지표로 교차 확인합니다. 대기 원인을 찾았다고 모든 작업을 비동기로 바꾸지 않고, 취소·deadline·작업 수명과 하위 서비스의 한도를 유지하는지까지 검증하겠습니다.

wall-clock trace의 1초와 CPU profile의 1초는 같은 의미가 아닙니다. 여러 스레드가 병렬로 실행되면 CPU 시간 합이 wall time보다 클 수 있고, off-CPU의 대기는 락·디스크·스케줄러 중 원인을 자동으로 알려 주지 않습니다. 짧은 대기는 sampling에 빠질 수 있으며 완료된 대기만 기록하는 도구는 현재 대기 중인 요청을 놓칠 수 있으므로 도구의 범위를 확인하겠습니다.

느린 trace에서 connection acquire, query, lock wait, 외부 RPC, 계산을 나누고 pool·락·하위 서비스 지표와 상관시킵니다. DB pool 대기인데 worker를 늘리면 대기자와 DB 동시 실행이 함께 증가할 수 있습니다. 같은 부하에서 p50·p95·p99, on/off-CPU, run queue, 하위 자원 포화, 오류·재시도를 비교해 대기 감소가 실제 사용자 개선인지 확인하겠습니다.

off-CPU 시간이 길다는 사실도 원인 그 자체는 아닙니다. 락 대기, DB 풀 대기, 디스크 대기, 스케줄러에서 선택되지 못한 시간이 서로 다른 처방을 요구합니다. wall-clock trace와 CPU profile의 시간 기준을 맞추고, 대기 이벤트·풀·락·하위 서비스 지표를 상관시켜 원인을 확정하겠습니다.

## 득점 포인트

- 낮은 CPU와 낮은 요청 지연을 동일시하지 않는다.
- trace·CPU·off-CPU·block·thread 도구의 역할과 순서를 제시한다.
- worker 증설의 하위 자원 압박을 p99와 함께 검증한다.

## 감점 포인트

- CPU가 낮으면 서버에 여유가 있다고 결론 낸다.
- CPU sampling 하나로 모든 대기 원인을 찾을 수 있다고 말한다.
- 공유 병목 확인 없이 worker 수부터 늘린다.

## 더 파고들 거리

- 락 보유 중 실행 시간과 락을 기다린 시간을 어떤 이벤트로 나눌까요?
- 짧은 대기를 sampling profile이 놓칠 때 어떤 오판이 생길까요?
- 단일 event loop 포화를 per-core 지표와 trace로 어떻게 확인할까요?
