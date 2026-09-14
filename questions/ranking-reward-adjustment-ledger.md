---
id: "ranking-reward-adjustment-ledger"
title: "부정 점수 정정으로 지급한 보상이 바뀝니다. 원래 권리와 회수·차액 지급을 어떤 별도 원장으로 관리하나요?"
difficulty: "중하"
category: "게임 서버"
tags: ["랭킹","보상","마감","심화 질문"]
related: ["ranking-cutoff-rewards","ranking-top-k","message-consumer-idempotency"]
promotedFrom: {"id":"ranking-cutoff-rewards","prompt":"부정 점수 정정으로 이미 지급한 보상이 바뀔 때 회수·차액·다음 시즌 반영을 어떻게 감사하나요?"}
---

# 부정 점수 정정으로 지급한 보상이 바뀝니다. 원래 권리와 회수·차액 지급을 어떤 별도 원장으로 관리하나요?

## 구두 답변

원래 시즌 보상 권리 키와 산출물 version을 보존하고 정정은 별도 adjustment ID로 기록합니다. 같은 보상을 새 계산 version마다 다시 지급하면 중복이 될 수 있습니다.

회수·차액·다음 시즌 반영의 승인·사용자 안내를 정합니다. 이미 사용한 재화는 단순 snapshot 복원으로 되돌릴 수 없습니다. 원장·외부 지급·정정의 부분 실패를 멱등하게 대사합니다.

## 득점 포인트

- 원래 시즌 보상 권리 키와 산출물 version을 보존하고 정정은 별도 adjustment ID로 기록합니다. 같은 보상을 새 계산 version마다 다시 지급하면 중복이 될 수 있습니다.
- 원장·외부 지급·정정의 부분 실패를 멱등하게 대사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 원래 시즌 보상 권리 키와 산출물 version을 보존하고 정정은 별도 adjustment ID로 기록합니다.

## 더 파고들 거리

- [기본 상황과 비교: 게임 랭킹 마감 뒤 늦게 도착한 점수와 보상 지급을 어떤 기준 버전으로 확정하고 재처리하나요?](/tech-interview/questions/ranking-cutoff-rewards/)
