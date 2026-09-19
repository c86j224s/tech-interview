---
id: lsm-leveled-overlap
title: >-
  Leveled compaction에서 상위 level의 key range overlap을 줄이는 이유와 overlap이 커질 때 읽기 비용을
  설명해 보세요.
difficulty: 중하
category: 데이터베이스
tags:
  - LSM
  - leveled-compaction
  - overlap
related:
  - db-query-plan-regression
---
# Leveled compaction에서 상위 level의 key range overlap을 줄이는 이유와 overlap이 커질 때 읽기 비용을 설명해 보세요.

## 구두 답변

leveled compaction의 목표는 특히 L1 이상에서 파일 범위를 가능한 한 겹치지 않게 만들어 point lookup이 검사할 후보를 줄이는 것입니다. 파일 내부가 정렬됐다는 것과 파일 사이가 disjoint라는 것은 다릅니다. 예를 들어 선택 파일이 `[40,60]`이고 target level에 `[30,50]`, `[51,70]`가 있으면 두 파일 모두 입력입니다. merge 후 결과를 target level의 범위 규칙에 맞게 나누면 다음 조회는 key가 속한 파일을 더 좁게 찾을 수 있습니다.

Level 0은 flush 파일끼리 overlap할 수 있으므로 L0→L1은 여러 L0 파일을 함께 다루는 예외가 생길 수 있습니다. 이를 무시하고 “leveled이면 전 level이 전역 비겹침”이라고 말하면 틀립니다. L1 이상에서 overlap이 커지면 k를 찾을 때 Bloom filter positive 파일이 여러 개가 되고 index block과 실제 data block을 여러 번 읽을 수 있습니다. range scan은 한 key만 찾는 point lookup보다 겹치는 범위를 모두 merge해야 하므로 후보 증가의 비용이 더 직접적으로 드러납니다.

이득의 대가는 rewrite입니다. `[30,50]` 전체 target file이 선택 범위와 겹치므로 실제로는 필요한 부분보다 많은 bytes를 읽고 다시 쓰게 될 수 있습니다. 따라서 point lookup p99와 read amplification이 우선이면 overlap 제한의 가치를 높게 보고, write-heavy workload라면 compaction CPU·background I/O·stall을 함께 봅니다. size ratio와 picker는 엔진별로 다르므로 범위 trace는 설명 모델이고, 실제 선택은 release별 compaction log로 검증하겠습니다.

## 득점 포인트

- 파일 내부 정렬과 파일 간 key-range overlap을 구분합니다.
- `[40,60]`과 `[30,50]`, `[51,70]`의 입력 선택을 단계별로 설명합니다.
- L0 예외, point lookup과 range scan 차이, rewrite 비용을 함께 말합니다.

## 감점 포인트

- leveled라는 이름만으로 모든 level이 항상 비겹침이라고 단정합니다.
- Bloom positive를 key 존재로 해석해 실제 block 검사를 생략합니다.
- read 후보 감소만 말하고 compaction rewrite와 foreground 경합을 빼먹습니다.

## 더 파고들 거리

- 같은 overlap이 range scan에서 merge iterator 비용을 키우는 과정을 설명해 보세요.
- level size ratio와 output splitting이 physical write bytes를 바꾸는 경로는 무엇인가요?
