---
id: "game-state-input-delivery-classes"
title: "게임 snapshot과 입력 명령을 다른 전달 큐에 둡니다. 최신성·순서·재전송 요구를 어떻게 나누나요?"
difficulty: "중하"
category: "네트워크"
tags: ["UDP","TCP","실시간 통신","심화 질문"]
related: ["udp-reliability-choice","tcp-flow-vs-congestion-control"]
promotedFrom: {"id":"udp-reliability-choice","prompt":"스냅샷과 입력 명령을 서로 다른 큐·순서·재전송 정책으로 나누는 이유는 무엇일까요?"}
---

# 게임 snapshot과 입력 명령을 다른 전달 큐에 둡니다. 최신성·순서·재전송 요구를 어떻게 나누나요?

## 구두 답변

위치 snapshot은 최신 상태가 중요해 오래된 것을 합치거나 버릴 수 있지만 입력 명령·보상은 순서와 단일 적용이 필요할 수 있습니다. 메시지 유형별 큐·sequence·ACK·재생을 분리합니다.

중요도 낮은 frame이 중요한 event를 막지 않게 budget을 둡니다. 같은 채널을 써도 모든 메시지의 보장이 같지 않습니다. 손실·지연·reconnect·보관 범위 밖에서 snapshot과 원장을 대조합니다.

## 득점 포인트

- 위치 snapshot은 최신 상태가 중요해 오래된 것을 합치거나 버릴 수 있지만 입력 명령·보상은 순서와 단일 적용이 필요할 수 있습니다. 메시지 유형별 큐·sequence·ACK·재생을 분리합니다.
- 손실·지연·reconnect·보관 범위 밖에서 snapshot과 원장을 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 위치 snapshot은 최신 상태가 중요해 오래된 것을 합치거나 버릴 수 있지만 입력 명령·보상은 순서와 단일 적용이 필요할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 실시간 게임 메시지의 최신성·순서·손실 요구에 따라 TCP와 UDP 또는 검증된 전송 계층을 어떻게 선택하나요?](/tech-interview/questions/udp-reliability-choice/)
