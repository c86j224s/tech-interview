---
id: "hazard-pointer-publish-recheck"
title: "hazard pointer를 게시한 뒤 원본 포인터를 다시 읽어야 합니다. 어떤 회수 경쟁을 막는 절차인가요?"
difficulty: "중하"
category: "동시성"
tags: ["락 프리","ABA","메모리 회수","심화 질문"]
related: ["lock-free-aba-reclamation","atomics-memory-order"]
promotedFrom: {"id":"lock-free-aba-reclamation","prompt":"hazard pointer를 게시한 뒤 포인터를 다시 읽는 재검증이 왜 필요한가요?"}
---

# hazard pointer를 게시한 뒤 원본 포인터를 다시 읽어야 합니다. 어떤 회수 경쟁을 막는 절차인가요?

## 구두 답변

원본 포인터를 읽고 hazard를 게시하는 사이 노드가 제거·회수될 수 있어 게시 후 원본을 다시 읽어 여전히 같은 대상인지 확인해야 합니다. 달라졌으면 위험한 포인터를 사용하지 않고 다시 시작합니다.

정확한 memory order·회수 scan·게시 슬롯 수명은 검증된 알고리즘을 따릅니다. hazard는 노드를 unlink하지 못하게 하는 것이 아니라 안전하지 않은 reclaim을 늦추는 수단입니다.

## 득점 포인트

- 원본 포인터를 읽고 hazard를 게시하는 사이 노드가 제거·회수될 수 있어 게시 후 원본을 다시 읽어 여전히 같은 대상인지 확인해야 합니다. 달라졌으면 위험한 포인터를 사용하지 않고 다시 시작합니다.
- hazard는 노드를 unlink하지 못하게 하는 것이 아니라 안전하지 않은 reclaim을 늦추는 수단입니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 원본 포인터를 읽고 hazard를 게시하는 사이 노드가 제거·회수될 수 있어 게시 후 원본을 다시 읽어 여전히 같은 대상인지 확인해야 합니다.

## 더 파고들 거리

- [기본 상황과 비교: 다른 스레드가 읽고 있을 수 있는 락 프리 스택의 노드를 제거했습니다. 왜 그 메모리를 바로 해제하면 안 되나요?](/tech-interview/questions/lock-free-aba-reclamation/)
