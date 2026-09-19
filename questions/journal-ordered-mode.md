---
id: journal-ordered-mode
title: >-
  ext4의 data=ordered에서 metadata journal commit 전에 file data flush가 선행된다고 합니다.
  crash 뒤 파일 내용 일관성과 metadata 일관성을 어떻게 구분하나요?
difficulty: 하
category: 운영체제
tags:
  - ext4
  - journaling
  - ordered
  - JBD2
related:
  - db-wal-durability
---
# ext4의 data=ordered에서 metadata journal commit 전에 file data flush가 선행된다고 합니다. crash 뒤 파일 내용 일관성과 metadata 일관성을 어떻게 구분하나요?

## 구두 답변

`data=ordered`를 설명할 때는 metadata consistency와 file-data 최신성을 분리해야 합니다. ext4/JBD2에서 관련 dirty file data를 metadata journal commit보다 앞서 flush하도록 순서를 연결하는 모드이지, 여러 파일의 논리 transaction을 DB처럼 원자 commit하는 모드는 아닙니다. 설명용으로 새 inode N, data block D, directory entry x를 만들고 `hello` 5바이트를 쓴다고 하겠습니다. D만 dirty인 첫 시점, N·size=5·x가 metadata transaction에 들어간 둘째 시점, data flush와 valid commit record가 끝난 셋째 시점을 나눕니다. 첫째나 둘째에서 전원이 꺼지면 commit 유효성에 따라 x와 N이 replay 대상이 아닐 수 있고, 셋째 이후 장애라면 replay가 directory와 inode 구조를 복구할 수 있습니다. 그래도 “사용자가 쓴 최신 bytes 전체가 보존됐다”는 뜻은 아닙니다. 이미 존재하는 block overwrite, 장치 내부 write cache의 전원 보호, 여러 파일에 걸친 application invariant는 ordered mode 밖의 조건입니다. `write()` 반환도 장치 전원 장애 후 보존과 같지 않으므로 필요한 내구 경계에 `fsync`와 storage flush 계약을 맞춰야 합니다. replay 성공은 valid metadata transaction을 적용했다는 증거이지 DB WAL commit이나 애플리케이션 checksum 통과의 증거가 아닙니다. 따라서 복구 후 파일 포맷의 checksum·generation을 별도 확인합니다. 이 설명은 ext4/JBD2 문서 범위이며 다른 filesystem의 “ordered”라는 이름에 그대로 일반화하지 않습니다.

## 득점 포인트

- ordered를 관련 data flush와 metadata journal commit의 순서로 설명하고 DB transaction과 구분합니다.
- D dirty, metadata commit, replay라는 세 시점의 crash 상태를 비교합니다.
- write 반환·device 내구·fsync·애플리케이션 checksum을 서로 다른 계약으로 둡니다.

## 감점 포인트

- ordered가 모든 file contents와 여러 파일 변경을 원자 commit한다고 말하면 안 됩니다.
- replay 성공을 최신 bytes 보존의 증거로 해석하지 않습니다.
- ext4/JBD2 규칙을 다른 filesystem의 동일한 mode 이름으로 확장하지 않습니다.

## 더 파고들 거리

- 새 inode와 기존 block overwrite를 다른 위험으로 분리해 검증합니다.
- 복구 후 checksum·generation을 검사해 논리 data 유효성을 확인합니다.
- 정상 종료 benchmark와 power-loss crash test를 별도 실험으로 계획합니다.
