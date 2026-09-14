---
id: "rpc-event-log-team-ownership"
title: "즉시 RPC와 장기 이벤트 재생을 분리합니다. 스키마·보관·재처리·SLO의 운영 책임은 어떻게 나누나요?"
difficulty: "중하"
category: "설계"
tags: ["NATS","Kafka","SQS","메시징","심화 질문"]
related: ["messaging-tool-choice","nats-core-jetstream","kafka-partition-offset"]
promotedFrom: {"id":"messaging-tool-choice","prompt":"장기 재생 로그와 즉시 RPC를 분리할 때 팀별 운영 책임은 어떻게 나눌까요?"}
---

# 즉시 RPC와 장기 이벤트 재생을 분리합니다. 스키마·보관·재처리·SLO의 운영 책임은 어떻게 나누나요?

## 구두 답변

RPC는 요청 기한·오류·멱등성을, 장기 로그는 schema·retention·재생 위치·consumer 복구를 명시합니다. 팀별로 원본 데이터·계약·운영 경보의 owner를 정해야 합니다.

두 경로를 동시에 쓰면 어떤 사건이 권위인지와 중복·순서를 정합니다. 새 소비자와 오래된 이벤트의 호환 테스트를 둡니다. 브로커 운영팀이 업무 projection의 정확성까지 자동 책임지는 것으로 가정하지 않습니다.

## 득점 포인트

- RPC는 요청 기한·오류·멱등성을, 장기 로그는 schema·retention·재생 위치·consumer 복구를 명시합니다. 팀별로 원본 데이터·계약·운영 경보의 owner를 정해야 합니다.
- 브로커 운영팀이 업무 projection의 정확성까지 자동 책임지는 것으로 가정하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: RPC는 요청 기한·오류·멱등성을, 장기 로그는 schema·retention·재생 위치·consumer 복구를 명시합니다.

## 더 파고들 거리

- [기본 상황과 비교: 서비스 간 메시징을 도입하려는데 실시간 알림, 과거 이벤트 재생, 작업 재시도의 요구가 다릅니다. 어떤 보장과 운영 조건을 기준으로 NATS·Kafka·SQS를 선택하나요?](/tech-interview/questions/messaging-tool-choice/)
