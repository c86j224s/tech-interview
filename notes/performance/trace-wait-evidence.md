---
id: trace-wait-evidence
title: 분산 Trace와 On·Off CPU의 대기 근거
topic: 성능
summary: critical path·pool·실행·lock wait/hold를 분해하고 batch trace link·clock skew·head/tail sampling·전체 지표와 프로파일의 역할을 설명합니다.
questionIds: [distributed-tracing-boundaries, profiling-cpu-offcpu, lock-hold-versus-wait-time, trace-links-batch-causality, trace-clock-skew-duration, observability-trace-sampling]
---

# 분산 Trace와 On·Off CPU의 대기 근거

지연 원인을 찾는 출발점은 “느린 span”의 이름이 아니라 요청 wall time이 어느 대기와 실행 구간으로 구성되는지입니다. 전체 지표로 대표 요청을 고르고 trace로 critical path를 복원한 뒤, profile과 pool·lock·queue 지표를 대조해야 CPU 계산과 자원 대기를 구분할 수 있습니다.

## DB Span 내부의 pool acquire 대기 시간

DB 작업 span이 800ms인데 pool acquire=750ms, query=50ms라면 SQL 최적화만으로 큰 개선을 얻기 어렵습니다. trace는 호출 이름을 붙인 그림보다 실제 대기·자원 획득·실행·결과 decode를 구분할 때 유용합니다.

필수 하위 호출 A=100ms, B=300ms가 병렬이면 두 시간을 단순 합산해 400ms 병목이라고 보지 않습니다.

상태를 숫자로 따라가면 요청 800ms 중 pool acquire 750ms, query 50ms라면 query 튜닝의 최대 효과는 제한적이고 pool 포화·연결 수·상위 queue를 먼저 조사해야 합니다. A와 B가 병렬이면 critical path는 대략 더 긴 B와 join 이후 작업으로 구성되며, trace parent 합계가 wall time과 같지 않을 수 있습니다. lock wait가 길면 기다린 stack뿐 아니라 owner의 hold 구간에서 외부 I/O나 스케줄 정지를 확인합니다.

재현 실습은 pool 대기, CPU busy loop, 긴 lock hold, late span을 각각 만든 뒤 RED 지표·trace·CPU/off-CPU profile의 예상 신호를 표로 남기는 것입니다. tail sampling으로 느린 trace를 골랐더라도 그 표본의 오류율을 전체 오류율로 사용하지 않고, 전체 histogram과 별도로 비교해야 합니다. 응답을 결정하는 critical path·join 대기·순차 후속 작업을 따라야 합니다. 가장 긴 span도 CPU 계산이 아니라 외부 대기일 수 있습니다.

| 구간 | 필요한 관측 | 다른 원인과 구분 |
| --- | --- | --- |
| pool acquire | 대기·활성 연결·보유 시간 | query 실행 |
| queue wait | enqueue·dequeue·oldest age | worker 계산 |
| query·decode | CPU·읽기·반환 bytes | 네트워크·client 전송 |
| lock wait | 획득 시도→성공 | lock hold |
| lock hold | 획득→해제 | 그 안의 외부 대기·스케줄 정지 |

## On-CPU·Off-CPU 시간과 대기 원인

CPU sampling은 CPU를 실제로 사용하던 시점의 stack을 보여 주고, off-CPU·block profile·thread dump는 실행하지 못하고 멈춘 위치를 좁히는 데 도움을 줍니다. off-CPU 시간이 길다는 사실만으로 원인이 lock이라고 결정하지 않고, I/O·pool·scheduler runnable 대기·조건 대기 같은 신호를 관련 trace와 자원 지표에 대조합니다. 그래야 긴 대기가 CPU 계산 때문인지 특정 자원을 기다린 것인지 분리할 수 있습니다.

프로세스 평균 CPU가 낮아도 한 event loop나 한 core가 포화일 수 있어 per-core·run queue·loop lag를 봅니다. 여러 thread의 CPU 시간 합은 한 요청의 wall time보다 클 수 있습니다. 짧은 sampling 창·완료된 대기만 기록하는 도구는 현재 긴 대기·드문 경로를 놓칠 수 있으므로 도구의 정의를 확인합니다.

```diagram
{"title":"전체 지표에서 특정 대기 원인으로 좁힙니다","caption":"화살표는 진단 근거의 연결입니다. trace만으로 CPU 원인을 확정하지 않고 profile·자원 지표로 가설을 검증합니다.","rows":[[{"id":"metric","label":"요청률·오류·지연 분포"}],[{"id":"trace","label":"느린 요청의 critical path"}],[{"id":"boundary","label":"queue·pool·lock·실행 분해"}],[{"id":"profile","label":"CPU·off-CPU·자원 증거"}],[{"id":"compare","label":"동일 부하 변경 전후 비교"}]],"edges":[{"from":"metric","to":"trace","label":"대표 실패 선택"},{"from":"trace","to":"boundary","label":"시간 경계 확인"},{"from":"boundary","to":"profile","label":"원인 가설"},{"from":"profile","to":"compare","label":"실제 효과 확인"}]}
```

## Lock Hold·Wait 사건과 타임라인

한 lock의 wait를 원인과 연결하려면 lock ID·작업 ID·호출 stack에 획득 시도·성공·해제 시각을 붙여 한 타임라인으로 봅니다. 여러 thread에서 wait가 길게 누적돼도 원인은 owner의 짧지만 반복적인 hold일 수 있고, 한 번의 매우 긴 hold일 수도 있습니다. 그래서 기다리는 코드만 고치지 말고 owner가 lock을 잡은 동안 무엇을 하는지 확인합니다.

재진입 lock은 바깥 획득/최종 해제와 깊이를 구분하고 condition wait가 unlock/relock하는 구간을 hold로 잘못 합치지 않습니다. profiling 자체의 타이밍·lock overhead도 측정합니다. 관측을 위해 모든 hot lock에 무거운 문자열 로그를 넣으면 병목을 바꿀 수 있습니다.

## Batch Parent와 다중 producer 인과

여러 producer 요청의 메시지를 한 batch로 처리하면 batch span에 한 parent만 고르면 나머지 인과가 사라집니다. trace link로 원래 producer span들을 연결하고 메시지 ID·논리 batch·물리 시도를 구분합니다. 재전달로 batch 구성이 달라져도 원래 사건을 추적할 수 있어야 합니다.

link 개수·attribute bytes·retention·sampling을 제한합니다. trace ID를 데이터 인가 토큰으로 사용하지 않고 외부 trace 문맥의 길이·형식을 검증합니다. 원문 payload·자격·개인정보는 instrumentation 단계부터 최소화합니다.

## Cross-host 시각 정렬과 clock skew

각 프로세스 duration은 가능한 같은 단조 경과로 측정하고 wall timestamp는 시간축 배치에 사용합니다. clock skew로 child span이 parent보다 먼저 보일 수 있어 ID·parent·message link와 실제 프로토콜 순서를 근거로 해석합니다. 음수 간격을 무조건 0으로 바꿔 원인을 숨기지 않습니다.

수집기 보정이 있어도 정확한 네트워크 시간으로 단정하지 않고 시각 오차·late span·누락을 표시합니다. 동기화 상태·clock jump·프로세스 재시작도 기록합니다. span duration과 여러 서버 timestamp 차이는 같은 정확도를 갖지 않습니다.

## Head·Tail Sampling과 trace 누락 유형

head sampling은 시작 때 정해 비용이 낮지만 드문 끝 오류를 놓칠 수 있습니다. tail sampling은 결과를 보고 느린·실패 trace를 고를 수 있지만 전체 trace 집계·대기 buffer·늦은 span·collector 포화 비용이 있습니다. 마지막 오류 span이 결정 창 뒤에 오면 정상으로 분류해 버렸을 수 있습니다.

오류 우선 trace 표본의 오류율을 전체 요청 오류율로 사용하지 않습니다. 전체 RED 지표·histogram은 적절한 전체 집계 경로에서 계산하고 trace는 개별 원인에 씁니다. 중요한 감사 사건은 trace sampling과 다른 내구 경로가 필요할 수 있습니다. 삭제할 trace라도 민감 데이터는 이미 수집됐을 수 있어 sampling 전 최소화가 중요합니다.

## 계측 신호와 진단 질문의 대응 시험

합성 환경에서는 먼저 pool 지연·CPU 계산·긴 lock·batch 인과·clock skew·late span·collector 장애를 각각 만들어 어느 신호가 trace·profile·전체 지표에 나타나는지 분리합니다. 그런 다음 동일 부하에서 실제 사용자 p99·오류와 관측 overhead를 비교해 계측이 지연을 얼마나 바꿨는지 확인합니다. 현재 작업에서는 운영 trace·profile 수집을 수행하지 않았으며, 본문은 근거를 연결하는 진단 설계입니다.
