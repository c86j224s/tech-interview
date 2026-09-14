---
id: "keyset-mixed-sort-directions"
title: "시각은 내림차순, ID는 오름차순인 목록을 키셋으로 읽습니다. 다음 페이지의 비교 조건은 어떻게 만드나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["페이지네이션","인덱스","키셋","심화 질문"]
related: ["db-keyset-pagination","composite-index-column-order"]
promotedFrom: {"id":"db-keyset-pagination","prompt":"오름차순·내림차순이 섞인 복합 키 조건을 검증해 보세요."}
---

# 시각은 내림차순, ID는 오름차순인 목록을 키셋으로 읽습니다. 다음 페이지의 비교 조건은 어떻게 만드나요?

## 구두 답변

정렬이 time DESC,id ASC이면 다음 조건은 time<마지막시각 또는 time=마지막시각이면서 id>마지막ID입니다. 단순 tuple < 비교는 두 방향이 같은 경우와 의미가 다릅니다.

동률·NULL·역방향 페이지·필터를 명시하고 동일 comparator를 인덱스·cursor·출력에 적용합니다. 유일한 보조 키가 있어도 주 키가 수정되면 페이지 이동 중 누락·중복이 생길 수 있습니다. cursor는 권한과 별개로 검증합니다.

## 득점 포인트

- 정렬이 time DESC,id ASC이면 다음 조건은 time<마지막시각 또는 time=마지막시각이면서 id>마지막ID입니다. 단순 tuple < 비교는 두 방향이 같은 경우와 의미가 다릅니다.
- cursor는 권한과 별개로 검증합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 정렬이 time DESC,id ASC이면 다음 조건은 time<마지막시각 또는 time=마지막시각이면서 id>마지막ID입니다.

## 더 파고들 거리

- [기본 상황과 비교: 주문 목록에서 OFFSET으로 뒤 페이지를 열수록 느려집니다. 마지막 주문의 시각과 ID를 커서로 쓰면 어떻게 달라지나요?](/tech-interview/questions/db-keyset-pagination/)
