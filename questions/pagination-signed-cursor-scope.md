---
id: "pagination-signed-cursor-scope"
title: "페이지 커서에 필터·정렬·테넌트 정보를 넣습니다. 서명·만료·인가 검사는 어떤 역할이 다른가요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["페이지네이션","인덱스","키셋","심화 질문"]
related: ["db-keyset-pagination","composite-index-column-order"]
promotedFrom: {"id":"db-keyset-pagination","prompt":"서명된 커서에 필터·정렬·테넌트 범위를 포함할지 결정해 보세요."}
---

# 페이지 커서에 필터·정렬·테넌트 정보를 넣습니다. 서명·만료·인가 검사는 어떤 역할이 다른가요?

## 구두 답변

cursor에 마지막 정렬 키·필터·정렬 version·범위를 묶고 서명으로 변조를 검출할 수 있습니다. 서명은 비밀성을 주지 않으며 서명된 과거 cursor가 현재 인가를 대신하지 않습니다.

만료·사용자·tenant를 검사하고 현재 권한이 바뀌면 거절합니다. 조건이 다른 cursor를 무조건 해석해 조회하지 않습니다. 큰 값으로 비싼 탐색을 유도하지 못하게 길이·페이지 상한을 두고 key 수정·삭제의 snapshot 한계도 명시합니다.

## 득점 포인트

- cursor에 마지막 정렬 키·필터·정렬 version·범위를 묶고 서명으로 변조를 검출할 수 있습니다. 서명은 비밀성을 주지 않으며 서명된 과거 cursor가 현재 인가를 대신하지 않습니다.
- 큰 값으로 비싼 탐색을 유도하지 못하게 길이·페이지 상한을 두고 key 수정·삭제의 snapshot 한계도 명시합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: cursor에 마지막 정렬 키·필터·정렬 version·범위를 묶고 서명으로 변조를 검출할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 주문 목록에서 OFFSET으로 뒤 페이지를 열수록 느려집니다. 마지막 주문의 시각과 ID를 커서로 쓰면 어떻게 달라지나요?](/tech-interview/questions/db-keyset-pagination/)
