---
id: join-nested-loop-index
title: >-
  작은 outer 입력과 inner 인덱스가 있는 질의에서 nested loop join이 hash join보다 유리할 수 있는 이유는
  무엇인가요?
difficulty: 하
category: 데이터베이스
tags:
  - SQL
  - nested loop join
  - index
related:
  - db-n-plus-one
---
# 작은 outer 입력과 inner 인덱스가 있는 질의에서 nested loop join이 hash join보다 유리할 수 있는 이유는 무엇인가요?

## 구두 답변
결론부터 말하면 outer의 실제 행 수가 작고 inner 인덱스가 각 키를 좁게 찾는다면 nested loop가 큰 inner를 한 번에 읽어 hash table로 만드는 것보다 유리합니다. 예를 들어 최근 주문 필터가 outer 10행을 만들고 `customers(id)`가 있다고 하겠습니다. 한 probe가 인덱스 3페이지와 heap 1페이지를 읽는다는 설명용 가정이면 `10×4=40`페이지 접근입니다. 고객 테이블이 1천만 행이라는 사실만으로 1천만 행을 전부 읽는 것은 아닙니다.

반대로 outer가 실제 10만 행이면 동일한 모델은 40만 페이지 접근으로 커집니다. 서로 다른 고객을 반복 조회하면 random read와 캐시 미스가 발생하여, 큰 입력을 순차적으로 읽는 hash join이 더 나을 수 있습니다. estimated rows가 10인데 actual rows가 10만이면 통계 또는 parameter 분포가 계획을 속인 것입니다. `EXPLAIN (ANALYZE, BUFFERS)`에서 outer actual rows, nested loop loops, inner index scan의 actual rows와 buffer를 예상치와 비교하겠습니다. covering index라 heap 방문이 줄어드는지, 한 고객에 여러 주문이 매칭되어 출력 행이 증폭되는지도 별도 계산합니다.

이것은 애플리케이션 N+1 왕복과 다릅니다. SQL 내부 nested loop는 하나의 실행 계획 안에서 인덱스를 반복하는 것이며 네트워크 왕복을 outer 행만큼 발생시키는 현상은 아닙니다. 다만 outer가 커져 반복 lookup이 병목이 되면 hash나 merge를 비교하고, 작은 입력과 큰 입력이 번갈아 오면 하나의 plan 고정 대신 분포별 계획을 검증합니다. 숫자는 손계산이며 서버 실행 결과로 가장하지 않습니다.

## 득점 포인트
- outer 10행과 probe당 4페이지에서 40이라는 중간 비용을 직접 계산합니다.
- actual rows와 loops를 사용해 outer 추정 10과 실제 10만의 차이를 진단합니다.
- 선택적·covering 인덱스, heap 방문, 일대다 출력 증폭을 함께 설명합니다.

## 감점 포인트
- inner가 1천만 행이라는 이유만으로 nested loop가 항상 나쁘다고 단정합니다.
- 작은 outer라는 추정치만 보고 실제 loops와 buffer read를 확인하지 않습니다.
- SQL 내부 반복 탐색을 애플리케이션 N+1 네트워크 왕복과 같은 현상으로 설명합니다.

## 더 파고들 거리
- outer 분포가 parameter마다 다를 때 nested loop와 hash의 p95 버퍼·실행시간을 어떻게 비교할지 살펴보세요.
- 인덱스가 매칭 행을 많이 반환하면 probe 횟수와 결과 행 수를 어떻게 분리할지 검토해 보세요.
