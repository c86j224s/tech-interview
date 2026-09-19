---
id: window-range-peer-frame
title: 같은 ORDER BY 값인 행이 함께 누적되는 RANGE frame과 한 행씩 누적되는 ROWS frame은 언제 다른 결과를 내나요?
difficulty: 하
category: 데이터베이스
tags:
  - SQL
  - window
  - RANGE
  - peer group
related:
  - db-window-function-ranking
---
# 같은 ORDER BY 값인 행이 함께 누적되는 RANGE frame과 한 행씩 누적되는 ROWS frame은 언제 다른 결과를 내나요?

## 구두 답변
두 행 이상이 같은 ORDER BY 값인 순간 결과가 달라집니다. 내림차순 점수 100,100,90에 금액 10,20,30을 두면 peer를 함께 포함하는 기본 RANGE는 두 100점 행에 각각 30, 90점 행에 60을 줄 수 있습니다. 반면 `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`는 물리 순서대로 10,30,60입니다. RANGE는 값과 peer 경계, ROWS는 행 위치를 사용하는 차이입니다.

최근 두 물리 행이 요구되면 ROWS가 맞고, 같은 점수·가격 그룹을 동시에 반영하려면 RANGE 또는 GROUPS를 검토합니다. ORDER BY에 transaction_id를 추가하면 peer가 사라져 RANGE도 행별 결과에 가까워질 수 있습니다. 반대로 `RANGE BETWEEN 1 PRECEDING` 같은 offset은 ORDER BY 타입과 dialect 제약을 받으므로 숫자와 날짜를 같은 문법으로 가정하지 않습니다. NULLS FIRST/LAST와 최종 출력 순서도 별도로 고정합니다.

작은 입력에서 각 행의 frame 구성원과 합을 먼저 표로 작성하고 대상 DB에서 실행해 대조합니다. 큰 partition에서는 window sort 메모리와 spill을 계획에서 확인합니다. 위 수치는 손계산이며 이 환경에서 PostgreSQL을 실행한 결과는 아닙니다.

## 득점 포인트
- 100,100,90과 10,20,30에서 RANGE 30,30,60과 ROWS 10,30,60을 보여 줍니다.
- peer 정의가 ORDER BY 컬럼 추가로 바뀐다는 점을 설명합니다.
- RANGE offset·NULL 정렬·sort 메모리를 검증 범위로 둡니다.

## 감점 포인트
- RANGE와 ROWS가 항상 같은 누적합을 낸다고 합니다.
- RANGE offset을 모든 DB에서 동일한 날짜 간격 문법으로 씁니다.
- 기본 frame의 peer 확장을 무시하고 물리 행만 누적된다고 말합니다.

## 더 파고들 거리
- 같은 peer group에서 현재 행을 제외한 합을 요구할 때 EXCLUDE와 frame 단위를 비교해 보세요.
- NULL order key가 섞일 때 peer와 표시 순서를 재현하는 fixture를 설계해 보세요.
