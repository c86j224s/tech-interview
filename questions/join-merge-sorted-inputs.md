---
id: join-merge-sorted-inputs
title: 두 입력이 이미 같은 join key로 정렬돼 있을 때 merge join이 추가 정렬을 피하는 조건은 무엇인가요?
difficulty: 중하
category: 데이터베이스
tags:
  - SQL
  - merge join
  - sort
related:
  - composite-range-order-plan
---
# 두 입력이 이미 같은 join key로 정렬돼 있을 때 merge join이 추가 정렬을 피하는 조건은 무엇인가요?

## 구두 답변
추가 sort를 피하려면 단순히 두 결과가 현재 정렬되어 보이는 것이 아니라, 양쪽 입력이 조인 표현식에 대해 계획이 요구하는 호환 pathkeys로 공급되어야 합니다. 키가 `1,2,2,5`와 `2,2,3,5`라면 포인터를 전진시켜 2의 equal-key run에서 `2×2=4`개를 출력하고 5를 연결합니다. 입력이 이미 이 순서를 보장하면 큰 양쪽 입력을 다시 sort하지 않고 스트림으로 소비할 수 있습니다.

인덱스 사용도 자동 보장은 아닙니다. 복합 인덱스의 선행 컬럼이 다른 정렬·필터 조건에 묶였거나 조인 키에 표현식과 타입 변환이 들어가면 필요한 pathkey가 사라질 수 있습니다. 한쪽만 정렬됐거나 양쪽 방향이 다르면 merge 전 sort가 붙습니다. NULL 순서, collation, 타입 변환의 구체 호환은 planner 한 페이지로 일반화하지 않고 대상 엔진·버전의 정렬 계약과 `EXPLAIN`의 Sort Key를 확인합니다. 큰 sort가 메모리를 넘으면 spill이 생겨 hash가 상대적으로 유리해질 수도 있습니다.

정렬은 결과 행 수를 줄이지 않습니다. equal-key run이 2개씩이면 many-to-many 결과 4개가 그대로 나옵니다. 판단할 때는 sort 노드 유무, 입력 actual rows, 인덱스 유지 비용, 최종 ORDER BY의 우연한 순서와 실제 입력 보장을 구분합니다. 최종 출력이 정렬되어 보인다는 사실만으로 merge 전제를 증명하지 않겠습니다.

## 득점 포인트
- pathkey와 단순히 화면에서 보이는 정렬을 구분합니다.
- 1,2,2,5와 2,2,3,5에서 2×2 결과를 손으로 추적합니다.
- Sort Key와 actual rows를 계획에서 확인하고 NULL·collation 세부는 엔진 문서로 제한합니다.

## 감점 포인트
- 한쪽만 정렬되어도 merge join이 항상 선형이라고 말합니다.
- 최종 SELECT ORDER BY 결과를 조인 입력의 보장으로 오해합니다.
- equal-key run이 many-to-many 결과를 줄인다고 설명합니다.

## 더 파고들 거리
- 복합 인덱스에서 선행 컬럼과 혼합 ASC/DESC가 pathkey를 어떻게 바꾸는지 비교해 보세요.
- collation이 다른 텍스트 키를 조인할 때 변환 위치와 sort 비용을 어떤 계획 증거로 확인할지 설계해 보세요.
