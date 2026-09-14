---
id: "out-of-order-buffer-bounds"
title: "역순 이벤트를 기다리는 버퍼가 계속 커집니다. 메모리·대기 상한과 snapshot 재동기화는 어떻게 정하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["메시지","순서 보장","파티션","심화 질문"]
related: ["message-ordering-scope","message-consumer-idempotency","mutex-vs-serial-execution"]
promotedFrom: {"id":"message-ordering-scope","prompt":"순서가 깨진 이벤트를 보류할 때 메모리·시간 상한과 재동기화는 어떻게 정할까요?"}
---

# 역순 이벤트를 기다리는 버퍼가 계속 커집니다. 메모리·대기 상한과 snapshot 재동기화는 어떻게 정하나요?

## 구두 답변

키별로 기다리는 sequence·최대 항목·바이트·시간 상한을 두고 gap이 해소되지 않으면 replay 또는 snapshot으로 재동기화합니다. 미래 번호를 무제한 저장하면 메모리 고갈이 됩니다.

전체 상태와 delta 이벤트의 복구 조건이 다릅니다. snapshot 기준 뒤의 증분만 적용하고 이미 처리된 ID를 보존합니다. 잘못된 큰 sequence·영구 누락·중복·원본 보관 만료를 시험합니다.

## 득점 포인트

- 키별로 기다리는 sequence·최대 항목·바이트·시간 상한을 두고 gap이 해소되지 않으면 replay 또는 snapshot으로 재동기화합니다. 미래 번호를 무제한 저장하면 메모리 고갈이 됩니다.
- 잘못된 큰 sequence·영구 누락·중복·원본 보관 만료를 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 키별로 기다리는 sequence·최대 항목·바이트·시간 상한을 두고 gap이 해소되지 않으면 replay 또는 snapshot으로 재동기화합니다.

## 더 파고들 거리

- [기본 상황과 비교: 같은 Kafka partition의 메시지를 순서대로 받았지만 여러 워커가 처리하자 최종 상태가 뒤바뀝니다. 전달 순서와 처리 완료 순서를 어떻게 구분하고 필요한 순서를 보장하나요?](/tech-interview/questions/message-ordering-scope/)
