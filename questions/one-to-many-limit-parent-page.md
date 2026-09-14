---
id: "one-to-many-limit-parent-page"
title: "주문·상품을 JOIN한 결과에 LIMIT을 걸었더니 주문 개수가 부족합니다. 부모 페이지를 어떻게 먼저 확정하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["N+1","JOIN","배치 조회","심화 질문"]
related: ["db-n-plus-one","composite-index-column-order"]
promotedFrom: {"id":"db-n-plus-one","prompt":"일대다 JOIN에서 LIMIT이 부모 페이지를 깨뜨리는 과정을 재현해 보세요."}
---

# 주문·상품을 JOIN한 결과에 LIMIT을 걸었더니 주문 개수가 부족합니다. 부모 페이지를 어떻게 먼저 확정하나요?

## 구두 답변

일대다 JOIN의 LIMIT은 결합 행 수를 제한하므로 주문 한 개의 자식이 많은 경우 부모 20개가 되지 않습니다. 부모 ID의 페이지를 먼저 정한 뒤 자식을 batch 조회하거나 검증된 subquery 계획을 사용합니다.

LEFT JOIN을 INNER JOIN으로 바꾸어 자식 없는 부모를 없애지 않습니다. 여러 일대다 관계의 곱집합·DISTINCT·네트워크 바이트를 확인합니다. 동점 정렬·부모 삭제·동시 변경과 키셋 cursor의 의미를 함께 시험합니다.

## 득점 포인트

- 일대다 JOIN의 LIMIT은 결합 행 수를 제한하므로 주문 한 개의 자식이 많은 경우 부모 20개가 되지 않습니다. 부모 ID의 페이지를 먼저 정한 뒤 자식을 batch 조회하거나 검증된 subquery 계획을 사용합니다.
- 동점 정렬·부모 삭제·동시 변경과 키셋 cursor의 의미를 함께 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 일대다 JOIN의 LIMIT은 결합 행 수를 제한하므로 주문 한 개의 자식이 많은 경우 부모 20개가 되지 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: 주문 목록을 한 번 조회한 뒤 각 주문의 고객 정보를 따로 읽어 쿼리 수가 늘어납니다. N+1 조회를 어떻게 줄이고, JOIN으로 바꿀 때는 어떤 비용을 확인하나요?](/tech-interview/questions/db-n-plus-one/)
