---
id: "query-memory-grant-over-under"
title: "쿼리 메모리가 부족해 spill이 나거나 과다 예약으로 다른 쿼리가 기다립니다. 두 상태를 어떻게 구분하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["실행 계획","통계","카디널리티","심화 질문"]
related: ["db-query-plan-regression","composite-index-column-order"]
promotedFrom: {"id":"db-query-plan-regression","prompt":"메모리 grant 부족과 과다 할당의 증상을 비교해 보세요."}
---

# 쿼리 메모리가 부족해 spill이 나거나 과다 예약으로 다른 쿼리가 기다립니다. 두 상태를 어떻게 구분하나요?

## 구두 답변

실제 사용이 grant보다 크면 sort·hash가 임시 디스크로 spill할 수 있고, 과다 grant는 다른 쿼리의 동시 실행을 제한할 수 있습니다. 메모리 사용량·대기·추정 및 실제 행 수를 함께 봅니다.

파라미터 편중·통계·연산자·엔진별 feedback 기능을 확인합니다. 메모리를 무조건 늘리면 전체 workload가 포화될 수 있습니다. 작은·큰 입력과 동시 부하에서 grant·spill·읽기·p99를 비교하고 plan forcing은 해제 기준을 둡니다.

## 득점 포인트

- 실제 사용이 grant보다 크면 sort·hash가 임시 디스크로 spill할 수 있고, 과다 grant는 다른 쿼리의 동시 실행을 제한할 수 있습니다. 메모리 사용량·대기·추정 및 실제 행 수를 함께 봅니다.
- 작은·큰 입력과 동시 부하에서 grant·spill·읽기·p99를 비교하고 plan forcing은 해제 기준을 둡니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 실제 사용이 grant보다 크면 sort·hash가 임시 디스크로 spill할 수 있고, 과다 grant는 다른 쿼리의 동시 실행을 제한할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 배포나 SQL 수정이 없었는데 같은 쿼리가 갑자기 느려졌습니다. 실행 계획이 바뀌었는지 어떻게 확인하고 어떤 원인을 조사하나요?](/tech-interview/questions/db-query-plan-regression/)
