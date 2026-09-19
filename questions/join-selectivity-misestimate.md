---
id: join-selectivity-misestimate
title: Hash join의 등가 조건과 merge join의 정렬 조건을 범위 부등호 조인에도 그대로 적용할 수 있나요?
difficulty: 중하
category: 데이터베이스
tags:
  - SQL
  - join cardinality
  - statistics
  - plan
related:
  - db-statistics-correlation
---
# Hash join의 등가 조건과 merge join의 정렬 조건을 범위 부등호 조인에도 그대로 적용할 수 있나요?

## 구두 답변
그대로 적용할 수 없습니다. hash join의 기본 후보 분할은 `a.key = b.key`처럼 동일한 값을 버킷으로 보내는 데 적합합니다. `a.start <= b.point AND b.point < a.end`는 point가 구간 안에 들어가는 관계라 단일 equality bucket이 모든 후보를 결정하지 못합니다. merge join도 양쪽이 정렬되어 있다는 사실만으로 범위 부등호를 자동으로 선형 처리하지 않습니다.

예를 들어 구간 [10,20)과 point 15는 매칭되지만 [12,18)도 point 15와 매칭됩니다. 한 point가 여러 구간과 연결될 수 있어 출력 카디널리티는 단순 1:1이 아닙니다. 정렬된 경계 스트림, 범위 인덱스, 작은 입력을 기준으로 한 nested loop와 residual filter를 비교해야 합니다. equality 조건이 함께 있으면 hash로 1차 후보를 줄이고 범위 조건을 residual로 검사할 수 있지만, residual 후보가 많으면 hash가 범위 선택성 문제를 해결한 것이 아닙니다.

통계가 구간 겹침과 point 분포의 상관을 놓치면 estimated rows가 작아져 nested loop·sort·메모리 선택이 틀어질 수 있습니다. 먼저 representative fixture에서 실제 후보 수를 세고 estimated/actual rows, loops, residual filter 뒤 행 수를 비교합니다. 느리다는 이유로 hash hint나 영구 plan pin을 바로 두지 않고 분포별 계획, 통계 개선, 범위 접근 경로를 순서대로 실험합니다.

## 득점 포인트
- equality hash key와 범위 residual 조건을 분리해 설명합니다.
- [10,20), [12,18), point 15의 다중 매칭 상태를 추적합니다.
- estimated/actual rows와 residual 이후 행 수를 선택도 오류의 증거로 연결합니다.

## 감점 포인트
- hash join이 모든 비교 조건을 같은 버킷 방식으로 처리한다고 합니다.
- merge join이면 모든 부등호 조인이 자동 선형화된다고 단정합니다.
- 실행이 느리다는 이유만으로 영구 hint를 먼저 처방합니다.

## 더 파고들 거리
- 구간 중첩 통계가 없을 때 균등·집중·겹침 분포 fixture를 어떻게 구성할지 생각해 보세요.
- residual 후보가 큰 계획에서 범위 인덱스와 정렬 경계 스트림을 어떤 비용으로 비교할지 검토하세요.
