---
id: journal-writeback-mode
title: >-
  ext4 data=writeback을 성능 때문에 선택합니다. metadata가 복구돼도 오래된 또는 초기화되지 않은 file data가
  보일 수 있는 이유는 무엇인가요?
difficulty: 중하
category: 운영체제
tags:
  - ext4
  - writeback
  - journaling
  - crash recovery
related:
  - file-checksum-integrity
---
# ext4 data=writeback을 성능 때문에 선택합니다. metadata가 복구돼도 오래된 또는 초기화되지 않은 file data가 보일 수 있는 이유는 무엇인가요?

## 구두 답변

ext4 `data=writeback`은 metadata transaction이 dirty file data의 flush를 기다리지 않는 모드입니다. 따라서 metadata가 journal에서 replay되어 이름과 size가 살아나는 시점과 data block에 새 bytes가 도착하는 시점이 분리됩니다. 상태를 `D=old`, `D=new dirty`, `N,size=5,x dirty`, `metadata commit valid`로 기록해 보겠습니다. metadata commit 뒤 D flush 전에 crash가 나면 replay는 x와 size를 복원할 수 있지만 D가 새 값으로 durable하다는 보장은 없습니다. 결과는 새 값이 아니라 오래된 값이거나, 해당 block 기록이 아직 반영되지 않은 상태일 수 있습니다. 이를 곧바로 “항상 초기화되지 않은 보안 데이터가 노출된다”고 일반화해서는 안 됩니다. 그 구체적 재사용·zeroing 조건은 ext4의 별도 근거와 실제 환경 검증이 필요하며, 여기서는 file data 최신성과 crash 후 일관성이 보장되지 않는다는 범위로 말합니다. commit record가 있다고 해서 data block까지 같은 의미로 journal 보호된 것도 아닙니다. 그래서 replay 성공 후에는 포맷 checksum, generation, payload length, complete marker를 검사하고 불완전 record를 거부합니다. 최신 bytes가 반드시 필요한 파일은 writeback mode에 기대지 말고 application flush·fsync와 recovery protocol을 함께 설계합니다. 이 판단은 ext4/JBD2 문서의 data=writeback semantics에 한정되며, 모든 filesystem의 writeback을 같은 규칙으로 취급하지 않습니다.

## 득점 포인트

- writeback은 metadata가 dirty data flush를 기다리지 않아 이름·size와 data 최신성이 분리된다고 설명합니다.
- metadata commit 후 D flush 전 crash에서 새 bytes가 보장되지 않는 trace를 제시합니다.
- 초기화되지 않은 보안 노출은 별도 조건과 근거가 필요한 주장으로 제한합니다.

## 감점 포인트

- commit record가 data block까지 같은 transaction으로 보호한다고 말하면 안 됩니다.
- writeback을 journaling이 완전히 꺼진 모드로 표현하지 않습니다.
- replay 성공을 사용자 data 최신성과 동일시하지 않습니다.

## 더 파고들 거리

- checksum·generation·complete marker로 포맷 수준의 불완전 결과를 거부합니다.
- ext4/JBD2 문서가 보장하는 ordering과 환경별 device 결과를 분리합니다.
- 실제 crash를 실행하지 않은 경우 예상 상태와 관측값을 구분합니다.
