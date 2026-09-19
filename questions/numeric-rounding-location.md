---
id: numeric-rounding-location
title: 라인별 반올림 후 합산과 전체 합산 후 한 번 반올림이 다른데 어느 경계를 선택하겠습니까?
difficulty: 중하
category: 설계
tags:
  - money
  - rounding
  - decimal
  - invoice
related:
  - db-materialized-view-refresh
---
# 라인별 반올림 후 합산과 전체 합산 후 한 번 반올림이 다른데 어느 경계를 선택하겠습니까?

## 구두 답변

어느 방식이 항상 옳다고 정하지 않고 청구·세금 규칙이 정의한 금액 단위를 먼저 선택하겠습니다. line rounding이 계약이면 각 line 계산 결과를 지정된 mode로 확정해 원장에 남기고 합산합니다. total rounding이 계약이면 내부 scale을 유지한 line 값을 합산한 뒤 invoice 게시 경계에서 한 번 반올림합니다. 둘은 교환 가능한 최적화가 아니라 다른 결과 의미입니다.

세 line의 중간 결과가 각각 `0.005`라면 line 결과의 합과 먼저 `0.015`를 만든 뒤 한 번 줄인 값이 달라질 수 있습니다. PostgreSQL numeric 기준은 ties-away-from-zero이며 half-even 등 다른 정책은 별도 구현입니다. mode와 경계를 fixture로 고정하겠습니다. DB 함수 한 번이 도메인 규칙을 자동 선택하지는 않습니다.

저장 모델에는 계산 규칙 version, 통화, line 원장값, 게시 total을 구분합니다. projection이나 materialized view도 같은 version과 경계를 사용하게 하고, 이미 발행한 invoice를 새 규칙으로 소급할지 보정 원장으로 남길지 정합니다. 표시 formatter가 임의로 반올림한 값을 정산값으로 재사용하지 않겠습니다.

PostgreSQL numeric 기준으로 세 줄 `0.005`를 구체적으로 추적하면 line rounding은 각 값을 0.01로 만들어 0.03이 되고, total rounding은 먼저 0.015를 만든 뒤 0.02가 됩니다. PostgreSQL의 ties-away-from-zero를 사용한 설명이며 half-even을 선택한 다른 정책은 별도 결과입니다. 따라서 `ROUND` 함수 한 번을 넣는다고 line과 total 중 하나가 자동으로 정답이 되지 않습니다.

저는 세금 규칙이 확정한 경계를 계산 version과 함께 저장합니다. line 방식은 확정된 line amount와 조정 차액을 원장에 남기고, total 방식은 내부 고정밀 line과 게시 total을 분리합니다. 이미 발행된 invoice는 새 rounding 정책으로 소급하지 않고 보정 전표나 새 version으로 재현합니다. materialized view는 원장 version과 같은 fixture로 refresh 전후 합계를 비교해야 하며 표시용 문자열을 정산 입력으로 재사용하지 않습니다.

## 득점 포인트

- line과 total 중 법적·업무 원장을 먼저 선택합니다.
- rounding mode와 규칙 version을 저장합니다.
- 0.005 사례로 비결합성을 설명합니다.
- 표시값·게시 total·내부 계산값을 구분합니다.

## 감점 포인트

- DB의 ROUND 호출이 모든 세금 정책을 결정한다고 합니다.
- line 합산과 total 합산이 언제나 같다고 합니다.
- 화면에 보이는 값만 저장해 재현성을 잃습니다.

## 더 파고들 거리

- 반올림 규칙이 바뀐 뒤 이미 발행한 invoice를 어떻게 보정할까요?
- materialized view refresh가 서로 다른 계산 version을 섞지 않게 하려면 무엇을 검사하나요?
