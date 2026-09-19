---
id: column-dictionary-benefit
title: >-
  낮은 cardinality의 status 열을 Parquet dictionary encoding으로 저장할 때 어떤 반복과 비용이
  줄어드나요?
difficulty: 하
category: 데이터베이스
tags:
  - columnar
  - Parquet
  - dictionary-encoding
  - compression
related:
  - query-memory-grant-over-under
---
# 낮은 cardinality의 status 열을 Parquet dictionary encoding으로 저장할 때 어떤 반복과 비용이 줄어드나요?

## 구두 답변

Parquet encoding specification의 dictionary 방식은 한 column chunk의 dictionary page에 실제 값을 저장하고 data page에는 각 행의 integer ID를 RLE/bit-packing hybrid로 기록합니다. `pending`, `paid`, `cancelled`, `refunded` 네 값이 100만 행에 반복되면 문자열을 매 행 다시 쓰는 대신 ID 폭을 줄일 수 있습니다. dictionary page 자체는 비용이며, distinct value 수나 dictionary 크기가 커지면 plain encoding으로 fallback할 수 있으므로 낮은 cardinality에서만 이득을 기대합니다.

설명 산술을 분리해 보겠습니다. 평균 문자열 8바이트와 단순 metadata 1바이트라고 가정하면 원문 모델은 `1,000,000×9=9,000,000` decimal bytes입니다. 네 값 ID가 2bit라고만 가정하면 payload는 `1,000,000×2/8=250,000` bytes입니다. 하지만 이 0.25MB는 실제 Parquet 파일 크기가 아닙니다. dictionary entry, data page의 bit-width byte, RLE run header, page header, repetition/definition levels, compression codec을 제외한 illustrative payload 계산입니다.

cardinality가 100,000이면 dictionary page가 커지고 ID 폭이 증가합니다. 한 page 안에서 값 종류가 갑자기 늘면 writer가 dictionary를 중단하고 plain으로 fallback할 수 있으므로 page별 distinct count, dictionary bytes, 실제 encoding metadata, decode CPU를 기록하겠습니다. dictionary encoding은 codec과 같은 기능이 아니라 값 표현을 바꾸는 단계이며, 그 결과에 compression을 추가할 수 있습니다. 따라서 모든 열에 강제하지 않고 status 분포와 reader 지원을 함께 검증합니다.

## 득점 포인트

- dictionary page, data page ID, RLE/bit-packing, fallback의 순서를 설명합니다.
- 9,000,000과 250,000의 단순 계산을 실제 파일 크기와 구분합니다.
- page별 cardinality와 dictionary overhead를 측정합니다.

## 감점 포인트

- dictionary가 모든 문자열을 항상 더 작게 만든다고 합니다.
- dictionary encoding과 compression codec을 같은 단계로 설명합니다.
- dictionary page, ID framing, fallback 비용을 계산에서 제외한 채 실측값처럼 말합니다.

## 더 파고들 거리

- 한 page에서 distinct value가 급증할 때 writer가 확인할 metadata와 counter는 무엇인가요?
- ID 분포가 긴 run일 때 RLE와 bit-packing의 상대적 이득을 어떻게 확인할까요?
