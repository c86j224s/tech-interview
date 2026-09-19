---
id: game-delta-ack-loss-full-resync
title: delta ACK가 유실되어 sender가 baseline을 오래 보관할 때 언제 full snapshot으로 전환하나요?
difficulty: 중하
category: 게임 서버
tags:
  - delta compression
  - resync
  - ACK loss
related:
  - http-sse-vs-websocket
---
# delta ACK가 유실되어 sender가 baseline을 오래 보관할 때 언제 full snapshot으로 전환하나요?

## 구두 답변

ACK timeout 하나만으로 즉시 full을 결정하지 말고 미확인 baseline의 age, pending bytes, retry count, decoder/NACK, 연결 상태를 bounded window와 비교합니다. 예를 들어 S20 application ACK가 사라진 뒤 pending state가 2MB 상한을 넘거나 재시도 3회 후에도 receiver 보유를 증명하지 못하면 S21을 계속 누적하지 않고 resync token과 full snapshot으로 전환합니다. timeout만 길게 늘리면 연결 하나가 메모리를 점유하고 chain 복구 시간이 증가하며, 너무 빨리 full을 보내면 bandwidth burst가 생깁니다. receiver가 S20을 설치했을 가능성은 control exchange로 확인할 수 있지만 그 exchange도 시간·bytes 예산 안에서만 허용합니다. full message는 새 snapshot ID와 stream epoch/resetBefore 경계를 가져야 하며 receiver가 설치·검증한 뒤 새 confirmed baseline ACK를 보냅니다. resync 중 old delta가 뒤늦게 오면 폐기해야 full state가 다시 후퇴하지 않습니다. 입력 명령처럼 내구성이 필요한 데이터는 snapshot pending과 분리하고, 최신 위치 snapshot만 full로 재설정합니다. 검증은 pending bytes, resync count, full bytes, p99 convergence, old-delta rejection을 기록해 threshold가 정상 압축 구간과 spawn 폭주 구간에서 타당한지 비교합니다.


전환 후에도 최신 simulation은 멈추지 않으므로 resync를 시작한 시점과 full snapshot을 만든 시점을 구분합니다. 예컨대 S20 pending을 폐기하고 S24 full을 만들었다면 S21~S23의 위치를 순서대로 재생하지 않아도 되지만, S21의 구매 완료나 피해 확정 같은 durable event를 잃어서는 안 됩니다. full 설치 ACK 전에는 snapshot 채널에 old delta를 보내지 않고, 별도 command channel은 idempotency key와 cursor로 처리합니다. 이렇게 해야 full resync가 상태를 빠르게 수렴시키면서도 이벤트 내구성을 훼손하지 않습니다.
## 득점 포인트

- age·bytes·retry를 함께 쓰는 전환 조건과 2MB/3회 예시를 제시합니다.
- full 설치 뒤 새 baseline ACK와 stream epoch 경계로 old delta를 차단합니다.
- bandwidth·memory·convergence를 함께 측정하고 durable command와 snapshot을 분리합니다.

## 감점 포인트

- ACK 한 번 지연되면 무조건 full을 보내거나, 반대로 연결 수명 내내 pending을 보관합니다.
- full 뒤 old delta를 재적용해 state를 후퇴시키거나 sender timeout만으로 receiver state를 확정합니다.
- resync 비용과 entity spawn burst를 같은 threshold로 무비판 적용합니다.

## 더 파고들 거리

- reconnect client가 어느 baseline을 보유하는지 증명할 control message의 ID·schema·epoch 필드를 정해 보세요.
- 입력 명령과 위치 snapshot을 resync 중 다르게 처리해야 하는 이유를 설명해 보세요.
