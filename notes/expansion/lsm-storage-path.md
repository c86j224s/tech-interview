---
id: lsm-storage-path
title: LSM memtable·SSTable 읽기·쓰기 증폭
topic: 데이터베이스
summary: >-
  메모리의 정렬 버퍼와 디스크 SSTable, WAL, flush·compaction을 한 경로로 추적하고 읽기·쓰기 증폭과 tombstone
  정리 비용을 구분합니다.
questionIds: []
prerequisites:
  - wal-recovery
  - indexes
  - bloom-filter
related:
  - external-sort
  - cache-policy
reviewedAt: '2026-09-19'
---
# LSM memtable·SSTable 읽기·쓰기 증폭

LSM(Log-Structured Merge) 저장소는 정렬된 디스크 구조를 매번 제자리에서 수정하지 않고, 최근 변경을 로그와 메모리 구조에 모은 뒤 정렬된 SSTable로 내보내고 파일을 병합합니다. 이 설계의 핵심은 “WAL에 썼다”, “메모리에서 보인다”, “SSTable 파일이 만들어졌다”, “현재 version에 게시됐다”가 서로 다른 상태라는 점입니다. 제품마다 로그와 memtable의 내부 순서는 다를 수 있으므로, 공통 설명에서는 상태를 분리하고 특정 엔진의 내구 응답을 일반 규칙처럼 말하지 않아야 합니다.

## 변경 수명

LevelDB 구현 문서는 현재 log 파일에 update를 append하고 그 log의 내용을 메모리 memtable이 반영해 읽기가 모든 logged update를 보게 된다고 설명합니다. 로그가 대략 4MB에 도달하면 새 memtable과 log를 만들고 이전 memtable을 background에서 SSTable로 변환합니다. 이 문서가 보장하는 것은 log·memtable·sorted table의 관계이지, 모든 LSM에서 “WAL fsync 완료 후 memtable insert”라는 순서나 commit 응답 의미가 아닙니다. 따라서 설계 표에는 `log append`, `durable ack`, `active visibility`를 별도 열로 둡니다.

예를 들어 active memtable이 63.5MiB이고 한도 64MiB에서 2MiB batch가 들어오면 구현은 active를 freeze하고 새 active를 만들어 쓰기를 이어갈 수 있습니다. freeze 시점에 immutable의 항목은 변하지 않지만, flush가 끝날 때까지 active와 immutable이 동시에 메모리에 존재합니다. 이때 peak 메모리는 64MiB 하나가 아니라 두 세대와 WAL buffer, index 작업 공간의 합으로 계산해야 합니다.

## 세대 전환

한 세대의 상태는 `active → immutable → SSTable output → serving version`으로 추적합니다. immutable은 정렬되어 data block, index block, 선택적 filter를 가진 임시 output이 됩니다. output 파일이 완성되어도 reader가 즉시 열어 보는 것은 안전한 게시와 다릅니다. LevelDB implementation notes는 MANIFEST가 각 level의 serving table과 key range를 기록하고 CURRENT가 최신 MANIFEST 이름을 가리킨다고 설명합니다. 복구는 CURRENT를 읽고 MANIFEST의 파일 집합을 적용한 뒤, 남은 log를 level-0 SSTable로 바꾸는 경로입니다.

```diagram
{"title":"LSM 세대와 공개 경계","caption":"로그·메모리·파일 생성·serving version을 분리한 상태 추적입니다.","rows":[[{"id":"op","label":"논리 변경","detail":["key, value, sequence"]}],[{"id":"log","label":"Log 기록","detail":["내구 응답은 별도 계약"]},{"id":"mem","label":"Active memtable","detail":["최근 read에 반영"]}],[{"id":"imm","label":"Immutable","detail":["freeze 후 flush 입력"]}],[{"id":"sst","label":"SSTable output","detail":["정렬 block·index"]}],[{"id":"ver","label":"Serving version","detail":["MANIFEST가 파일 집합 지시"]}]],"edges":[{"from":"op","to":"log","label":"append"},{"from":"op","to":"mem","label":"visibility"},{"from":"mem","to":"imm","label":"freeze"},{"from":"imm","to":"sst","label":"flush"},{"from":"sst","to":"ver","label":"publish"}]}
```

## SSTable 탐색

SSTable은 key 순서로 정렬된 value 또는 deletion marker의 목록입니다. LevelDB 설명에서 level-0 파일은 서로 겹칠 수 있고, level 1 이상은 distinct non-overlapping key range를 유지하도록 구성됩니다. point lookup은 active와 immutable을 먼저 확인한 후 최신 파일부터 후보를 좁힙니다. Bloom filter의 음성은 “이 파일에 없을 수 있으니 block read를 생략”하는 근거지만, 양성은 존재 증명이 아닙니다. 양성 파일에서는 index block으로 범위를 찾고 실제 key와 sequence를 비교해야 합니다.

`F3: k@30=tombstone`, `F2: k@20=v2`, `L1: k@10=v1`이면 F3 block을 읽은 순간 최신 상태는 부재입니다. F2와 L1의 값을 뒤져 최신 tombstone을 무시하면 삭제된 key가 부활합니다. snapshot-aware 엔진은 snapshot sequence에 따라 보이는 version을 별도로 선택할 수 있지만, LevelDB 구현 notes만으로 snapshot 계약을 일반화할 수는 없습니다.

## Tombstone 수명

삭제 표식은 오래된 value를 숨기는 동안 필요한 논리 기록입니다. LevelDB 문서가 명시하는 drop 조건은 현재 key를 덮을 수 있는 higher-numbered level의 overlapping file이 없을 때 deletion marker를 버릴 수 있다는 file-range 조건입니다. 이 조건은 snapshot, replica, backup 보존 정책 전체를 설명하지 않습니다. 그러므로 공통 장에서는 `Fnew(k@200 delete)`와 `Fold(k@150 value)`를 같은 compaction 입력에서 합쳐 최신 항목만 남기는 경우와, 입력 밖의 오래된 file이 아직 serving version에 있는 경우를 나눕니다. 다른 MVCC 제품에서 snapshot·replica 수명이 추가 제약이 되는지는 해당 제품 문서를 확인해야 합니다.

## 증폭 계산

write amplification의 분모는 사용자 payload인지, encoded logical record인지 먼저 고정합니다. 설명 모델에서 logical payload 1GB, WAL write 1GB, flush output 1GB, compaction output 3GB라면 WAL 포함 합계는 5GB, 비율은 `5/1 = 5`입니다. WAL을 storage write에서 제외하는 대시보드라면 `(1+3)/1 = 4`로 표시됩니다. 실제 장치 write bytes는 압축 후 output, metadata, filesystem writeback, replication에 따라 달라지므로 두 숫자를 같은 지표처럼 합치면 안 됩니다.

read amplification은 단순 파일 개수가 아니라 filter/index probe, 실제 data block read, 압축 해제와 iterator merge 비용을 포함해 관찰할 수 있습니다. space amplification은 중복 version, tombstone, compaction 임시 입력·출력, WAL을 언제 포함하는지 정의해야 합니다. 같은 평균 WA라도 한 시간에 골고루 5GB를 쓰는 경우와 5분 동안 5GB를 몰아 쓰는 경우는 foreground p99와 disk headroom이 다릅니다.

## 장애 복구

강제 종료 시험은 사건을 순서대로 나눕니다. log만 기록된 시점에는 MANIFEST에 새 SSTable이 없으므로 recovery가 log를 replay합니다. SSTable output은 완성됐지만 MANIFEST가 가리키지 않으면 serving set의 근거로 세지 않고 stale file 정리 대상이 될 수 있습니다. MANIFEST가 새 파일 집합을 가리킨 뒤 process가 죽으면 recovery는 그 version을 읽습니다. 정확한 atomic publication과 fsync 경계는 엔진 문서와 설정을 확인해야 합니다.

검증 데이터는 `put(k,v1) → put(k,v2) → delete(k) → restart`, flush 중 종료, compaction 중 종료를 각각 실행해야 합니다. 각 케이스에서 응답을 받은 sequence, 재시작 후 visible value, CURRENT가 가리킨 MANIFEST, orphan 파일을 기록합니다. 이 batch에서는 LevelDB 문서 텍스트는 읽었지만 실제 DB runtime을 실행하지 않았으므로 수치는 설명용 계산입니다.

## 운영 비용

관찰 후보는 active·immutable 크기, flush backlog, level-0 파일 수, compaction input/output bytes, block read 수, Bloom negative 비율, cache hit, foreground delay, stall 지속 시간, disk free입니다. RocksDB wiki는 compaction style이 read/write/space amplification 사이를 교환한다고 설명하지만, 확인한 moving wiki만으로 특정 release의 pending-compaction metric 정의나 stall threshold를 확정할 수는 없습니다. 그러므로 지표 이름을 규범처럼 복사하지 말고 release별 statistics 문서와 실제 metric schema를 대조합니다.

## 선택 경계

point lookup p99가 우선이면 overlap을 제한하고 filter·index memory를 확보하는 정책이 유리할 수 있습니다. append 중심 ingestion은 rewrite를 늦추는 대신 공간 peak와 나중의 read tail을 예산에 넣어야 합니다. memtable을 키우는 처방은 stall까지의 시간을 늦출 뿐 compaction debt를 없애지 않습니다. worker를 늘리는 처방 역시 CPU와 foreground I/O 경합을 먼저 측정해야 합니다.

## 참고 자료

- LevelDB implementation notes, https://raw.githubusercontent.com/google/leveldb/main/doc/impl.md, 2026-09-19 읽음. log, memtable, sorted table, level, MANIFEST/CURRENT, deletion marker와 recovery 절을 직접 대조했습니다. repository main은 고정 release가 아닙니다.
- RocksDB Memtable, https://github.com/facebook/rocksdb/wiki/Memtable, 2026-09-19 읽음. active/immutable flush 개념의 보조 근거로만 사용했으며 WAL ordering과 release default는 확인하지 못했습니다.
- RocksDB Compaction, https://github.com/facebook/rocksdb/wiki/Compaction, 2026-09-19 읽음. amplification trade-off의 보조 근거이며 metric threshold와 tombstone retention 전체를 확정하는 근거로 사용하지 않았습니다.
