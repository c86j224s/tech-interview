---
id: network-tcp-rtt-retransmission-timers
title: TCP RTT 추정과 재전송 타이머
topic: 네트워크
summary: >-
  SRTT·RTTVAR로 RTO를 계산하고 재전송 측정의 모호성을 피하며 timeout backoff와 clock granularity가
  타이머에 미치는 영향을 설명합니다.
questionIds: []
prerequisites:
  - tcp-handshake
  - tcp-throughput
related:
  - tcp-throughput
reviewedAt: '2026-09-19'
---
# TCP RTT 추정과 재전송 타이머

TCP 재전송 타이머의 목적은 “패킷이 조금 늦었으니 다시 보내기”가 아니라, 아직 확인되지 않은 세그먼트가 정상적으로 도착할 시간을 추정하면서도 실제 손실에는 회복하는 것입니다. 그래서 한 번의 RTT를 그대로 타이머로 쓰지 않고, 평활화된 왕복 시간인 SRTT(Smoothed RTT)와 관측 변동성인 RTTVAR(RTT Variation)를 함께 유지합니다. 이 장은 RFC 6298의 알고리즘을 기준으로 초기화, 갱신 순서, 측정 가능한 ACK의 조건, timeout 이후의 backoff를 하나의 시간축으로 추적합니다. 운영체제의 타이머 API가 실제로 언제 콜백을 실행하는지는 이 프로토콜 계산과 별도이므로 마지막에 분리해 검증합니다.

## RTT sample의 의미와 측정 경계

RTT sample은 특정 데이터 세그먼트를 보낸 시각과 그 전송을 확인하는 ACK를 받은 시각의 차이입니다. 여기서 “ACK가 도착했다”는 사실만으로 sample을 만들 수 있는 것은 아닙니다. ACK가 최초 전송을 확인하는지 재전송을 확인하는지 구분할 수 있어야 합니다. 송신 시각을 `t_send`, 확인 시각을 `t_ack`라고 하면 설명용 sample은 `R = t_ack - t_send`이지만, `t_send`가 여러 번 존재하는 세그먼트에는 어떤 전송을 기준으로 할지가 사라집니다.

TCP는 순서 번호와 누적 ACK를 사용하므로 ACK가 특정 물리 패킷을 가리키지 않습니다. 예를 들어 바이트 1000부터 1000바이트를 처음 보냈고 120ms 뒤 ACK=2000을 받았다면 최초 전송의 sample은 120ms로 기록할 수 있습니다. 반대로 같은 범위를 120ms에 재전송한 뒤 40ms 뒤 ACK=2000을 받았다고 합시다. ACK가 160ms 시점의 재전송을 확인했는지, 처음 보낸 세그먼트가 지연되어 도착한 것을 확인했는지 알 수 없다면 160ms 또는 40ms를 estimator에 넣을 근거가 없습니다. 이 경계가 Karn 알고리즘의 출발점입니다.

## 첫 sample 초기화

RFC 6298에서 첫 유효 sample을 `R`이라고 할 때 초기 상태는 다음과 같습니다.

```text
SRTT   = R
RTTVAR = R / 2
RTO    = SRTT + max(G, 4 * RTTVAR)
```

`G`는 구현 시계의 granularity입니다. 첫 RTT가 100ms이고 시계 해상도를 무시할 수 있다고 설명하면 SRTT=100ms, RTTVAR=50ms, 산식 결과 RTO=100+4×50=300ms입니다. 다만 RFC 6298의 권고 하한이 적용되어 계산된 RTO가 1초보다 작으면 1초로 올립니다. 따라서 이 예의 현재 RTO는 300ms가 아니라 1초입니다. “첫 RTT의 네 배”라고만 외우면 RTTVAR 초기값과 최소 RTO를 놓치게 됩니다.

첫 sample은 기존 SRTT와 섞지 않습니다. 연결별 estimator가 비어 있을 때 이전 연결의 RTT를 가져오거나, OS의 timer callback이 빠르게 실행되었다는 이유로 100ms보다 작은 임의의 RTO를 정하는 것은 이 알고리즘의 초기 상태가 아닙니다. SYN 교환에서 얻은 측정과 데이터 전송 단계의 RTO 적용 범위, 초기 RTO의 구현 예외는 실제 스택의 계약으로 따로 확인해야 합니다. 여기서는 RFC 6298의 데이터 타이머 계산 규칙을 설명하며 특정 커널의 상수값을 최신 기본값이라고 주장하지 않습니다.

## estimator 갱신과 timer backoff의 순서

```diagram
{"title":"측정 가능한 ACK만 estimator에 들어갑니다","caption":"재전송된 범위는 ambiguity 때문에 sample에서 제외하고, 유효 sample은 estimator를 갱신합니다. timeout은 별도로 RTO를 두 배로 만듭니다.","rows":[[{"id":"send","label":"최초 전송","detail":["sample 후보"]}],[{"id":"ack","label":"명확한 ACK","detail":["SRTT·RTTVAR 갱신"]}],[{"id":"timer","label":"RTO timer","detail":["timeout이면 두 배"]}]],"edges":[{"from":"send","to":"ack","label":"재전송 없는 확인"},{"from":"ack","to":"timer","label":"새 RTO 적용"},{"from":"send","to":"timer","label":"ACK 전 만료"}]}
```

## 두 번째 sample의 갱신 순서

두 번째 이후 sample `R'`이 들어오면 `RTTVAR`를 먼저 계산하고, 그 다음 `SRTT`를 계산합니다. RFC가 강조하는 것은 RTTVAR 식의 `SRTT`가 갱신 전의 값이어야 한다는 점입니다.

```text
RTTVAR <- (1 - beta) * RTTVAR + beta * |SRTT - R'|
SRTT   <- (1 - alpha) * SRTT   + alpha * R'
RTO    <- SRTT + max(G, 4 * RTTVAR)
```

일반적인 계수 `alpha=1/8`, `beta=1/4`를 사용한다고 하고 첫 sample이 100ms였다고 합시다. 그러면 갱신 전 상태는 SRTT=100, RTTVAR=50입니다. 두 번째 sample이 140ms이면 먼저 오차 `|100-140|=40`을 구합니다. RTTVAR는 `0.75×50 + 0.25×40 = 47.5ms`가 되고, 이어 SRTT는 `0.875×100 + 0.125×140 = 105ms`가 됩니다. 그 결과 RTO는 `105 + 4×47.5 = 295ms`라는 설명용 값이며, 1초 하한을 적용하면 실제 RFC 권고 RTO 표현은 1초입니다.

만약 SRTT를 105ms로 먼저 바꾼 다음 RTTVAR를 계산하면 오차가 `|105-140|=35ms`가 되어 RTTVAR=46.25ms가 됩니다. 차이는 당장 1.25ms뿐이지만 이후 sample이 누적되면 estimator의 궤적이 달라집니다. 더 중요한 것은 구현이 명세의 시간 순서를 어긴다는 점입니다. 병렬 SIMD나 고정소수점 코드로 최적화할 때도 “새 SRTT를 RTTVAR 계산에 사용하지 않는다”는 의존성을 보존해야 합니다.

## RTO 산식과 clock granularity

현재 RTO는 단순한 SRTT가 아니라 평균 지연과 불확실성을 합친 값입니다. RFC 6298의 핵심 식은 `SRTT + max(G, K×RTTVAR)`이며 표준 계수 `K=4`를 사용합니다. `G`를 더하는 것이 아니라 `4×RTTVAR`와 비교해 큰 쪽을 선택합니다. 예를 들어 SRTT=100ms, RTTVAR=10ms, G=10ms이면 변동성 항은 40ms이므로 RTO=140ms입니다. G=80ms인 환경이라면 `max(80,40)=80`이 되어 RTO=180ms가 됩니다.

그 뒤 계산값이 1초보다 작으면 1초로 올리는 권고가 적용됩니다. 따라서 SRTT=100ms, RTTVAR=10ms인 예의 140ms를 실제 timeout firing 시각으로 읽으면 안 됩니다. 이 하한은 짧은 측정값만으로 너무 공격적인 재전송을 하지 않기 위한 보수적 규칙입니다. RFC 본문은 구현이 RTO에 최소 60초 이상의 상한을 둘 수 있다고도 설명하지만, 상한의 실제 값과 timer wheel의 반올림은 이 문서에서 특정하지 않습니다.

`G`와 실제 scheduler 지연도 구분해야 합니다. `G`는 timeout 계산에서 고려할 시계 granularity이고, 운영체제가 바쁜 순간에 1초 timer를 1.04초에 실행하는 현상은 scheduler 지연·timer coalescing·CPU quota의 관찰 문제입니다. 캡처에서 1.04초에 재전송됐다는 이유로 RFC 산식을 1.04초로 바꾸지 않습니다. 계산된 RTO, timer 등록 시각, callback 실행 시각을 각각 로그로 남겨 오차 원인을 분리합니다.

## Karn 규칙과 timestamp 예외

재전송된 세그먼트의 ACK는 RTT sample에서 제외합니다. 이것이 “재전송이 일어난 동안 RTT를 전혀 측정하지 않는다”는 뜻은 아닙니다. 재전송되지 않은 새로운 데이터가 명확히 확인되면 그 데이터의 sample을 사용할 수 있습니다. ACK가 누적되어 여러 범위를 확인하더라도, 어떤 최초 전송과 대응되는지 식별할 수 없는 범위는 보수적으로 버립니다.

TCP timestamp가 송신 시각을 echo하는 계약을 제공해 ambiguity를 제거하는 경우에는 재전송된 데이터의 측정이 가능할 수 있습니다. 다만 캡처에 timestamp 옵션이 보인다는 사실과 실제 estimator가 그 timestamp를 사용한다는 사실은 다릅니다. 양 끝의 timestamp 협상, 옵션 처리, 스택의 측정 구현을 확인해야 합니다. timestamp를 사용하지 않는 경로의 패킷 캡처에 억지로 sample을 복원해 넣지 않습니다.

이 규칙은 RTO가 잠시 보수적으로 유지되는 비용을 감수합니다. 반대로 재전송 ACK를 40ms sample로 넣으면 SRTT와 RTTVAR가 급격히 작아져 다음 손실에서 연쇄 timeout 가능성이 커집니다. 빠른 반응보다 잘못된 확신을 피하는 것이 이 estimator의 우선순위입니다.

## timeout backoff와 재계산

RTO timer가 만료되면 송신자는 해당 세그먼트를 재전송하고 RTO를 두 배로 늘린 뒤 새 값으로 timer를 시작합니다. 설명용 초기 RTO가 1초였다면 첫 만료 뒤 2초, 또 만료되면 4초 간격을 사용합니다. 이 backoff는 같은 경로 지연과 손실이 지속될 때 즉시 같은 시점에 다시 보내 경로 큐를 더 압박하는 일을 줄입니다. RFC 6298은 두 배 연산에 상한을 둘 수 있도록 허용하지만 실제 상한은 구현 정책입니다.

timeout으로 인한 재전송은 Karn 규칙 때문에 보통 estimator에 sample을 만들지 못합니다. 이후 재전송되지 않은 세그먼트의 유효 sample이 들어오면 SRTT·RTTVAR를 갱신하고 RTO를 다시 계산할 수 있습니다. 즉 backoff 값은 영구적인 새 RTT 추정값이 아니라 현재 timeout 상황의 일시적 확대입니다. 구현이 새 sample을 받은 뒤에도 무조건 4초를 유지하면 RFC 계산과 backoff 상태를 혼합한 것입니다.

RFC 6298은 재전송 timeout 발생 후 SRTT와 RTTVAR를 지울 수 있다는 선택지도 언급합니다. 이 선택은 해당 값이 오래된 상황에서 더 이상 믿을 수 없다고 판단할 때의 정책이지 모든 timeout마다 필수 reset이라는 뜻은 아닙니다. 연결의 재시작·유휴 시간·새 데이터 도착 여부와 실제 스택의 선택을 확인합니다.

## 구현 선택과 상태 추적

연결별 상태에는 최소한 `srtt`, `rttvar`, 현재 `rto`, `clock_granularity`, timer가 걸린 세그먼트의 송신 시각, 재전송 여부를 연결할 식별자가 필요합니다. 세그먼트마다 “최초 송신인지”, “재전송되었는지”, “timestamp로 식별 가능한지”를 기록하지 않으면 Karn 적용 여부를 사후에 판정하기 어렵습니다. 누적 ACK를 처리할 때도 sample 후보가 여러 송신 범위를 가로지르면 가장 보수적인 규칙을 적용합니다.

고정소수점으로 구현할 때 `R/2`, `4×RTTVAR`, 두 배 backoff의 오버플로를 별도 검사합니다. 밀리초 정수로 반올림하면 작은 RTT에서 RTTVAR가 0으로 떨어질 수 있으므로 `G`가 0 변동성 항을 보완하는지 확인합니다. timer wheel을 쓴다면 계산된 deadline과 bucket으로 반올림된 실행 시각을 별도 필드로 보존합니다. 이 내용은 실행 성공을 주장하는 코드가 아니라, 구현 검토에서 필요한 상태와 불변식을 보여 주는 설명용 추적입니다.

```text
첫 sample R=100ms
  SRTT=100, RTTVAR=50, 산식 RTO=300 -> 1초 floor
두 번째 R'=140ms
  old SRTT=100을 사용해 RTTVAR=47.5
  이후 SRTT=105, 산식 RTO=295 -> 1초 floor
timeout
  RTO=1초 -> backoff RTO=2초
```

## 실패 사례와 검증 기준

첫째, RTT sample을 패킷 캡처의 모든 ACK 간격으로 계산하면 delayed ACK·누적 ACK·재전송 ambiguity가 섞입니다. 둘째, 새 SRTT를 먼저 기록하면 RTTVAR 오차가 달라집니다. 셋째, RTO=140ms라는 계산값을 곧바로 실제 firing 시간으로 말하면 1초 floor와 scheduler 지연을 빠뜨립니다. 넷째, timeout 때마다 RTO를 같은 값으로 유지하면 반복 손실에서 재전송 군집이 생깁니다.

검증은 정상 데이터의 단일 sample, 변동하는 두 번째 sample, 재전송된 범위의 ACK, timestamp가 없는 경로, timeout 연속 발생, 새 유효 sample 회복의 여섯 trace로 나눕니다. 각 trace에 `sample accepted/rejected` 이유, 갱신 전후 SRTT·RTTVAR·RTO, timer deadline과 실제 callback 시간을 기록합니다. 작은 로컬 계산으로 위 숫자를 대조할 수 있지만 특정 커널의 실제 timer firing을 실행한 결과로 포장하지 않습니다.

## 비용과 적용 범위

SRTT와 RTTVAR를 유지하는 메모리 비용은 연결마다 상수 수준이지만, 정확한 sample 판별을 위한 송신 이력과 timestamp 처리에는 추가 상태가 듭니다. 너무 보수적인 RTO는 손실 회복을 늦추고, 너무 공격적인 RTO는 spurious retransmission과 혼잡을 키웁니다. 애플리케이션의 HTTP retry, 메시지 큐 재시도, SYN 재시도는 TCP RTO와 별개의 정책이므로 하나의 숫자로 통합하지 않습니다.

이 장의 수식과 순서는 RFC 6298, 2011년 6월 문서에 근거합니다. 후속 표준이나 특정 OS의 세부 구현을 최신 규칙이라고 가정하지 않았습니다. 실제 운영 결론을 내릴 때는 사용 중인 스택의 timestamp 사용 여부, RTO 상한, 초기 SYN/data timer, timer coalescing을 확인해야 합니다.

## 참고 자료

- RFC 6298, “Computing TCP's Retransmission Timer”, https://www.rfc-editor.org/rfc/rfc6298.txt
- RFC 5681, “TCP Congestion Control”, https://www.rfc-editor.org/rfc/rfc5681.txt
- 기존 학습 노트: `notes/networking/tcp-throughput.md`
