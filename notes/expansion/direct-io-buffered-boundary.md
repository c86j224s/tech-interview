---
id: direct-io-buffered-boundary
title: Direct I/O 정렬과 buffered I/O 경계
topic: 운영체제
summary: >-
  O_DIRECT의 buffer·length·offset 정렬, page cache와의 혼용, O_SYNC와 fork 수명 조건을 분리해
  판단합니다.
questionIds: []
prerequisites:
  - file-state
  - virtual-memory
related:
  - file-state
reviewedAt: '2026-09-19'
---
# Direct I/O 정렬과 buffered I/O 경계

`O_DIRECT`는 일반 page cache 경로를 우회하려는 의도이지 “항상 무캐시·항상 빠름·항상 내구” flag가 아닙니다. Linux man-pages는 filesystem과 kernel에 따라 user buffer 주소, 요청 length, file offset의 정렬이 필요할 수 있고 misalignment가 `EINVAL` 또는 buffered I/O가 될 수 있다고 설명합니다. direct와 buffered를 같은 범위에 섞을 때는 coherency·ordering을 따로 확인하고, durability가 필요하면 `O_SYNC`나 `fsync`를 별도로 선택합니다.

## Buffered path와 page cache

일반 read/write는 page cache를 사용할 수 있습니다. cache hit reader는 디스크 왕복 없이 읽고 writer는 dirty page를 나중에 flush할 수 있습니다. 따라서 syscall 수만 줄여 성능을 판단하면 cache hit, readahead, 복사, writeback과 memory pressure를 놓칩니다. direct path도 CPU cache와 device cache, filesystem metadata, 모든 복사를 자동으로 없애지는 않습니다.

Direct I/O는 user buffer와 storage 사이에서 file data를 직접 전달하려는 경로입니다. 구현은 filesystem·kernel·block device·network server에 의존합니다. 같은 flag라도 지원하지 않는 조건에서 오류나 다른 경로가 생길 수 있으므로 실제 반환과 trace를 계약의 일부로 봅니다.

## 세 가지 정렬 계약

정렬은 페이지 크기 하나가 아닙니다. buffer address는 user memory 시작 주소, length는 전송 크기, offset은 파일 내 위치입니다. 어떤 조합을 요구하는지는 filesystem과 kernel이 정합니다. 4096 정렬 buffer라도 offset 512 요구를 어기거나 length가 block 단위가 아니면 실패할 수 있습니다.

Linux 6.1 이상에서는 `statx`의 `STATX_DIOALIGN`으로 일부 파일의 direct-I/O alignment와 offset/length 요구를 질의할 수 있습니다. 값이 없다고 모든 값이 자유롭다는 뜻은 아닙니다. filesystem 문서와 오류 처리로 계약을 좁히고 NFS 서버 정책은 로컬 ext4와 별도로 검증합니다.

```diagram
{"title":"direct I/O의 세 계약을 확인합니다","caption":"정렬 성공과 cache 경계, persistence 경계는 서로 다른 조건입니다.","rows":[[{"id":"req","label":"O_DIRECT 요청","detail":["address · length · offset"]}],[{"id":"query","label":"alignment query","detail":["STATX_DIOALIGN 또는 FS 계약"]}],[{"id":"direct","label":"direct path","detail":["overlap 범위 확인"]}],[{"id":"durable","label":"내구 경계","detail":["O_SYNC · fsync · device"]}]],"edges":[{"from":"req","to":"query","label":"조건 조회"},{"from":"query","to":"direct","label":"정렬 요청"},{"from":"direct","to":"durable","label":"내구는 별도"}]}
```

## 정렬 실패와 fallback

설명용으로 address·length·offset 모두 4096 배수를 요구하는 구현을 가정하겠습니다. 4096 정렬 buffer로 offset 0, length 4096을 요청하면 통과하지만 같은 buffer를 offset 1024에 사용하면 offset 조건을 어깁니다. 512 단위만 필요한 구현이라면 같은 숫자가 허용될 수 있으므로 고정값을 보편 법칙으로 쓰지 않습니다.

misalignment 결과도 단일하지 않습니다. `EINVAL`이 될 수 있고 일부 filesystem에서는 buffered I/O로 처리될 수 있습니다. 애플리케이션이 direct flag만 보고 실제 경로를 단정하지 않도록 오류, trace, 문서를 함께 확인합니다. short I/O와 partial write도 정상 성공과 별도로 처리합니다.

## Direct·buffered 혼용

direct writer가 block을 바꾼 직후 buffered reader가 같은 범위를 읽으면 page cache에 이전 page가 남아 있거나 invalidation·ordering 시점이 겹칠 수 있습니다. filesystem이 일부 coherency 조정을 하더라도 애플리케이션 수준의 최신성·순서를 자동 보장하는 것은 아닙니다. man-pages도 overlapping direct/buffered I/O를 피하도록 권고합니다.

같은 범위 owner를 direct writer로 고정하고 reader도 같은 경로로 통일하거나, direct completion·flush·version 경계를 명시합니다. overlap이 불가피하면 cold/warm cache와 interleaving을 나눠 stale read와 throughput을 함께 측정합니다. mmap까지 섞는 경우 page cache와 mapping 수명도 추가합니다.

## O_DIRECT와 O_SYNC

`O_DIRECT`는 caching effects를 줄이는 목적이고 `O_SYNC`는 write의 동기화된 완료 조건을 요청합니다. direct write의 system call 반환은 device power-loss 뒤 보존의 증거가 아닙니다. 필요하다면 `O_DIRECT|O_SYNC` 또는 write 뒤 `fsync`를 대상 filesystem·device 계약에 맞춰 사용하고, 새 이름의 directory entry 내구는 별도로 봅니다.

direct+sync는 호출 지연과 flush 비용을 늘릴 수 있습니다. 정상 종료가 전원 장애 검증을 대신하지 않습니다. DB WAL이면 engine commit 정책과 filesystem sync 경계를 맞춰 중복 flush와 누락을 모두 확인합니다.

## fork와 buffer 수명

private heap·static buffer처럼 private mapping에 놓인 buffer로 asynchronous 또는 다른 thread의 direct I/O가 진행 중이라면 완료를 기다린 뒤 fork해야 합니다. Linux `open(2)`은 outstanding direct I/O가 있는 상태에서 fork하면 parent와 child의 private buffer가 분리되는 과정과 I/O가 충돌해 corruption 또는 undefined behavior 위험이 있다고 경고합니다. 예외로 문서가 언급하는 `MAP_SHARED`, `shmat` 영역과 `MADV_DONTFORK`로 상속을 막은 영역은 같은 private-buffer 규칙으로 묶지 않습니다. 안전한 순서는 I/O completion 확인 → buffer ownership 고정 또는 DONTFORK 설정 → fork이며, 단순히 주소 공간이 복제된다는 설명으로 충분하지 않습니다. 이 문서에서는 AIO를 실행하지 않았으므로 성공 결과를 주장하지 않습니다.

## 선택·비용·검증

DB buffer pool처럼 자체 cache와 eviction 정책이 있고 double caching을 줄여야 하며 큰 정렬 전송을 하는 경우 direct I/O를 검토합니다. 작은 random I/O에서는 padding·정렬·호출 latency가 이득을 앞설 수 있습니다. benchmark는 cold/warm, sequential/random, read/write, misalignment, buffered overlap을 분리하고 p99·CPU copy·cache pressure·flush latency를 함께 기록합니다.

근거는 Linux man-pages `open(2)`입니다. O_DIRECT의 Linux 2.4.10+ 역사, Linux 6.1+ `STATX_DIOALIGN`, alignment 의존성, EINVAL/fallback 가능성, O_SYNC 비대체성, overlap·fork 주의는 그 범위에서 말합니다. 실제 alignment 값과 NFS persistence는 대상 환경의 추가 확인이 필요한 source gap입니다.


## fork 전후 안전 상태

예를 들어 private 4 KiB buffer `B`에 direct read가 아직 outstanding인 상태에서 fork를 호출하는 경로를 금지 목록에 둡니다. `B`가 private heap이면 child가 같은 가상주소를 보더라도 COW와 커널의 진행 중 DMA 참조를 애플리케이션이 안전하게 조정할 수 없으므로 완료 전 fork는 corruption/undefined behavior 위험입니다. 완료 후 fork하거나 `MADV_DONTFORK`로 해당 영역을 상속하지 않게 해야 합니다. 반대로 `MAP_SHARED`·`shmat` 같은 명시적 공유 영역은 man-page의 예외 범위를 따로 읽고, 공유 쓰기 동기화까지 설계해야 합니다. fork 테스트를 했다는 사실만으로 모든 filesystem의 direct-I/O 안전성이 증명되는 것은 아닙니다.

## 계층별 진단 순서

오류를 만났을 때 먼저 `statx`로 alignment 질의 가능 여부와 반환 값을 기록하고, address·length·offset을 각각 출력합니다. 다음으로 overlapping page-cache range가 있는지, direct completion과 buffered read 사이에 version 또는 lock 경계가 있는지 확인합니다. 마지막으로 O_DIRECT 성공과 O_SYNC/fsync 완료를 분리해 latency와 전원 장애 보호 장치를 측정합니다. 이 순서를 지키면 정렬 실패를 coherency 문제로, stale 관찰을 durability 문제로 잘못 분류하는 비용을 줄일 수 있습니다.

### 참고 경로

- [https://man7.org/linux/man-pages/man2/open.2.html](https://man7.org/linux/man-pages/man2/open.2.html)

위 링크는 개념별 참고 경로이며, 본문에서 명시한 확인 범위와 미확인 구현 조건을 함께 적용합니다.
