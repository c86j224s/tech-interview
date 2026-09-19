---
id: column-compression-cpu
title: 압축률은 높지만 CPU가 부족한 columnar scan에서 compression codec 선택을 어떤 비용으로 판단하나요?
difficulty: 중하
category: 성능
tags:
  - columnar
  - compression
  - CPU
  - scan
related:
  - query-plan-history-sampling
---
# 압축률은 높지만 CPU가 부족한 columnar scan에서 compression codec 선택을 어떤 비용으로 판단하나요?

## 구두 답변

저장 크기와 end-to-end scan 비용을 분리하고, 동일한 row group·선택률·cache 상태·동시성에서 A/B를 비교하겠습니다. 원본 4GB에서 A의 압축률이 4:1이면 compressed read는 약 1GB이고, B가 2:1이면 2GB입니다. storage/network가 병목이고 CPU 여유가 충분하면 A가 1GB의 read를 줄일 수 있습니다. 반대로 A의 decode CPU가 B의 두 배이고 CPU가 90% 포화라면 A는 단일 scan의 read bytes를 줄여도 concurrent query p99를 악화시킬 수 있습니다.

예상 trace에는 compressed bytes, decompressed bytes, decode cycles, 전체 scan CPU, storage queue, network bytes, peak memory, first-result, p50/p95/p99를 둡니다. I/O-bound 조건에서는 read byte 감소와 wall time을, CPU-bound 조건에서는 rows/s per core와 query concurrency를, network-bound 조건에서는 전송량과 decode 여유를 우선 봅니다. 이 4GB·4:1·2:1 숫자는 codec benchmark가 아니라 병목을 설명하는 모델입니다.

또한 encoding과 codec을 혼동하지 않습니다. dictionary/RLE 같은 encoding이 먼저 값의 표현을 바꾸고, codec이 그 byte stream을 압축할 수 있습니다. writer가 만든 encoding을 reader가 지원하는지, codec default와 fallback이 어떤 release의 계약인지 별도 확인합니다. cache warm만으로 비교하면 object storage read와 cold first-result를 놓치므로 cold/warm을 나누고, CPU가 부족한 상태에서 worker 수를 늘렸을 때 p99가 더 나빠지는지도 기록하겠습니다.

## 득점 포인트

- 4GB 원본에서 1GB와 2GB compressed read를 계산합니다.
- I/O-bound와 CPU-bound에서 같은 codec의 선택이 달라질 수 있음을 설명합니다.
- decode CPU, concurrency, network/storage, first-result, p99를 동일 조건으로 계측합니다.

## 감점 포인트

- 압축률이 높은 codec이 항상 end-to-end로 빠르다고 단정합니다.
- decode CPU와 concurrent query 경합을 측정하지 않습니다.
- Parquet overview만으로 codec default와 reader fallback을 보장한다고 말합니다.

## 더 파고들 거리

- network storage에서 read byte 절감과 decode CPU를 각각 어떻게 counter로 분리할까요?
- warm-cache benchmark만 사용했을 때 실제 운영에서 놓치는 tail은 무엇인가요?
