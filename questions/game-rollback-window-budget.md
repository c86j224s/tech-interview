---
id: game-rollback-window-budget
title: rollback window가 커질 때 무엇이 선형으로 늘고 무엇이 병목이 될 수 있나요?
difficulty: 중하
category: 게임 서버
tags:
  - game
  - mechanism
related:
  - game-server-tick-budget
---
# rollback window가 커질 때 무엇이 선형으로 늘고 무엇이 병목이 될 수 있나요?

## 구두 답변
고정 snapshot이면 보관 payload는 window와 snapshot bytes의 곱이고, 늦은 입력 하나의 replay CPU는 재실행 tick 수에 대체로 비례합니다. 64KiB snapshot 30개는 1920KiB, 약 1.875MiB이고 120개는 7680KiB, 약 7.5MiB입니다. 실제 병목은 capacity만이 아니라 memory bandwidth, cache pressure, allocator와 restore latency입니다. 한 프레임에 late 입력 여러 개가 오면 window가 아니라 late 빈도와 rollback 길이 합, 병합 전략이 p99를 결정합니다. delta snapshot은 저장량을 줄이지만 base chain의 최악 복원 시간이 생깁니다. snapshot bytes, restore/replay p99, catch-up이 정상 tick budget을 넘는 비율을 함께 제한하고 평균만 보지 않습니다. window 밖 입력은 몰래 삽입하지 않고 correction/resync나 명시적 거절로 처리합니다. 경기 중 window 축소·delay 변경은 peer fairness를 바꾸므로 자동 안전장치로 취급하지 않습니다.


예를 들어 정상 tick 예산이 8ms인데 restore 1.2ms, replay 10 tick이 5ms라면 한 번의 6.2ms catch-up은 허용될 수 있어도 같은 프레임에 세 입력이 겹쳐 18.6ms가 되면 다음 tick을 밀어 backlog가 커집니다. scheduler는 가장 오래된 영향을 주는 tick을 한 번 복원해 입력을 합치고, 처리 가능한 최대 replay tick을 넘으면 resync 경로로 전환하는 식으로 bounded work를 둡니다. 이때 수치를 고정 상수로 주장하지 않고 목표 기기에서 p99를 측정합니다.
## 득점 포인트
- window·상태 크기·late 빈도와 비용을 연결한다.
- 동시 replay와 p99 tail을 본다.
- delta의 저장 이득과 chain 비용을 같이 본다.
- window 밖 입력 정책을 명시한다.

## 감점 포인트
- bytes만 세고 bandwidth를 무시한다.
- 무제한 입력을 안전하다고 말한다.
- late replay를 겹쳐 budget을 넘긴다.
- peer 계약을 깨고 임의로 window를 바꾼다.

## 더 파고들 거리
- 오래된 입력 병합 시 checksum 기준은?
- 압축 비용이 CPU를 넘을 때 전환 기준은?
