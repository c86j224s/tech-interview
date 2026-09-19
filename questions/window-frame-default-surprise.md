---
id: window-frame-default-surprise
title: ORDER BY만 둔 window aggregate의 기본 frame 때문에 마지막 값까지 합쳐지는 오해를 어떻게 재현하고 고치나요?
difficulty: 중하
category: 데이터베이스
tags:
  - SQL
  - window
  - frame
  - aggregate
related:
  - db-window-function-ranking
---
# ORDER BY만 둔 window aggregate의 기본 frame 때문에 마지막 값까지 합쳐지는 오해를 어떻게 재현하고 고치나요?

## 구두 답변
작은 동점 입력으로 재현합니다. ORDER BY 값이 100,100,90이고 금액이 10,20,30일 때 ORDER BY만 둔 aggregate의 기본 RANGE frame은 현재 행의 peer 마지막까지 포함할 수 있어 결과가 30,30,60이 됩니다. 행 순서 누적을 원했는데 10,30,60을 기대했다면 peer 확장이 오해의 원인입니다. `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`를 명시하면 물리 행 순서 누적이라는 의도가 드러납니다.

`last_value`에서도 기본 frame은 현재 peer의 마지막에서 끝날 수 있어 partition 전체의 마지막 값으로 오해하기 쉽습니다. 전체 partition 마지막을 원하면 `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`처럼 범위를 명시하고, aggregate 누적과 last_value의 목표를 분리합니다. ORDER BY가 있다고 항상 현재 물리 행까지만 합쳐진다고도, 모든 DB가 같은 기본 frame을 갖는다고도 말하지 않습니다. 함수와 dialect의 문서를 확인해야 합니다.

재현 절차는 동점 두 행과 마지막 단일 행을 넣고 기본 frame, 명시 ROWS, 전체 partition frame의 각 행 결과를 표로 만드는 것입니다. 최종 출력 ORDER BY와 기준 snapshot도 고정하고, frame 변경을 성능 수정이 아닌 결과 의미 변경으로 리뷰합니다. 수치는 설명용 손계산이며 서버 실행 성공을 주장하지 않습니다.

## 득점 포인트
- 100,100,90에서 기본 peer 확장 30,30,60과 명시 ROWS 10,30,60을 계산합니다.
- last_value의 현재 peer와 전체 partition frame을 구분합니다.
- 작은 재현 입력·함수별 문서·출력 정렬을 검증 절차로 제시합니다.

## 감점 포인트
- ORDER BY가 있으면 항상 물리 현재 행까지만 누적된다고 합니다.
- last_value의 기본 frame이 partition 전체 마지막을 보장한다고 말합니다.
- 기본 frame을 모든 dialect에 동일하게 적용합니다.

## 더 파고들 거리
- RANGE와 GROUPS가 같은 peer 입력에서 언제 같은 결과와 다른 결과를 내는지 계산해 보세요.
- frame 변경으로 결과가 바뀌는 리포트에서 기준 snapshot과 명세를 함께 고정하는 방법을 설계해 보세요.
