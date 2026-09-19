---
id: window-groups-frame
title: 동점 그룹 단위로 최근 세 그룹을 합산하려면 GROUPS frame을 ROWS 대신 선택하는 이유는 무엇인가요?
difficulty: 중하
category: 데이터베이스
tags:
  - SQL
  - window
  - GROUPS
  - peer group
related:
  - db-window-function-ranking
---
# 동점 그룹 단위로 최근 세 그룹을 합산하려면 GROUPS frame을 ROWS 대신 선택하는 이유는 무엇인가요?

## 구두 답변
GROUPS는 물리 행 수가 아니라 peer group 수로 경계를 셉니다. 첫 날짜 거래가 1건, 둘째가 3건, 셋째가 2건이고 그룹 합이 각각 10,60,50이면 “최근 세 그룹”을 현재 그룹 포함으로 해석할 때 `GROUPS BETWEEN 2 PRECEDING AND CURRENT ROW`를 씁니다. 둘째 그룹에는 앞에 존재하는 첫 그룹까지 `10+60=70`, 셋째 그룹에는 `10+60+50=120`이 포함됩니다.

`GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW`는 최근 두 그룹일 뿐입니다. 이 offset을 세 그룹 요구에 사용하면 제목과 결과가 어긋납니다. `ROWS 2 PRECEDING`으로 바꾸면 셋째 날짜의 첫 행에서 직전 두 물리 행만 포함하므로 같은 날짜 그룹을 중간에서 자를 수 있습니다. GROUPS의 peer는 ORDER BY 표현식 전체가 같은 행이므로 날짜 뒤에 유일 transaction_id를 추가하면 각 거래가 별도 group이 된다는 점도 주의합니다.

업무 단위가 날짜·가격대·상태 구간인지 먼저 고르고, 그 단위만 peer가 되도록 ORDER BY를 구성합니다. 현재 그룹을 제외할 요구라면 EXCLUDE GROUP을 대상 엔진이 지원하는지 확인합니다. 1·3·2건 fixture에서 frame 구성원과 70,120 결과를 표로 검산하며, 위 계산은 설명용입니다.

## 득점 포인트
- 최근 세 그룹은 현재 포함이므로 2 PRECEDING이라는 offset을 정확히 계산합니다.
- 10,60,50에서 70과 120을 산출하고 1 PRECEDING이 최근 두 그룹임을 구분합니다.
- ROWS가 그룹 내부를 자르는 상태와 tie-breaker의 의미 변화를 설명합니다.

## 감점 포인트
- 세 그룹 요구에 `GROUPS 1 PRECEDING`을 사용합니다.
- 최근 그룹을 최근 행으로 바꾸어도 의미가 같다고 합니다.
- ORDER BY에 유일 ID를 항상 추가해야 peer 의미가 보존된다고 단정합니다.

## 더 파고들 거리
- 현재 그룹을 제외한 최근 세 그룹을 `EXCLUDE GROUP`과 앞선 경계로 각각 표현해 보세요.
- 거래가 없는 날짜를 그룹 수에 포함할지, 캘린더 테이블을 둘지 비교해 보세요.
