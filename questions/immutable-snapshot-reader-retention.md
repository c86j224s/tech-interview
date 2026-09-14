---
id: "immutable-snapshot-reader-retention"
title: "새 불변 snapshot을 게시한 뒤 옛 snapshot을 독자가 읽고 있습니다. 메모리 회수와 독자 수명은 어떻게 제한하나요?"
difficulty: "중하"
category: "설계"
tags: ["불변 데이터","공유 상태","구조적 공유","깊은 불변","심화 질문"]
related: ["immutable-data-sharing","functional-purity"]
promotedFrom: {"id":"immutable-data-sharing","prompt":"불변 스냅샷을 읽는 동안 메모리 회수와 객체 수명을 어떤 방식으로 보장할까요?"}
---

# 새 불변 snapshot을 게시한 뒤 옛 snapshot을 독자가 읽고 있습니다. 메모리 회수와 독자 수명은 어떻게 제한하나요?

## 구두 답변

새 root 게시 뒤 옛 reader는 이전 snapshot을 계속 읽을 수 있어 그 참조가 끝날 때까지 메모리를 유지해야 합니다. version이 낡았다는 이유로 살아 있는 참조를 강제로 해제할 수 없습니다.

참조 계수·GC·epoch·hazard pointer의 실제 회수 계약을 사용합니다. 장기 reader의 취소·완료 확인·새 작업 수락 제한으로 보관량을 줄입니다. snapshot 수와 retained bytes·최장 reader를 관측합니다.

## 득점 포인트

- 새 root 게시 뒤 옛 reader는 이전 snapshot을 계속 읽을 수 있어 그 참조가 끝날 때까지 메모리를 유지해야 합니다. version이 낡았다는 이유로 살아 있는 참조를 강제로 해제할 수 없습니다.
- snapshot 수와 retained bytes·최장 reader를 관측합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 새 root 게시 뒤 옛 reader는 이전 snapshot을 계속 읽을 수 있어 그 참조가 끝날 때까지 메모리를 유지해야 합니다.

## 더 파고들 거리

- [기본 상황과 비교: 여러 스레드가 같은 설정 데이터를 읽고 한 항목만 바꿔 공유하려 합니다. 불변 데이터가 안전성과 비용에 미치는 영향은 무엇인가요?](/tech-interview/questions/immutable-data-sharing/)
