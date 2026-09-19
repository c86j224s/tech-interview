---
id: direct-io-buffered-overlap
title: >-
  한 프로세스는 O_DIRECT로 쓰고 다른 경로는 buffered read를 합니다. 같은 파일 범위를 혼용할 때 왜 일관성·성능을 따로
  검증해야 하나요?
difficulty: 중하
category: 운영체제
tags:
  - O_DIRECT
  - buffered I/O
  - page cache
  - 일관성
related:
  - os-mmap-pagecache
  - cache-aside-consistency
---
# 한 프로세스는 O_DIRECT로 쓰고 다른 경로는 buffered read를 합니다. 같은 파일 범위를 혼용할 때 왜 일관성·성능을 따로 검증해야 하나요?

## 구두 답변

같은 파일 범위에 O_DIRECT writer와 buffered reader를 겹치게 놓으면 coherency와 애플리케이션 최신성을 별도 문제로 다뤄야 합니다. 예를 들어 reader가 offset 0의 page를 page cache에 올려 `old`를 읽은 뒤 writer가 O_DIRECT로 같은 4 KiB를 `new`로 쓰는 상태를 생각해 보겠습니다. filesystem과 kernel이 cache invalidation이나 ordering을 어떻게 처리하는지는 구현 경로와 시점에 좌우되며, open(2)도 overlapping direct/buffered I/O를 피하라고 권고합니다. 따라서 “항상 stale” 또는 “항상 최신”이라고 단정하지 않고, writer의 direct completion 이후 version/lock/flush 경계를 reader가 관찰하는지 계약을 만들어야 합니다. 가장 단순한 선택은 같은 offset range의 owner를 direct 또는 buffered 한 경로로 고정하는 것입니다. 혼용이 필요하면 writer가 새 generation을 기록하고 completion을 알린 뒤 reader가 generation 검증과 재시도를 수행하도록 합니다. page cache가 우연히 무효화됐다는 사실만으로 데이터의 논리적 순서나 두 record의 원자성을 보장하지 않습니다. 성능도 별도입니다. cold/warm cache, sequential/random, overlap interleaving을 나누어 stale 관찰, p99 latency, CPU copy, eviction·flush 비용을 함께 측정해야 합니다. mmap writer까지 섞으면 mapping과 page cache 수명이 추가되므로 별도 시나리오로 취급합니다. 이 환경에서는 특정 filesystem의 실제 stale 결과를 실행하지 않았으므로, 구현별 coherency를 확인해야 한다는 제한을 유지합니다.

## 득점 포인트

- page cache의 old와 O_DIRECT writer의 new가 겹치는 구체 상태를 놓고 coherency와 논리 최신성을 분리합니다.
- 동일 range owner 또는 completion·version 경계를 두는 설계 선택을 제시합니다.
- stale 여부와 p99·CPU·eviction 비용을 각각 측정합니다.

## 감점 포인트

- 모든 filesystem에서 buffered read가 항상 stale이거나 항상 최신이라고 단정하지 않습니다.
- O_DIRECT가 overlap 혼용을 무료로 만들거나 page cache를 완벽히 무효화한다고 말하면 안 됩니다.
- mmap과 direct/buffered 경계를 일반 read 성능 설명으로 축소하지 않습니다.

## 더 파고들 거리

- cold/warm cache와 interleaving을 나눠 구현별 coherency를 측정합니다.
- writer completion 뒤 reader가 generation을 확인하는 프로토콜을 검증합니다.
- 실제 stale 관찰을 하지 않은 경우 특정 결과를 실행 사실처럼 말하지 않습니다.
