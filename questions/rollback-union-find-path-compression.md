---
id: "rollback-union-find-path-compression"
title: "Union-Find를 rollback하려 합니다. 경로 압축이 변경 이력과 충돌하는 이유와 대안은 무엇인가요?"
difficulty: "중하"
category: "자료구조"
tags: ["Union-Find","분리 집합","연결성","심화 질문"]
related: ["union-find-connectivity","kruskal-prim-choice"]
promotedFrom: {"id":"union-find-connectivity","prompt":"롤백 Union-Find에서 경로 압축을 그대로 쓰기 어려운 이유를 변경 이력으로 설명해 보세요."}
---

# Union-Find를 rollback하려 합니다. 경로 압축이 변경 이력과 충돌하는 이유와 대안은 무엇인가요?

## 구두 답변

rollback은 union 때 바꾼 parent·rank·size를 스택에 기록해 되돌리는 방식이 가능합니다. 경로 압축은 find 중 많은 parent를 바꾸므로 그 변경까지 기록해야 해 단순 rollback과 비용이 충돌합니다.

union by size만 쓰거나 검증된 rollback variant를 선택합니다. 같은 집합 union의 무변경 기록·snapshot 위치·metadata 복원을 시험합니다. 온라인 임의 간선 삭제를 기본 DSU가 해결한다고 하지 않습니다.

## 득점 포인트

- rollback은 union 때 바꾼 parent·rank·size를 스택에 기록해 되돌리는 방식이 가능합니다. 경로 압축은 find 중 많은 parent를 바꾸므로 그 변경까지 기록해야 해 단순 rollback과 비용이 충돌합니다.
- 온라인 임의 간선 삭제를 기본 DSU가 해결한다고 하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: rollback은 union 때 바꾼 parent·rank·size를 스택에 기록해 되돌리는 방식이 가능합니다.

## 더 파고들 거리

- [기본 상황과 비교: 간선을 추가하며 두 정점이 이미 연결됐는지 반복 확인합니다. Union-Find는 무엇을 저장하나요?](/tech-interview/questions/union-find-connectivity/)
