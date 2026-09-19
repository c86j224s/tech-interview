---
id: column-vector-selection
title: 필터가 1% 행만 통과하는 분석 쿼리에서 columnar vectorized execution이 어떤 데이터 이동을 줄이나요?
difficulty: 중하
category: 성능
tags:
  - columnar
  - vectorized-execution
  - selection-vector
related:
  - query-memory-grant-over-under
---
# 필터가 1% 행만 통과하는 분석 쿼리에서 columnar vectorized execution이 어떤 데이터 이동을 줄이나요?

## 구두 답변

먼저 columnar format이 제공하는 열/page 저장과, reader/operator가 제공하는 selection vector 및 late materialization을 구분하겠습니다. 엔진이 이 전략을 지원한다면 100,000행 batch에서 filter 열을 읽어 1,000행의 위치를 mask나 index 목록으로 만들고, 넓은 payload 열은 그 위치에서만 materialize할 수 있습니다. 1,000개 위치를 4바이트 index로 표현하는 설명 모델은 `1,000×4=4,000` bytes입니다. 이는 format이 자동으로 보장하는 결과가 아닙니다.

실제 trace는 filter column page read → predicate 평가 → selection 생성 → projection column read → 다음 operator 전달 순서로 기록합니다. row-group/page 단위 저장에서는 1%만 통과해도 filter가 있는 page 전체를 읽고 decode해야 할 수 있습니다. selection이 같은 page의 payload를 줄이는 것은 가능하지만, 다음 join이나 UDF가 selection을 받지 못하면 다시 dense row를 조립하는 비용이 생깁니다. 따라서 “1%니까 디스크에서 1%만 읽는다”고 말하지 않습니다.

선택률이 50%면 bitset 또는 dense mask가 단순할 수 있고, 99%면 sparse index보다 전체 vector를 전달하는 편이 나을 수 있습니다. 관측 항목은 filter/page bytes, decoded values, selection 표현 크기, projection materialize bytes, operator CPU, first-result와 p99입니다. Parquet source는 encoding과 page 구조를 설명하지만 late materialization의 존재를 정하지 않으므로, 실제 engine plan이나 operator trace에서 지원 여부를 확인하겠습니다.

## 득점 포인트

- 100,000행 중 1,000행 selection을 만든 뒤 payload를 늦게 조립하는 조건부 경로를 설명합니다.
- 1%·50%·99%에서 sparse index, mask, dense vector의 선택이 달라짐을 말합니다.
- page granularity와 다음 operator의 selection 지원을 format fact와 분리합니다.

## 감점 포인트

- columnar 저장만으로 모든 payload page가 건너뛰어진다고 합니다.
- 선택률과 관계없이 sparse index가 항상 최선이라고 주장합니다.
- UDF와 join이 selection을 받아들이지 못하는 데이터 이동을 빼먹습니다.

## 더 파고들 거리

- filter 열과 projection 열이 서로 다른 row group에 있을 때 materialization 경계를 어떻게 trace할까요?
- selection vector가 join 입력까지 전달되지 못하면 어떤 dense 변환이 추가될까요?
