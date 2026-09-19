---
id: direct-io-sync-durability
title: >-
  O_DIRECT write가 반환됐는데 전원 장애 뒤 데이터가 남는다고 단정할 수 있나요? O_DIRECT와 O_SYNC의 계약을 어떻게
  구분하나요?
difficulty: 하
category: 운영체제
tags:
  - O_DIRECT
  - O_SYNC
  - durability
  - fsync
related:
  - os-fsync-directory
  - db-wal-durability
---
# O_DIRECT write가 반환됐는데 전원 장애 뒤 데이터가 남는다고 단정할 수 있나요? O_DIRECT와 O_SYNC의 계약을 어떻게 구분하나요?

## 구두 답변

O_DIRECT write가 반환됐다는 사실만으로 전원 장애 뒤 data가 남는다고 단정할 수 없습니다. O_DIRECT는 page-cache caching effects를 줄이려는 I/O 경로 선택이고, O_SYNC는 write 완료를 동기화된 상태까지 끌어가려는 별도 요청입니다. 설명용 상태를 `user buffer → syscall 반환 → OS/filesystem 반영 → device cache → nonvolatile media`로 나누면, direct flag는 첫 번째 경로의 caching을 줄일 뿐 마지막 단계를 자동 확정하지 않습니다. 필요한 데이터 내구 경계가 있다면 대상 filesystem과 device 계약에 맞춰 `O_DIRECT|O_SYNC` 또는 write 뒤 `fsync`를 선택하고 반환 오류를 처리합니다. 새 파일을 만들거나 rename으로 이름을 공개하는 경우에는 file data와 directory entry 내구가 별도이므로 parent directory도 따로 검토합니다. 정상 종료 후 read-back이 성공해도 power-loss protection을 검증한 것은 아닙니다. direct+sync는 flush와 호출 latency를 늘리고, device 자체가 전원 보호를 제공하지 않으면 기대한 범위를 넘어설 수 없습니다. DB WAL에서는 engine의 commit·flush policy가 이미 sync를 수행하는지 확인해 중복 flush와 누락을 모두 피해야 합니다. 측정은 syscall 성공, OS cache 반영, device durable, logical commit을 별도 이벤트로 기록합니다. 이 환경에서는 전원 장애 실험을 실행하지 않았으므로 특정 장치의 보존 결과를 주장하지 않습니다. O_DIRECT와 O_SYNC를 같은 flag로 취급하지 않는 것이 질문의 핵심 경계입니다.

## 득점 포인트

- O_DIRECT의 cache 경로와 O_SYNC/fsync의 persistence 경계를 `syscall→device cache→media` 상태로 분리합니다.
- file data와 rename directory entry 내구를 다른 단계로 둡니다.
- DB WAL logical commit과 storage durability를 별도 이벤트로 기록합니다.

## 감점 포인트

- O_DIRECT가 O_SYNC를 포함하거나 syscall 반환이 power-loss 보존을 증명한다고 말하면 안 됩니다.
- fsync 한 번으로 모든 device·filesystem·DB transaction의 원자성이 생긴다고 단정하지 않습니다.
- 정상 종료 read-back을 전원 장애 시험으로 대체하지 않습니다.

## 더 파고들 거리

- 대상 device의 power-loss protection과 filesystem sync 계약을 확인합니다.
- direct+sync의 latency·flush 비용을 workload별로 측정합니다.
- 전원 장애 실험을 하지 않았다면 특정 보존 결과를 측정값으로 제시하지 않습니다.
