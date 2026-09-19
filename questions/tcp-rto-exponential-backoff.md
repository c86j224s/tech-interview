---
id: tcp-rto-exponential-backoff
title: TCP 재전송 타이머가 만료될 때마다 RTO를 그대로 유지하면 왜 문제가 되나요?
difficulty: 하
category: 네트워크
tags:
  - TCP
  - RTO
  - timeout
  - backoff
related: []
---
# TCP 재전송 타이머가 만료될 때마다 RTO를 그대로 유지하면 왜 문제가 되나요?

## 구두 답변

RTO를 고정하면 ACK가 돌아오지 않는 같은 상황에서 sender가 일정한 짧은 간격으로 계속 재전송하여 이미 지연되거나 손실된 경로에 추가 패킷을 밀어 넣을 수 있습니다. RFC 6298은 retransmission timer가 만료되면 가장 이른 미확인 segment를 재전송하고, 그 직후 RTO를 두 배로 한 뒤 새 값으로 timer를 시작하도록 합니다. 설명용으로 유효 sample을 얻은 뒤 현재 RTO가 1초라고 하겠습니다. 첫 만료 시 t=1초에 재전송하고 RTO를 2초로 바꾸므로 다음 deadline은 t=3초입니다. 다시 ACK가 없으면 t=3초에 재전송하고 RTO=4초가 되어 다음 deadline은 t=7초가 됩니다. 이 간격은 경로가 회복할 시간을 늘리고, sender들이 동시에 timeout되는 현상이 있더라도 재전송 압력을 완화하는 방향으로 작동합니다. timeout으로 보낸 재전송은 Karn 규칙 때문에 보통 RTT sample을 만들지 않으므로 backoff 값이 새 평균 지연을 뜻하는 것도 아닙니다. 이후 재전송되지 않은 새 데이터의 유효 sample을 받으면 SRTT·RTTVAR를 다시 계산하고 RTO를 낮출 수 있습니다. 따라서 backoff는 영구 상태라기보다 현재 확인 공백에 대한 보수적 대응입니다. RFC 6298은 RTO 상한을 둘 수 있지만 적어도 60초 이상이어야 한다고 규정하고, 실제 상한은 구현 정책으로 남깁니다. SYN timer의 초기화 예외, 애플리케이션 재시도, 연결 전체의 재접속 간격도 TCP 데이터 RTO와 분리해야 합니다. 검증 로그에는 원래 RTO, 만료 시각, doubling 후 값, 새 sample 수용 여부를 함께 기록해야 고정 RTO 구현과 정상 backoff를 구분할 수 있습니다.

## 득점 포인트

- 1초→2초→4초의 deadline을 재전송 시각과 함께 계산한 점
- backoff가 혼잡 경로에 재전송을 몰아넣는 일을 완화한다고 설명한 점
- 새 유효 sample이 들어오면 RTO가 다시 낮아질 수 있음을 구분한 점

## 감점 포인트

- RTO를 고정해도 안전하다고 하거나 doubling을 애플리케이션 retry와 혼동한 점
- backoff 값을 새 RTT 평균으로 취급한 점

## 더 파고들 거리

- 상한과 SYN timer 예외를 RFC 6298 범위에서 확인해 보세요
- 동시 timeout과 timer jitter가 재전송 burst에 미치는 영향을 관찰해 보세요
