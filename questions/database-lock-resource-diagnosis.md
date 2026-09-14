---
id: "database-lock-resource-diagnosis"
title: "DB에서 다른 요청을 막는 자원이 row·key·page·gap 중 무엇인지 어떻게 관찰하고 엔진별로 해석하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["잠금","락 에스컬레이션","트랜잭션","심화 질문"]
related: ["db-lock-escalation","deadlock-prevention","composite-index-column-order"]
promotedFrom: {"id":"db-lock-escalation","prompt":"DBMS별 행·키·페이지·gap 잠금 관찰 방법을 비교해 보세요."}
---

# DB에서 다른 요청을 막는 자원이 row·key·page·gap 중 무엇인지 어떻게 관찰하고 엔진별로 해석하나요?

## 구두 답변

엔진의 lock view와 대기 그래프에서 소유자·대기자·모드·대상·보유 시간을 확인합니다. row·index key·page·range·metadata가 막는 작업은 다르며 UPDATE 결과 행 수만으로 범위를 추측하지 않습니다.

SQL Server escalation과 InnoDB gap·next-key, PostgreSQL row·predicate lock의 의미는 서로 다릅니다. 실제 계획의 탐색 범위와 transaction 경계를 대조합니다. 힌트를 먼저 넣기보다 누가 어떤 자원을 오래 보유하는지 재현합니다.

## 득점 포인트

- 엔진의 lock view와 대기 그래프에서 소유자·대기자·모드·대상·보유 시간을 확인합니다. row·index key·page·range·metadata가 막는 작업은 다르며 UPDATE 결과 행 수만으로 범위를 추측하지 않습니다.
- 힌트를 먼저 넣기보다 누가 어떤 자원을 오래 보유하는지 재현합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 엔진의 lock view와 대기 그래프에서 소유자·대기자·모드·대상·보유 시간을 확인합니다.

## 더 파고들 거리

- [기본 상황과 비교: UPDATE로 바뀐 행은 몇 개뿐인데 다른 요청이 오래 기다립니다. 실제 잠금 범위와 보유 시간을 어떻게 확인하나요?](/tech-interview/questions/db-lock-escalation/)
