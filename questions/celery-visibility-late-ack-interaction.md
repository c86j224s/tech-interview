---
id: "celery-visibility-late-ack-interaction"
title: "Celery의 late ACK와 broker visibility timeout을 함께 씁니다. 긴 작업과 worker 종료의 재전달은 어떻게 검증하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Python","Celery","ACK","재시도","멱등성","심화 질문"]
related: ["python-celery-retries","message-consumer-idempotency"]
promotedFrom: {"id":"python-celery-retries","prompt":"visibility timeout과 late ACK가 함께 있을 때 재전달 시점을 어떻게 계산할까요?"}
---

# Celery의 late ACK와 broker visibility timeout을 함께 씁니다. 긴 작업과 worker 종료의 재전달은 어떻게 검증하나요?

## 구두 답변

late ACK는 완료 뒤 확인하는 정책이고 visibility timeout은 broker가 재전달할 수 있는 시간을 정합니다. timeout이 작업보다 짧으면 옛 worker가 실행 중이어도 중복 전달될 수 있습니다.

Celery·broker·worker-lost 옵션의 실제 계약을 확인합니다. task ID와 업무 효과 키를 구분하고 DB 원장·변경을 원자 처리합니다. 연장 실패·worker 종료·ACK 유실을 재현합니다.

## 득점 포인트

- late ACK는 완료 뒤 확인하는 정책이고 visibility timeout은 broker가 재전달할 수 있는 시간을 정합니다. timeout이 작업보다 짧으면 옛 worker가 실행 중이어도 중복 전달될 수 있습니다.
- 연장 실패·worker 종료·ACK 유실을 재현합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: late ACK는 완료 뒤 확인하는 정책이고 visibility timeout은 broker가 재전달할 수 있는 시간을 정합니다.

## 더 파고들 거리

- [기본 상황과 비교: Celery 작업이 DB를 변경한 뒤 워커가 종료돼 같은 작업이 다시 실행됩니다. ACK·재시도·처리 완료를 어떻게 구분하고 중복 반영을 막나요?](/tech-interview/questions/python-celery-retries/)
