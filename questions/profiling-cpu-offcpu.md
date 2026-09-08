---
id: profiling-cpu-offcpu
title: "서버 CPU 사용률은 낮은데 일부 요청이 오래 걸립니다. 계산이 느린 것과 자원을 기다리는 것을 어떻게 구분하나요?"
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

낮은 CPU는 계산이 적다는 뜻일 뿐 요청이 빨리 끝난다는 뜻은 아닙니다. 스레드가 lock·DB connection pool(동시에 사용할 수 있는 DB 연결 묶음)·디스크·외부 RPC(원격 서비스 호출)·스케줄러를 기다리는 동안 CPU를 쓰지 않을 수 있습니다. 예를 들어 연결 풀이 모두 사용 중이면 쿼리 자체가 빠르더라도 요청은 풀 반환을 기다리며 느려집니다. 전체 평균이 낮아도 하나의 event loop나 단일 코어가 포화일 수 있으므로 코어별 사용률, run queue, event-loop lag와 요청 p99를 함께 확인하겠습니다.

먼저 distributed trace로 느린 요청의 구간을 DB 대기·외부 호출·애플리케이션 계산으로 좁힙니다. lock 경합이면 blocker의 stack과 보유 시간, lock 안에서 외부 호출을 하는지 확인하고, DB가 원인이면 query 실행 시간과 connection pool 대기 시간을 분리합니다. CPU sampling profile만으로는 잠든 시간과 대기 원인을 충분히 볼 수 없으므로 off-CPU/block profile·thread dump·런타임별 대기 지표를 조합합니다.

원인을 찾았다고 무조건 worker를 늘리지 않습니다. 공유 lock·외부 rate limit(상대 서비스가 허용하는 호출 상한)·DB pool을 더 압박할 수 있기 때문입니다. 대기 원인이 DB 연결 부족인데 worker만 늘리면 대기 요청과 연결 경쟁이 함께 증가합니다. 동일한 부하에서 수정 전후 p50/p95/p99(느린 요청의 백분위수), 대기 분포, 오류율, 하위 시스템 포화를 비교하고, sampling 기간·도구가 보여 주는 현재/완료 대기의 의미도 기록해 프로파일의 누락을 과해석하지 않겠습니다.

## 득점 포인트

- 낮은 CPU와 낮은 대기를 구분하고 단일 코어 병목을 포함한다.
- trace→구간 분해→off-CPU·block·thread 도구의 순서를 제시한다.
- worker 증가 대신 동일 부하의 tail latency와 하위 포화를 검증한다.

## 감점 포인트

- CPU가 낮으니 서버는 여유롭고 정상이라고 말한다.
- CPU profile 하나로 모든 대기 원인을 찾을 수 있다고 말한다.
- 공유 병목을 확인하지 않고 worker 수부터 늘린다.

## 더 파고들 거리

- 락 소유자가 실행한 시간과 스케줄되지 못한 시간을 어떤 이벤트로 구분할까요?
- sampling profile이 짧은 대기·짧은 함수 호출을 놓칠 때 어떤 해석 오류가 생기나요?
- 평균 CPU가 단일 event loop 포화를 숨길 때 어떤 per-core 지표와 trace를 결합할까요?
