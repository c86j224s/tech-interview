---
id: lsm-read-amplification-levels
title: LSM에 같은 키가 여러 SSTable에 있을 때 최신 값을 찾는 읽기 경로와 read amplification을 어떻게 줄이겠습니까?
difficulty: 중하
category: 데이터베이스
tags:
  - LSM
  - SSTable
  - read-amplification
  - Bloom-filter
related:
  - bloom-filter-tradeoff
---
# LSM에 같은 키가 여러 SSTable에 있을 때 최신 값을 찾는 읽기 경로와 read amplification을 어떻게 줄이겠습니까?

## 구두 답변

point lookup은 active memtable과 immutable memtable을 먼저 확인하고, 그다음 최신 SSTable에서 오래된 파일로 내려가며 실제 key와 sequence를 비교합니다. Bloom filter negative는 해당 파일의 block read를 생략할 수 있는 근거지만, positive는 존재 증명이 아니므로 index block과 data block을 확인해야 합니다. 또한 tombstone을 만난 뒤 오래된 value를 계속 반환하면 삭제가 부활하므로, 최신으로 보이는 삭제 표식도 하나의 결과입니다.

구체적으로 `F3: k@30=tombstone`, `F2: k@20=v2`, `L1: k@10=v1`이면 F3 filter가 positive이고 data block에서 k@30을 확인하는 순간 최신 결과는 부재입니다. F2와 L1을 더 읽는 것은 불필요하거나, snapshot 계약이 있는 엔진이라면 snapshot sequence에 따라 별도 판단합니다. 반대로 F3 filter negative, F2 positive라면 F3 block은 건너뛰고 F2에서 key를 검증합니다. F2 positive인데 실제 key가 없다면 false positive였던 것이며 L1로 계속 내려갑니다.

read amplification은 “파일이 세 개”라는 숫자만으로 평가하지 않습니다. filter probe 수, index block read, 실제 data block read, 압축 해제, iterator merge, cache hit/miss를 함께 기록합니다. 후보를 줄이는 방법은 level overlap을 제한하는 compaction, 적절한 Bloom filter, index block cache, block cache입니다. 하지만 compaction을 자주 하면 rewrite와 background I/O가 늘어 write p99가 나빠질 수 있습니다. cold lookup과 warm cache 평균을 분리해 같은 key 분포에서 비교하겠습니다.

## 득점 포인트

- active·immutable·최신 파일 순서와 sequence 최신성을 실제 상태로 추적합니다.
- Bloom negative와 positive의 의미, false positive의 다음 탐색 경로를 구분합니다.
- tombstone을 값이 없는 결과로 취급하고 filter/index/block 비용을 계측합니다.

## 감점 포인트

- Bloom positive를 key 존재의 증명으로 설명합니다.
- 오래된 파일에서 먼저 찾은 value를 최신성 확인 없이 반환합니다.
- tombstone을 cache miss로 취급해 이전 value를 되살립니다.

## 더 파고들 거리

- 모든 파일의 Bloom filter가 positive인 cold lookup에서 실제 block read 수를 어떤 counter로 분해할까요?
- snapshot sequence가 오래 유지될 때 compaction이 후보 파일을 줄이지 못하는 이유를 설명해 보세요.
