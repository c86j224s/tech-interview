---
id: network-tcp-congestion-control
title: TCP 혼잡 제어의 slow start와 AIMD
topic: 네트워크
summary: >-
  cwnd·ssthresh·FlightSize를 기준으로 slow start, additive increase, duplicate ACK
  fast retransmit, timeout 반응을 구분합니다.
questionIds: []
prerequisites:
  - tcp-throughput
related:
  - tcp-throughput
reviewedAt: '2026-09-19'
---
# TCP 혼잡 제어의 slow start와 AIMD

TCP sender가 보낼 수 있는 양은 수신자의 `rwnd`와 경로 혼잡을 반영하는 `cwnd` 중 작은 값에 의해 제한됩니다. 이 둘은 모두 “window”라는 이름을 가지지만 책임이 다릅니다. `rwnd`는 receiver가 버퍼와 애플리케이션 소비율에 맞춰 광고하는 흐름 제어이고, `cwnd`는 공유 경로에서 outstanding data를 늘리거나 줄이는 혼잡 제어 상태입니다. 이 장은 RFC 5681의 기본 알고리즘을 기준으로 `ssthresh` 아래의 slow start, 그 위의 congestion avoidance, duplicate ACK 기반 fast retransmit, timeout 반응, 그리고 threshold를 `FlightSize`로 계산하는 이유를 하나의 상태 추적으로 설명합니다.

## 송신 한도와 상태 변수

송신자가 새 데이터를 더 보낼 수 있는지는 대략 `min(cwnd, rwnd) - FlightSize`로 생각할 수 있습니다. `FlightSize`는 아직 누적 ACK로 확인되지 않은 전송량이고, `cwnd`는 그 양이 경로에 얼마나 떠 있을 수 있는지에 대한 sender의 허용 한도입니다. `rwnd`가 작으면 receiver가 느려서 막힌 것이고, `cwnd`가 작으면 손실·지연·ECN 같은 혼잡 신호에 sender가 반응한 것입니다. 둘이 동시에 작아질 수 있으므로 한 값만 보고 원인을 단정하지 않습니다.

`ssthresh`는 slow start와 congestion avoidance의 경계를 선택하는 상태입니다. RFC 5681은 `cwnd < ssthresh`이면 slow start, `cwnd > ssthresh`이면 congestion avoidance를 사용하고, 같을 때는 어느 쪽을 사용해도 된다고 설명합니다. 초기 `ssthresh`는 실제 경로를 알기 전에는 크게 시작할 수 있지만 혼잡 신호가 오면 감소합니다. 이 값은 링크 속도나 서버 CPU의 임의 상수가 아니라 연결별 제어 상태입니다.

## slow start의 ACK 기반 증가

slow start라는 이름은 전송 시작을 조심스럽게 시작한다는 뜻이지, window가 느리게 커진다는 뜻이 아닙니다. RFC 5681의 기본 규칙은 새 데이터가 확인된 ACK마다 `cwnd`를 최대 SMSS(segment 최대 크기)만큼 증가시키는 것입니다. 설명용으로 초기 `cwnd=2 SMSS`, `ssthresh=8 SMSS`라면 두 세그먼트가 각각 새 데이터를 확인한 뒤 cwnd가 3, 4 SMSS로 증가할 수 있습니다. 다음 RTT에 더 많은 데이터를 보내고 ACK가 그만큼 돌아오면 창이 빠르게 커집니다.

```diagram
{"title":"ACK 증가가 threshold에서 모드를 바꿉니다","caption":"cwnd는 ACK로 커지고 ssthresh를 경계로 slow start와 congestion avoidance가 나뉩니다. 손실 사건은 별도의 감소 경로로 들어갑니다.","rows":[[{"id":"ack","label":"새 데이터 ACK","detail":["확인된 N 바이트"]}],[{"id":"grow","label":"cwnd 증가","detail":["slow start: 최대 SMSS","congestion avoidance: 대략 1 SMSS/RTT"]}],[{"id":"threshold","label":"ssthresh 경계","detail":["cwnd와 비교해 모드 선택"]}],[{"id":"loss","label":"손실 신호","detail":["dup ACK 또는 timeout"]}]],"edges":[{"from":"ack","to":"grow","label":"ACK 기반 갱신"},{"from":"grow","to":"threshold","label":"상태 비교"},{"from":"threshold","to":"loss","label":"손실 시 별도 전이"}]}
```

실제 증가량이 매 RTT 정확히 두 배라고 말하면 delayed ACK, partial ACK, Appropriate Byte Counting 같은 조건을 숨기게 됩니다. RFC 5681은 `cwnd += min(N, SMSS)` 형태를 설명하며 N은 새로 확인된 바이트 수입니다. 따라서 ACK가 묶여 오거나 한 ACK가 부분적인 범위를 확인하면 증가가 달라집니다. 최신 스택의 초기 window와 확장 알고리즘은 RFC 5681의 기본 설명과 별도 버전·구현 계약으로 확인합니다.

## congestion avoidance의 additive increase

`cwnd`가 `ssthresh`를 넘으면 congestion avoidance에서 ACK가 확인한 양을 누적해 대략 한 RTT에 1 SMSS만큼 창을 늘립니다. `cwnd=10 SMSS`일 때 한 window의 새 데이터가 모두 확인되면 다음 창이 약 11 SMSS가 되는 모형입니다. 구현은 ACK마다 fractional 증가를 누적하거나 `SMSS*SMSS/cwnd` 형태로 갱신해 지연 ACK에서도 평균적인 선형 증가를 만들 수 있습니다.

이 선택은 경로 용량을 계속 탐색하되, 매 ACK 또는 매 RTT에 창을 두 배로 만들어 큰 burst를 만드는 것을 피합니다. 단, additive increase가 모든 TCP 계열 알고리즘의 영원한 공통 공식이라는 뜻은 아닙니다. RFC 5681이 규정하는 기본 Reno 계열 동작과 CUBIC 같은 후속·다른 혼잡 제어를 분리해야 합니다. 운영에서 알고리즘 이름과 실제 `cwnd` trace를 확인하지 않은 채 모든 선형 증가를 RFC 5681로 해석하지 않습니다.

## duplicate ACK와 fast retransmit

수신자가 gap을 만나면 같은 cumulative ACK를 반복할 수 있습니다. 송신자가 세 개의 duplicate ACK를 받으면 timeout까지 기다리지 않고 gap 앞 세그먼트를 재전송하는 fast retransmit을 시작합니다. 이 신호는 뒤쪽 데이터가 경로를 통과해 receiver까지 왔다는 정황이므로, 긴 RTO를 기다리는 것보다 빠릅니다. 예를 들어 segment 10이 빠지고 11·12·13이 도착하면 receiver가 ACK=10을 반복할 수 있고, 세 번째 duplicate ACK에서 10을 재전송하는 식입니다.

그러나 duplicate ACK는 재정렬이나 중복 packet 때문에도 생길 수 있습니다. 따라서 세 개라는 임계값은 손실 추정 규칙이지 물리적 손실 증명이 아닙니다. fast recovery는 `ssthresh`를 낮추고 `cwnd`를 임시로 inflate해 이미 경로에 들어간 뒤쪽 세그먼트의 ACK를 처리하지만, 이는 SACK scoreboard나 실제 sender의 세부 구현과 함께 읽어야 합니다. 한 window에서 손실이 여러 개면 duplicate ACK만으로는 어느 범위가 수신되었는지 부족하므로 SACK이 추가 정보를 줍니다.

## timeout과 fast retransmit의 차이

timeout은 duplicate ACK를 세 개 모으기 전에 ACK가 충분히 돌아오지 않았다는 사건입니다. RFC 5681은 timeout 손실에서 `cwnd`를 loss window(`LW`) 이하, 즉 full-sized segment 1개 수준으로 낮춘 뒤 재전송하고 slow start로 다시 올리도록 규정합니다. 이는 유휴 연결을 재개할 때 쓰는 restart window(`RW`)와 다른 사건입니다. 반면 fast retransmit은 경로가 여전히 여러 segment를 전달하고 있다는 증거가 있어 `cwnd`를 `ssthresh+3*SMSS`로 조정하고 fast recovery를 거칩니다. 이 차이는 loss signal의 강도와 관찰된 in-flight data의 차이를 반영합니다.

설명용 상태를 보겠습니다. `SMSS=1`, `cwnd=20`, `ssthresh=16`, `FlightSize=18`에서 세 duplicate ACK가 발생하면 `ssthresh = max(18/2, 2)=9 SMSS`라는 RFC 식을 사용하고 fast recovery로 들어갑니다. 이후 timeout이 발생하더라도, 이번에 만료된 segment가 이미 timer retransmission을 겪었다면 `ssthresh`를 다시 계산하지 않고 기존 값을 유지합니다. 아직 timer로 재전송되지 않은 segment에서 처음 timer loss를 감지한 경우에만 `ssthresh=max(FlightSize/2,2*SMSS)` 상한을 적용합니다. 어느 경우든 timeout 뒤 `cwnd`는 `LW=1*SMSS` 이하로 낮추며, 유휴 연결 재개에 쓰는 `RW`와 혼동하지 않습니다. 두 사건을 모두 “cwnd를 절반으로 줄인다”로 요약하면 timeout의 slow start 재진입과 fast recovery의 차이를 놓칩니다.

## FlightSize 기반 threshold 감소

RFC 5681은 loss 시 `ssthresh = max(FlightSize/2, 2*SMSS)`를 사용합니다. 여기서 `FlightSize`는 sender가 허용한 최대 `cwnd`가 아니라 손실 시점에 실제로 outstanding인 데이터입니다. `cwnd=100 SMSS`라도 애플리케이션이 20 SMSS만 공급했고 그중 20이 아직 ACK되지 않았다면 FlightSize는 20입니다. 이때 threshold를 `cwnd/2=50`으로 잡으면 경로가 실제로 처리하던 양보다 과하게 큰 새 한도를 줄 수 있습니다.

이 규칙의 중요한 하한은 `2*SMSS`입니다. FlightSize가 1 SMSS처럼 작아도 threshold를 0.5 SMSS로 만들지 않고 최소한의 탐색 창을 둡니다. 위 예에서 FlightSize=20이면 `ssthresh=max(10,2)=10 SMSS`입니다. `cwnd=100`의 절반인 50을 쓰지 않는 이유는 idle sender의 예약 한도와 실제 경로에 떠 있던 부하를 구분하기 위해서입니다.

`FlightSize`를 packet capture의 임의 순간 패킷 수로 대체하면 ACK timing과 송신 큐를 놓칩니다. RFC의 정의에 맞는 outstanding data, 즉 아직 cumulative ACK로 확인되지 않은 양을 sender 상태에서 산출해야 합니다. 측정 도구가 cwnd와 FlightSize를 같은 이름으로 표시하는 경우 그 도구의 의미를 먼저 확인합니다.

## 상태 전이 숫자 추적

다음은 RFC 5681의 기본 동작을 설명하는 작은 모형입니다. `SMSS=1`, 초기 `cwnd=2`, `ssthresh=8`로 두고 손실 없이 새 데이터 ACK가 도착하면 slow start에서 2→3→4→…로 올라갑니다. `cwnd=8` 근처에서 congestion avoidance로 넘어가면 한 RTT에 약 1씩 증가합니다. 이 숫자는 특정 OS에서 실행한 측정이 아니라 상태 전이를 검산하기 위한 설명용 계산입니다.

```text
초기: cwnd=2, ssthresh=8, FlightSize=2
새 ACK 1: cwnd=3 (slow start)
새 ACK 2: cwnd=4 (slow start)
... threshold 접근 ...
CA 진입 뒤 한 RTT: cwnd≈9
세 dup ACK, FlightSize=18, SMSS=1:
  ssthresh=max(18/2, 2)=9
  fast recovery에서 재전송
timeout, FlightSize=6:
  ssthresh=max(6/2, 2)=3 (처음 timer loss인 경우)
  cwnd=LW=1 SMSS로 감소; RW는 idle restart용 별도 상태
```

slow start 계산에서 ACK마다 정확히 1을 더하는 것은 `SMSS=1`이고 새 데이터 확인량이 충분한 설명입니다. 실제 byte counting에서는 `min(N,SMSS)`와 delayed ACK를 적용합니다. congestion avoidance의 fractional 증가도 정수 rounding으로 인해 trace가 계단형으로 보일 수 있습니다. 이런 중간 상태를 보여 주면 “slow start=항상 정확한 두 배”라는 오해와 “AIMD=항상 모든 ACK마다 같은 값”이라는 오해를 동시에 피할 수 있습니다.

## 구현 선택과 알고리즘 경계

연결 상태에 `cwnd`, `ssthresh`, `FlightSize`, 마지막 ACK와 duplicate ACK 수, recovery 상태, SMSS, 현재 혼잡 알고리즘을 분리해 보관합니다. `rwnd`는 receiver가 보내는 광고값으로 별도 관찰하며, `min(cwnd,rwnd)`를 전송 가능량으로 계산하더라도 원인 진단에서는 두 원천을 섞지 않습니다.

재전송을 먼저 수행할지 congestion window를 갱신할지는 사건 순서가 중요합니다. duplicate ACK 세 번째 도착, 추가 duplicate ACK, 새로운 cumulative ACK, retransmission timeout을 서로 다른 이벤트로 모델링해야 합니다. SACK을 사용하는 경우 selective block을 기준으로 이미 도착한 범위를 scoreboard에 표시하지만, threshold 감소와 fast recovery의 전체 규칙은 RFC 5681의 적용 범위 및 후속 문서를 확인해야 합니다.

CUBIC이나 운영체제별 확장을 사용하는 환경에서는 `cwnd` trace가 RFC 5681의 선형 증가와 다를 수 있습니다. “TCP”라는 프로토콜 이름만으로 congestion-control 알고리즘을 특정하지 않습니다. 재현 기록에는 OS·알고리즘 선택·SMSS·ACK 정책을 함께 남깁니다.

## 실패 사례와 검증 기준

가장 흔한 오류는 `rwnd`가 작다는 사실을 혼잡으로 진단하는 것입니다. 다음은 slow start를 매 RTT 정확히 두 배로만 설명하는 오류입니다. 세 번째는 duplicate ACK를 실제 손실 확정으로 표현하는 것이고, 네 번째는 timeout과 fast retransmit을 같은 cwnd 감소로 처리하는 것입니다. 다섯 번째는 `cwnd/2`를 무조건 `ssthresh`로 사용해 FlightSize를 무시하는 것입니다.

검증은 receiver read를 늦춘 trace, 정상 ACK로 ssthresh를 넘는 trace, 재정렬로 duplicate ACK가 생기는 trace, 단일 loss의 세 dup ACK, timeout, 애플리케이션 공급이 적어 cwnd보다 FlightSize가 작은 trace로 나눕니다. 각 구간에 `rwnd`, `cwnd`, `ssthresh`, `FlightSize`, ACK 종류, 실제 retransmission, RTT와 loss signal을 같은 시간축으로 기록합니다. 처리량만 비교하지 말고 loss 뒤 복구 속도와 burst, p99 지연도 함께 봅니다.

## 비용과 한계

slow start는 경로 용량을 빠르게 탐색하지만 초기에 burst와 손실을 만들 수 있습니다. congestion avoidance는 안정적인 증가를 주지만 높은 BDP 경로에서 목표 용량까지 오래 걸릴 수 있습니다. fast retransmit은 RTO를 기다리지 않는 이점이 있지만 재정렬이 심하면 오탐 재전송과 window 감소가 생길 수 있습니다. timeout은 `cwnd=LW`로 크게 줄여 회복이 느리지만, ACK 진행이 끊긴 상태에서 경로를 계속 밀어 넣는 것을 막습니다. 단, timer retransmission이 이미 있었던 segment의 후속 timeout에서 `ssthresh`를 임의로 다시 절반내림하지 않는 예외를 상태에 보존해야 합니다.

RFC 5681은 2009년 문서이며 입력에 기록된 RFC 9438 업데이트 내용은 이 문서에서 추출·검증하지 않았습니다. 따라서 이 장은 RFC 5681의 기본 slow start, congestion avoidance, fast retransmit/recovery와 FlightSize 규칙을 설명하는 범위로 제한합니다. 실제 스택의 CUBIC·Reno 변형과 초기 window는 별도 문서와 구현을 확인해야 합니다.

## 참고 자료

- RFC 5681, “TCP Congestion Control”, https://www.rfc-editor.org/rfc/rfc5681.txt
- RFC 2018, “TCP Selective Acknowledgment Options”, https://www.rfc-editor.org/rfc/rfc2018.txt
- 기존 학습 노트: `notes/networking/tcp-throughput.md`
