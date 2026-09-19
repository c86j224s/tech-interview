---
id: window-rows-duplicate-order
title: 같은 날짜에 여러 거래가 있을 때 ROWS BETWEEN과 ORDER BY tie-breaker가 누적합을 어떻게 바꾸나요?
difficulty: 중하
category: 데이터베이스
tags:
  - SQL
  - window
  - ROWS
  - running total
related:
  - db-window-function-ranking
---
# 같은 날짜에 여러 거래가 있을 때 ROWS BETWEEN과 ORDER BY tie-breaker가 누적합을 어떻게 바꾸나요?

## 구두 답변
`ROWS`는 peer group이 아니라 물리적 행 위치로 frame을 셉니다. 같은 날짜에 금액 10,20,30이 있고 `ORDER BY date`만 두었다고 하겠습니다. 내부 순서가 10,20,30이면 누적합은 10,30,60이지만 30,10,20이면 30,40,60입니다. 전체 합은 같아도 각 거래의 잔액과 `ROWS 1 PRECEDING`의 중간 결과가 달라집니다. 날짜만으로는 동점의 업무 순서가 정의되지 않은 상태입니다.

행 단위 누적이 요구되면 `ORDER BY occurred_at, transaction_id`처럼 결정적인 tie-breaker를 둡니다. 하지만 transaction_id를 추가하면 같은 날짜 행이 서로 다른 peer가 됩니다. 같은 날짜 거래를 한 번에 반영하려는 일별 보고서라면 유일 키를 넣은 ROWS가 아니라 날짜 peer를 유지하는 RANGE 또는 GROUPS가 의미에 맞을 수 있습니다. window ORDER BY는 계산 순서일 뿐 최종 SELECT 출력 순서가 아니므로 바깥 ORDER BY도 둡니다.

늦게 들어온 같은 날짜 거래가 있으면 동일 시점의 snapshot을 고정해야 과거 누적합을 재현할 수 있습니다. 검증 fixture에는 동점 0·1·3건과 두 내부 순서를 넣고 각 frame 구성원을 표로 비교합니다. 위 값은 설명용 손계산이며 특정 DB 실행 결과로 가장하지 않습니다.

## 득점 포인트
- 10·20·30의 두 내부 순서에서 10,30,60과 30,40,60을 계산합니다.
- tie-breaker가 결정성을 높이면서 peer 의미를 바꾼다는 점을 설명합니다.
- 계산 순서·출력 순서·snapshot 재현성을 분리합니다.

## 감점 포인트
- 날짜만 ORDER BY해 동점 순서가 항상 고정된다고 합니다.
- tie-breaker를 넣으면 언제나 같은 날짜 그룹 의미가 보존된다고 말합니다.
- ROWS의 결과를 RANGE 또는 GROUPS의 peer 결과와 혼동합니다.

## 더 파고들 거리
- 늦게 삽입된 거래로 기존 화면이 바뀔 때 snapshot과 재계산 정책을 비교해 보세요.
- 일별 잔액과 거래별 잔액에서 ROWS와 GROUPS 중 어떤 계약이 맞는지 사례를 만들어 보세요.
