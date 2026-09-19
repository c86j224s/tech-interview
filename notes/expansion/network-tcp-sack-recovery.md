---
id: network-tcp-sack-recovery
title: TCP SACK 복구와 재정렬
topic: 네트워크
summary: SACK 허용 협상과 선택적 블록 범위를 추적하고 재정렬·복수 손실에서 이미 받은 데이터의 재전송을 줄이는 경계를 설명합니다.
questionIds: []
prerequisites:
  - tcp-throughput
related:
  - tcp-throughput
reviewedAt: '2026-09-19'
---
# TCP SACK 복구와 재정렬

TCP의 cumulative ACK는 가장 앞에서 끊기지 않은 연속 바이트만 알려 줍니다. 그래서 중간 세그먼트 하나가 사라진 뒤 뒤쪽 데이터가 도착하면 송신자는 “어디까지는 이미 수신되었는가”를 충분히 알기 어렵습니다. SACK(Selective Acknowledgment)은 이 연속 prefix 바깥의 수신 범위를 선택적으로 보고해 복구 판단을 넓히지만, 수신 버퍼의 영구 보관이나 손실 확정까지 약속하지는 않습니다. 이 장은 RFC 2018의 option 계약을 중심으로 SYN 협상, `[left,right)` 범위, duplicate ACK와 SACK block의 결합, 복수 손실 trace, timeout 뒤 상태 폐기를 설명합니다.

## 누적 확인의 정보 한계

TCP ACK 값은 다음에 기대하는 sequence number입니다. 수신자가 100부터 200까지 연속으로 받았으면 ACK=200이라고 말하는 식이며, 200 이후의 데이터를 먼저 받아도 ACK는 200에 머물 수 있습니다. 예를 들어 세그먼트 101이 유실되고 102·103·104가 도착하면 수신자는 101을 기다리므로 누적 ACK는 gap 앞 값에 정지합니다. 송신자는 뒤쪽 데이터가 실제로 수신되었는지, 아니면 단순히 순서가 바뀌어 아직 오지 않았는지를 cumulative ACK만으로 구분하기 어렵습니다.

이 한계는 duplicate ACK 수와도 연결됩니다. 뒤쪽 segment가 올 때마다 같은 ACK가 반복되면 손실 신호가 될 수 있지만, 재정렬도 같은 현상을 만듭니다. duplicate ACK를 받았다는 사실은 “수신자가 예상보다 큰 sequence를 관찰했다”는 정보이지, 특정 세그먼트가 확정적으로 폐기됐다는 저장소 기록이 아닙니다. SACK은 이 모호한 신호 옆에 실제로 관찰된 비연속 범위를 추가합니다.

## SYN에서 SACK 허용 협상

SACK-Permitted는 연결이 성립한 뒤 SACK option을 사용할 수 있음을 SYN에서 광고하는 별도 option입니다. 데이터 ACK에 들어가는 SACK block 자체와 같은 option이 아닙니다. 양 끝이 SYN 또는 SYN을 포함한 handshake segment에서 허용 capability를 협상하면 이후 수신자는 SACK block을 넣을 수 있습니다. peer가 SACK-Permitted를 광고하지 않았다면 수신자는 해당 연결에서 SACK option을 보내면 안 됩니다.

다음은 capability와 실제 보고를 분리한 상태입니다.

```diagram
{"title":"허용 협상 뒤에 실제 block 보고가 옵니다","caption":"SYN의 SACK-Permitted는 사용 가능성을 협상하고, 데이터 ACK의 SACK block은 그 뒤 관찰한 비연속 범위를 보고합니다.","rows":[[{"id":"syn","label":"SYN 협상","detail":["SACK-Permitted 광고"]}],[{"id":"data","label":"비순서 데이터","detail":["gap 뒤 범위 도착"]}],[{"id":"ack","label":"ACK + SACK","detail":["누적 ACK와 block 보고"]}]],"edges":[{"from":"syn","to":"data","label":"허용된 연결"},{"from":"data","to":"ack","label":"관찰한 범위 보고"}]}
```

한쪽만 capability를 광고한 경우도 peer의 계약 관점에서 설명해야 합니다. “수신자가 kind 5 option을 만들 수 있는 구현이다”라는 사실은 “이번 연결에서 보내도 된다”는 뜻이 아닙니다. SACK-Permitted와 TCP timestamp, 그리고 실제 sender recovery 알고리즘은 별개 기능입니다. SACK이 협상되었다고 해서 손실 복구가 자동으로 RFC 2018의 모든 권고를 구현했다는 뜻도 아닙니다.

## SACK block 범위 해석

RFC 2018은 한 contiguous block을 두 개의 32-bit 경계로 표현합니다. 왼쪽 경계는 포함하고 오른쪽 경계는 포함하지 않는 범위입니다. 따라서 `left=100`, `right=120`은 sequence space `[100,120)`, 즉 100 이상 120 미만의 20바이트를 뜻합니다. byte 120은 이 block에 포함되지 않습니다. 이 구간은 “누적 ACK가 확인한 prefix”가 아니라, 그 밖에서 수신자가 보유하고 보고하는 연속 구간입니다.

예를 들어 누적 ACK=80이고 SACK `[100,120)`이면 80부터 100 직전까지의 gap이 남아 있고 100~119는 도착했다는 식으로 해석합니다. sequence 번호와 실제 payload byte length를 섞지 않으려면 wrap-around와 segment 경계를 별도 처리해야 합니다. 설명용 숫자에서는 wrap을 제외했지만 실제 TCP sender는 32-bit sequence space 비교 규칙을 사용합니다.

SACK option 공간은 무한하지 않습니다. option 길이와 timestamp 같은 다른 option의 존재에 따라 한 ACK에 넣을 수 있는 block 수가 제한되고, RFC 2018 본문은 일반적으로 최대 4개, timestamp 사용 시 더 적은 block이 들어갈 수 있음을 설명합니다. 따라서 SACK이 오지 않았다고 수신 버퍼가 비어 있다고 결론 내리지 않습니다. 송신자는 보고된 범위를 보수적으로 관리하고 cumulative ACK를 여전히 기준 확인으로 유지합니다.

## block 생성과 ACK 선택 순서

수신자가 SACK을 보낸다면 첫 block은 해당 ACK를 유발한 최신 segment를 포함하도록 우선 배치합니다. 그 뒤 가능한 많은 서로 다른 block을 넣되 option 공간을 넘지 않습니다. 이전 SACK에서 보고한 block 중 아직 다른 block의 subset이 아닌 범위를 반복해 ACK 손실에 대한 견고성을 높일 수 있습니다. 이는 매 ACK가 receiver의 모든 비연속 범위를 완전하게 싣는다는 뜻이 아닙니다.

송신자는 SACK block의 경계를 자신의 outstanding segment sequence와 대조해 SACKed 표시를 켭니다. 같은 ACK에 여러 block이 있으면 각 범위를 합쳐 이미 받은 구간을 구분하고, 재전송 선택에서 그 범위를 건너뛸 수 있습니다. 경계 계산에서 `[100,120)`을 `[100,121]`로 바꾸면 byte 하나를 잘못 보존하거나 재전송 대상에서 빼는 off-by-one이 생깁니다.

SACK block은 advisory입니다. 수신자는 나중에 이미 보고한 데이터를 버릴 수 있고, 송신자는 cumulative ACK가 되기 전까지 데이터를 완전히 폐기해서는 안 됩니다. “SACKed 플래그가 켜졌으니 sender buffer를 즉시 free한다”는 구현은 timeout이나 재전송 경로에서 복구할 데이터를 잃을 수 있습니다.

## 복수 손실 복구 추적

아래 100–106 숫자는 계산을 단순화한 1바이트 데이터 구간의 시작 sequence 번호입니다. 실제 SACK은 임의의 segment 일련번호가 아니라 바이트 sequence 범위를 보고하며, 일반 MSS 크기의 segment에서는 그 바이트 경계를 사용해야 합니다.

설명용으로 한 window에서 segment 100~106을 보냈고 101과 105가 손실되었다고 합시다. 수신자는 100을 받았지만 101이 없으므로 누적 ACK=101을 반복합니다. 102·103·104가 도착하면 `[102,105)`를, 106이 도착하면 `[106,107)`을 SACK block으로 보고할 수 있습니다. sender가 이 정보를 합치면 101과 105가 gap 후보이고 102~104·106은 이미 receiver가 관찰한 범위입니다.

```text
송신: 100 101 102 103 104 105 106
도착: 100    102 103 104    106
ACK : 101
SACK: [102,105), [106,107)
복구 후보: 101, 105
```

누적 ACK만 있었다면 sender는 101 이후의 데이터가 도착했는지 추정해야 합니다. fast retransmit에서 101을 먼저 보낼 수는 있지만, 105가 손실된 것도 알고 있는지와 이미 받은 102~104를 다시 보내지 않아도 되는지는 더 약한 정보입니다. SACK은 “손실 위치 두 곳을 확정적으로 판정하는 장치”라기보다, receiver가 보유한다고 보고한 구간을 이용해 불필요한 재전송을 줄이는 장치입니다. 실제 sender는 congestion-control 규칙, retransmission scoreboard, 재정렬 허용 범위를 함께 적용합니다.

복수 loss에서 하나의 SACK block이 병합되는 경우도 추적해야 합니다. 102가 도착한 뒤 103이 도착하면 `[102,103)`과 `[103,104)`를 두 block으로 남기지 않고 `[102,104)`로 합치는 것이 자연스럽습니다. 하지만 구현이 block을 정렬·병합하는 순서와 중복 ACK 생성 정책을 임의로 단정하지 말고 실제 수신 스택을 확인합니다.

## 재정렬과 duplicate ACK의 경계

segment가 손실된 것이 아니라 경로에서 순서만 바뀌어 102가 101보다 먼저 도착해도 누적 ACK는 gap 앞에 머무르고 duplicate ACK가 나올 수 있습니다. SACK은 102의 범위를 알려 sender가 재정렬 가능성을 더 잘 볼 수 있게 하지만, 도착 순서를 직접 증명하지는 않습니다. 그래서 duplicate ACK 개수만으로 즉시 네트워크 손실을 확정하는 것은 위험합니다.

재정렬이 길면 같은 block이 여러 ACK에 반복되고 sender는 이미 SACK된 범위를 건너뛰어야 합니다. 반대로 receiver의 option 공간이 부족하면 일부 block만 보일 수 있고, ACK 자체가 손실되어 sender가 과거 보고를 못 볼 수 있습니다. recovery 상태는 새 cumulative ACK, 새 SACK block, timer expiration을 각 사건으로 처리하며 “가장 최근 패킷 하나”만 저장하는 식으로 단순화하면 중간 범위를 잃습니다.

SACK을 켜도 reorder가 많은 경로에서 spurious retransmission이 완전히 사라지지는 않습니다. SACK은 수신 범위 정보를 보태지만 congestion-control threshold, RTO estimator, timestamps의 역할을 대체하지 않습니다. 분석에서는 sequence trace와 실제 retransmitted payload를 함께 비교합니다.

## timeout 뒤 이전 정보 폐기

RFC 2018은 retransmission timeout 뒤 sender가 기존 SACKed 표시를 끄도록 권고합니다. timeout은 receiver가 보고한 데이터가 현재도 수신 버퍼에 남아 있다는 보장이 약해졌다는 신호이기 때문입니다. receiver는 SACK으로 알린 데이터를 나중에 버릴 수 있습니다. 따라서 `[200,300)`을 예전에 받았다는 보고만 믿고 timeout 이후 그 범위를 영원히 재전송에서 제외하면 sender와 receiver의 상태가 어긋날 수 있습니다.

timeout 뒤에는 sender가 현재 누적 ACK와 새 ACK/SACK을 기준으로 scoreboard를 다시 채웁니다. 누적 ACK가 200까지라면 200 이후 outstanding data를 보수적으로 후보로 잡고, 새로운 SACK이 들어오면 다시 이미 수신된 block을 표시합니다. 이 상태 reset은 congestion window를 어떻게 낮출지와 별개입니다. RFC 5681의 timeout 반응은 cwnd·ssthresh를 다루고, RFC 2018의 SACK reset은 어떤 데이터가 아직 재전송 후보인지 다룹니다.

이 경계를 분리하지 않으면 “SACK을 폐기했으니 혼잡 제어도 초기화했다”거나 “cwnd를 줄였으니 SACK scoreboard도 안전하다”는 잘못된 결론이 나옵니다. 두 상태를 각각 로그에 남깁니다.

## 구현 자료구조와 선택 기준

송신자는 outstanding sequence 범위에 SACKed 상태를 표시할 scoreboard가 필요합니다. segment 단위 bitmap은 구현이 쉽지만 작은 segment가 많으면 메모리가 커지고, interval tree나 정렬된 범위 목록은 block 병합에 유리하지만 경계 갱신이 복잡해집니다. 선택 기준은 window 크기, ACK 빈도, segment 크기, 재정렬 패턴, timeout reset 비용입니다.

receiver는 out-of-order queue에서 contiguous block을 병합하고 cumulative ACK와 SACK option을 생성합니다. 옵션 공간이 부족하면 우선순위 정책이 필요합니다. RFC 2018이 권고하는 최신 block 우선과 과거 block 반복을 만족해야 하지만, 실제 timestamp·MSS·헤더 옵션에 따라 넣을 수 있는 수가 달라집니다. 구현 전에 `[100,120)`, 인접 block merge, 겹친 block, 오른쪽 경계 일치, sequence wrap을 단위 테스트로 고정합니다.

## 실패 사례와 검증 기준

첫 번째 실패는 SACK-Permitted 협상 없이 SACK block을 보내는 것입니다. 두 번째는 오른쪽 경계를 inclusive로 해석하여 20바이트를 21바이트로 만드는 것입니다. 세 번째는 cumulative ACK와 SACK block을 합쳐 ACK가 gap을 확인했다고 보는 것입니다. 네 번째는 SACKed 데이터를 즉시 버려 timeout 복구에서 재전송 후보를 잃는 것입니다. 다섯 번째는 timeout 뒤 낡은 block을 그대로 유지하는 것입니다.

검증 trace는 SYN 양끝 capability 교환, capability 부재, 단일 gap과 재정렬, 2개 gap, option 공간 부족, SACK ACK 손실, timeout 뒤 receiver discard로 나눕니다. 각 trace에서 `ACK`, block의 left/right, sender scoreboard, 실제 retransmission sequence를 기록합니다. RFC 2018 원문은 option 동작과 advisory 성격을 뒷받침하지만 현대의 전체 loss-recovery 알고리즘을 정의하는 문서는 아니므로, congestion-control과 구현별 확장은 별도 근거로 확인해야 합니다.

## 비용과 참고 범위

SACK은 헤더 option 공간과 receiver out-of-order memory, sender scoreboard를 추가로 소비합니다. 그 대가로 이미 도착한 데이터의 재전송과 복수 손실에서의 추정을 줄일 수 있습니다. 손실이 거의 없고 option 공간이 부족한 작은 세그먼트 환경에서는 정보 이득과 header 비용을 측정해야 하며, SACK 사용만으로 처리량이 보장되지는 않습니다.

이 장의 핵심 범위는 RFC 2018(1996)의 SACK option specification입니다. RFC 본문은 Proposed Standard이며 이후의 일반 congestion-control이나 현대적인 SACK recovery 확장을 모두 대체하지 않습니다. 실제 연결을 판정할 때는 SYN option, packet capture, sender 구현의 scoreboard, timeout 시 reset 로그를 함께 확인합니다.

## 참고 자료

- RFC 2018, “TCP Selective Acknowledgment Options”, https://www.rfc-editor.org/rfc/rfc2018.txt
- RFC 5681, “TCP Congestion Control”, https://www.rfc-editor.org/rfc/rfc5681.txt
- 기존 학습 노트: `notes/networking/tcp-throughput.md`
