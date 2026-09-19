---
id: filesystem-journaling-modes
title: 파일시스템 저널링과 데이터 모드
topic: 운영체제
summary: >-
  ext4 metadata journaling의 ordered·writeback·journal 모드와 commit record 기반
  replay를 DB WAL과 구분합니다.
questionIds: []
prerequisites:
  - wal-recovery
  - file-state
related:
  - wal-recovery
reviewedAt: '2026-09-19'
---
# 파일시스템 저널링과 데이터 모드

ext4 저널이 있다고 해서 파일 내용이 항상 최신이고 논리적으로 원자적인 것은 아닙니다. JBD2 transaction은 filesystem metadata를 다루고, `data=ordered`, `data=writeback`, `data=journal`은 file data를 journal과 home location에 어떤 순서로 기록할지 다르게 정합니다. crash 뒤 replay가 filesystem 구조를 복구하는 일과 사용자가 기대한 최신 bytes를 보존하는 일은 분리해야 합니다.

## Metadata와 file data

파일 생성·크기 변경·directory entry는 inode와 directory 구조를 바꾸는 metadata입니다. 실제 사용자 bytes는 file data block이고, 같은 write도 data와 metadata가 서로 다른 dirty 상태로 존재할 수 있습니다. journaling은 우선 mount·lookup이 가능한 filesystem 구조를 지키는 장치이며 DB의 논리 transaction을 대신하지 않습니다.

`hello`를 쓰며 새 inode size를 5로 바꾸는 동안 crash가 나면 inode, directory entry, data block의 기록 순서가 문제가 됩니다. `write()` 반환도 장치 내구와 같지 않습니다. 필요한 애플리케이션 durability는 ext4 mode 외에 `fsync`, storage flush와 power-loss 보호를 포함해야 합니다.

## JBD2 transaction과 replay

ext4는 metadata 변경을 transaction에 모아 journal에 기록하고 유효한 commit record와 checksum을 기준으로 replay합니다. commit record가 없거나 검증이 안 되는 transaction을 완료된 변경으로 취급하지 않을 수 있습니다. 이 구조는 metadata update가 반쯤 적용되어 directory tree가 깨지는 범위를 줄입니다.

replay는 “마지막 사용자가 쓴 모든 byte를 원래 의도대로 되살리는” 기능이 아닙니다. journal에 들어간 대상, data ordering, flush 계약을 따라 filesystem 구조를 재구성합니다. 그래서 DB WAL처럼 여러 파일의 애플리케이션 의미를 하나의 commit으로 해석하지 않습니다.

```diagram
{"title":"metadata transaction과 file data의 순서","caption":"세 ext4 data mode가 data block과 metadata를 어느 경로로 다루는지 구분합니다. replay 가능한 commit은 논리 transaction과 다릅니다.","rows":[[{"id":"data","label":"file data","detail":["dirty block"]},{"id":"meta","label":"metadata","detail":["inode · directory"]}],[{"id":"ordered","label":"data=ordered","detail":["data flush 후 metadata journal"]},{"id":"wb","label":"data=writeback","detail":["metadata journal, data 독립"]},{"id":"full","label":"data=journal","detail":["data와 metadata journal"]}],[{"id":"commit","label":"commit record","detail":["유효 transaction"]}],[{"id":"replay","label":"crash replay","detail":["filesystem 구조 복구"]}]],"edges":[{"from":"data","to":"ordered","label":"mode 경로"},{"from":"meta","to":"ordered","label":"metadata"},{"from":"ordered","to":"commit","label":"ordered 기록"},{"from":"wb","to":"commit","label":"metadata 기록"},{"from":"full","to":"commit","label":"full journal"},{"from":"commit","to":"replay","label":"장애 뒤 적용"}]}
```

## data=ordered

ordered에서는 관련 dirty file data가 flush된 뒤 metadata transaction이 journal에 기록되는 순서를 연결합니다. 새 inode나 파일 크기를 가리키는 metadata가 복구될 때, metadata가 가리키는 block이 초기화되지 않은 상태가 되는 가능성을 줄이는 방향입니다. 그러나 모든 data가 최신이라는 뜻은 아닙니다.

이미 존재하는 file block overwrite, 여러 파일에 나뉜 논리 transaction, 장치 내부 cache의 전원 장애 결과는 별도 조건입니다. “ordered”는 metadata와 관련 data의 ordering이지 DB식 all-or-nothing commit이 아닙니다. commit 뒤 crash와 flush 전 crash를 같은 결과로 설명하지 않습니다.

## data=writeback

writeback은 metadata transaction이 dirty file data flush를 기다리지 않습니다. 따라서 metadata가 journal에서 replay되어 이름과 size가 살아도 data block이 새 값으로 flush됐다는 보장이 없습니다. 새 파일 생성 중 crash에서 metadata는 보이지만 bytes가 오래된 상태이거나 아직 원하는 값이 아닐 수 있습니다.

이 모드는 metadata 구조와 data 최신성을 분리해 비용을 낮출 수 있지만, 파일 포맷이 즉시 유효한 내용을 요구하면 자체 checksum, generation, complete marker로 검증합니다. replay 성공은 file contents의 최신성·논리 무결성을 검사한 결과가 아닙니다.

## data=journal

data=journal은 file data와 metadata를 모두 journal transaction으로 다룹니다. valid commit 범위의 data와 metadata를 replay 경로에서 함께 다룰 수 있어 ordered보다 직접적인 data 보호를 제공하지만, data가 journal에 한 번 기록되고 이후 home location으로 반영되는 경로로 쓰기 대역폭과 latency가 증가할 수 있습니다.

4 KiB write를 단순화하면 journal에 data+metadata를 기록한 뒤 최종 block으로 checkpoint하는 단계가 생깁니다. ordered는 data를 home location에 flush하고 metadata를 journal에 기록하는 모델이라 data를 journal에 추가 복제하지 않습니다. 이 숫자와 경로는 설명용 모델이며 실제 batching·block size 측정 결과가 아닙니다.

## DB WAL과의 경계

DB WAL은 record·page·commit·checkpoint를 DB recovery 규칙으로 연결합니다. ext4 journal은 filesystem metadata와 선택된 data mode를 다루며 WAL 레코드의 의미를 해석하지 않습니다. DB가 commit을 WAL에 기록해도 ext4가 여러 DB 파일 변경을 하나의 논리 transaction으로 원자화하지 않습니다.

반대로 DB WAL 파일의 flush는 storage 계층과 협력해야 하므로 DB engine의 flush 정책, filesystem ordering, device cache를 함께 검증합니다. “저널이 있으니 복구된다”가 아니라 어느 계층의 어떤 record가 유효한지 말해야 합니다.

## 비용과 선택

writeback은 data ordering 대기를 줄일 수 있지만 최신 data 보호 책임을 애플리케이션으로 더 넘깁니다. ordered는 일반적인 metadata consistency와 관련 data 순서를 균형 있게 잡지만 모든 overwrite의 최신성이나 논리 transaction을 해결하지 않습니다. journal은 보호 범위 대신 journal bandwidth, 쓰기 증폭, flush 비용을 부담합니다.

선택은 data 재생성 가능성, crash 뒤 구형 data 허용 여부, write rate, storage latency, DB의 별도 WAL 여부로 결정합니다. ext4 mode를 다른 filesystem의 일반 계약으로 확장하지 않습니다.

## 장애 검증과 참고 범위

합성 환경에서 새 inode·data block·metadata commit의 세 시점에 장애를 주고 재마운트 뒤 name, size, checksum을 확인해야 합니다. 정상 종료는 전원 손실을 시험한 것이 아닙니다. 이 문서에서는 실제 crash 실험을 하지 않았으므로 시점별 결과는 메커니즘을 설명하는 예상 상태입니다.

근거는 Linux kernel ext4 journal 문서입니다. 그 문서가 설명하는 ordered/writeback/journal과 commit record/checksum replay는 ext4/JBD2 범위에 한정합니다. universal minimum kernel version이나 모든 파일시스템의 동일한 모드는 이 자료로 확정하지 않습니다.


## 시점별 crash trace

새 inode `N`과 data block `D`에 `hello`를 쓰고 directory entry `x`를 추가하는 설명용 trace를 보겠습니다. `write(D)`만 dirty인 시점, metadata transaction에 `N,size=5,x`가 들어간 시점, commit record와 관련 flush가 끝난 시점을 따로 놓습니다. ordered에서는 관련 data flush가 metadata journal commit보다 앞서도록 묶이지만, commit 전 장애와 commit 후 장치 전원 손실은 같은 상태가 아닙니다. writeback에서는 metadata가 먼저 journal에 확정될 수 있어 replay 뒤 `x`와 size가 관찰되어도 D의 새 bytes가 이미 보존됐다고 결론낼 수 없습니다. journal mode에서는 data와 metadata가 journal 경로에 같이 들어가 valid commit 범위의 replay 대상이 되지만 이후 home location checkpoint와 device flush는 여전히 관찰 항목입니다. 이 trace는 실행한 crash 실험이 아니라 문서 규칙을 검산하는 예상 상태입니다.

## 포맷 검증과 운영 판단

파일 포맷이 부분 결과를 허용하지 않는다면 mode 선택만으로 해결하지 말고 header checksum, generation, payload length, complete marker를 함께 둡니다. recovery 시 marker와 checksum이 맞지 않으면 해당 record를 폐기하고 이전 generation으로 돌아가는 정책을 구현합니다. 측정은 write rate, journal commit latency, checkpoint backlog, power-loss 보호 유무를 분리해야 하며 정상 종료 benchmark는 crash replay 검증이 아닙니다. ext4/JBD2 문서에서 확인한 ordered·writeback·journal과 commit/checksum replay를 다른 filesystem의 보편 계약으로 일반화하지 않습니다.

### 참고 경로

- [https://docs.kernel.org/filesystems/ext4/journal.html](https://docs.kernel.org/filesystems/ext4/journal.html)

위 링크는 개념별 참고 경로이며, 본문에서 명시한 확인 범위와 미확인 구현 조건을 함께 적용합니다.
