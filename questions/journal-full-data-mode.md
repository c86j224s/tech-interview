---
id: journal-full-data-mode
title: >-
  ext4 data=journal은 file data와 metadata를 모두 journal합니다. ordered보다 강한 보호와 성능 비용이
  왜 함께 생기나요?
difficulty: 하
category: 운영체제
tags:
  - ext4
  - data=journal
  - JBD2
  - 성능
related:
  - group-commit-checkpoint-tradeoff
---
# ext4 data=journal은 file data와 metadata를 모두 journal합니다. ordered보다 강한 보호와 성능 비용이 왜 함께 생기나요?

## 구두 답변

`data=journal`은 file data와 metadata를 모두 journal transaction의 기록 대상으로 넣어 valid commit 범위에서 둘을 함께 replay할 수 있게 하는 모드입니다. ordered가 file data를 home location으로 먼저 flush하고 metadata를 journal에 기록하는 순서를 연결하는 데 비해, journal 모드는 data 자체가 journal 경로를 지나므로 crash 시 data 보호 범위가 더 직접적입니다. 대신 비용이 생깁니다. 단순화한 4 KiB write에서 애플리케이션 data D와 inode metadata M이 먼저 journal에 기록되고 commit된 뒤, checkpoint가 D와 M을 최종 home block에 반영합니다. data가 journal과 home에 두 번 이동하는 경로가 생겨 journal bandwidth, write amplification, flush latency가 증가할 수 있습니다. ordered 모델에서는 D를 home에 flush한 뒤 M을 journal에 기록하므로 data journal 복제가 없지만, overwrite 최신성·device power-loss 보호·여러 파일 논리 원자성은 별도 조건입니다. `data=journal`도 O_SYNC나 DB commit을 자동으로 대신하지 않으며, 유효한 commit record와 checksum이 없는 transaction은 replay 완료로 취급하지 않습니다. 선택은 data 재생성 가능성, crash 뒤 이전 data 허용 여부, journal 용량과 write rate, storage latency로 결정합니다. 실제 성능 비교는 같은 workload에서 journal commit latency와 checkpoint backlog를 분리 측정해야 하며, 이 환경에서는 ext4 crash 실험을 실행하지 않았습니다. 따라서 “모든 전원 장애 write를 보존한다”고 확장하지 않고 ext4/JBD2의 모드 차이와 비용만 답합니다.

## 득점 포인트

- data와 metadata가 모두 journal 대상이 되어 valid commit 범위의 replay에 들어간다는 점을 ordered와 비교합니다.
- 4 KiB data가 journal 기록 후 home block으로 checkpoint되는 중간 경로를 보여 줍니다.
- write amplification·journal bandwidth·latency라는 구체 비용을 보호 범위와 함께 제시합니다.

## 감점 포인트

- data=journal이 home location에 절대 쓰지 않거나 모든 application transaction을 원자화한다고 말하면 안 됩니다.
- journal mode가 device flush와 power-loss 보호를 자동으로 충족한다고 단정하지 않습니다.
- ext4/JBD2 특성을 일반 filesystem 계약으로 확장하지 않습니다.

## 더 파고들 거리

- journal commit latency와 checkpoint backlog를 분리 측정합니다.
- replay에는 valid commit record와 checksum이 필요하다는 범위를 확인합니다.
- data 재생성 가능성·write rate·storage latency를 mode 선택 기준으로 사용합니다.
