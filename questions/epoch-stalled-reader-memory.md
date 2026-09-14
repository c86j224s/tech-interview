---
id: "epoch-stalled-reader-memory"
title: "epoch 안에서 오래 멈춘 독자가 회수를 막습니다. 살아 있는 참조를 강제 해제하지 않고 메모리를 어떻게 제한하나요?"
difficulty: "중하"
category: "동시성"
tags: ["락 프리","ABA","메모리 회수","심화 질문"]
related: ["lock-free-aba-reclamation","atomics-memory-order"]
promotedFrom: {"id":"lock-free-aba-reclamation","prompt":"epoch에 오래 머무는 스레드를 감지하고 회수 메모리를 제한하는 방법은 무엇인가요?"}
---

# epoch 안에서 오래 멈춘 독자가 회수를 막습니다. 살아 있는 참조를 강제 해제하지 않고 메모리를 어떻게 제한하나요?

## 구두 답변

epoch에 머문 독자는 이전 노드를 계속 참조할 수 있어 시간이 길다는 이유로 강제 해제하면 안 됩니다. 오래된 독자·retired bytes를 관측하고 취소·완료 확인·새 reader 수락 제한으로 관리합니다.

reclamation 방식 변경이나 더 짧은 읽기 구간을 검토합니다. 독자 정지·재개·노드 재사용을 시험합니다. epoch 숫자는 논리 세대이며 실제 수명 보호 절차 없이 use-after-free를 고치지 못합니다.

## 득점 포인트

- epoch에 머문 독자는 이전 노드를 계속 참조할 수 있어 시간이 길다는 이유로 강제 해제하면 안 됩니다. 오래된 독자·retired bytes를 관측하고 취소·완료 확인·새 reader 수락 제한으로 관리합니다.
- epoch 숫자는 논리 세대이며 실제 수명 보호 절차 없이 use-after-free를 고치지 못합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: epoch에 머문 독자는 이전 노드를 계속 참조할 수 있어 시간이 길다는 이유로 강제 해제하면 안 됩니다.

## 더 파고들 거리

- [기본 상황과 비교: 다른 스레드가 읽고 있을 수 있는 락 프리 스택의 노드를 제거했습니다. 왜 그 메모리를 바로 해제하면 안 되나요?](/tech-interview/questions/lock-free-aba-reclamation/)
