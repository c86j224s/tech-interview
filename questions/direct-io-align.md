---
id: direct-io-align
title: >-
  O_DIRECT read가 EINVAL로 실패합니다. buffer 주소·length·file offset 정렬을 어떤
  장치·filesystem 계약으로 확인하나요?
difficulty: 하
category: 운영체제
tags:
  - O_DIRECT
  - alignment
  - Linux
  - statx
related:
  - os-mmap-pagecache
---
# O_DIRECT read가 EINVAL로 실패합니다. buffer 주소·length·file offset 정렬을 어떤 장치·filesystem 계약으로 확인하나요?

## 구두 답변

O_DIRECT의 정답을 페이지 크기 하나로 고정하면 안 됩니다. buffer address, 요청 length, file offset을 각각 filesystem·kernel이 요구하는 단위와 대조해야 합니다. Linux man-pages가 설명하듯 어떤 구현은 세 값 모두 정렬을 요구하고, 조건은 파일시스템과 커널에 따라 달라집니다. 설명용으로 address=0x100000, length=4096, offset=0이면 4096 단위 계약을 만족하지만 같은 buffer로 offset=1024를 요청하면 offset 조건이 깨집니다. 반대로 512 단위 계약에서는 offset 1024가 허용될 수 있으므로 이 숫자를 보편 법칙으로 쓰지 않습니다. Linux 6.1 이상에서는 `statx`의 `STATX_DIOALIGN`으로 일부 파일의 direct-I/O alignment 정보를 질의할 수 있습니다. 값이 반환되지 않는다고 모든 정렬이 자유롭다는 뜻은 아니며 filesystem 문서와 실제 오류 처리를 통해 계약을 좁혀야 합니다. misalignment 결과는 `EINVAL`일 수도 있고 일부 filesystem에서는 buffered I/O로 처리될 수도 있으므로 성공만 보고 direct path였다고 판단하지 않습니다. short read/write와 partial completion도 별도 처리합니다. 진단 순서는 statx 결과 기록 → allocator가 반환한 실제 주소 확인 → length·offset 검증 → 반환값과 trace 확인입니다. NFS나 다른 filesystem은 local ext4와 alignment·persistence 정책이 다를 수 있습니다. 이 환경에서는 Linux `statx`와 O_DIRECT를 실행하지 않았으므로 4096 통과를 측정 결과로 주장하지 않고, 숫자는 계약 검산용 예제로만 사용합니다.

## 득점 포인트

- address·length·offset을 독립적으로 검사하고 `0x100000,4096,0`과 offset 1024의 대비를 듭니다.
- STATX_DIOALIGN의 Linux 6.1 이상 범위와 값 부재의 의미를 정확히 말합니다.
- EINVAL과 buffered fallback 가능성을 성공 판정과 분리합니다.

## 감점 포인트

- page size가 모든 direct-I/O 정렬 조건이라고 하거나 buffer만 맞추면 된다고 말하면 안 됩니다.
- O_DIRECT 성공을 O_SYNC durability 또는 반드시 direct path였다는 증거로 보지 않습니다.
- short I/O와 partial completion을 정렬 성공과 섞지 않습니다.

## 더 파고들 거리

- statx 결과·allocator 주소·length·offset·반환값을 순서대로 기록합니다.
- NFS와 다른 filesystem은 local ext4 계약을 복사하지 않고 별도 검증합니다.
- 실제 Linux 실행이 없으면 수치는 설명용 계약 계산으로 표시합니다.
