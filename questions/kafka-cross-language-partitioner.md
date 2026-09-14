---
id: "kafka-cross-language-partitioner"
title: "여러 언어의 producer가 같은 키를 보냅니다. 직렬화·해시·partition 선택을 어떻게 같은 계약으로 맞추나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Kafka","파티션 확장","키 순서","심화 질문"]
related: ["kafka-partition-expansion","message-ordering-scope","kafka-partition-offset"]
promotedFrom: {"id":"kafka-partition-expansion","prompt":"다국어 파티셔너"}
---

# 여러 언어의 producer가 같은 키를 보냅니다. 직렬화·해시·partition 선택을 어떻게 같은 계약으로 맞추나요?

## 구두 답변

같은 키 문자열도 인코딩·정규화·숫자 표현과 파티셔너 구현이 다르면 다른 partition으로 갑니다. 해시 함수·key bytes·partition 수·null key 동작을 명시적으로 고정합니다.

언어별 golden vector와 증설 전후 결과를 비교합니다. partition 순서와 여러 worker 적용 순서는 별도입니다. 라이브러리 기본 파티셔너가 버전별로 바뀔 수 있어 명세·실제 설정을 기록합니다.

## 득점 포인트

- 같은 키 문자열도 인코딩·정규화·숫자 표현과 파티셔너 구현이 다르면 다른 partition으로 갑니다. 해시 함수·key bytes·partition 수·null key 동작을 명시적으로 고정합니다.
- 라이브러리 기본 파티셔너가 버전별로 바뀔 수 있어 명세·실제 설정을 기록합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 같은 키 문자열도 인코딩·정규화·숫자 표현과 파티셔너 구현이 다르면 다른 partition으로 갑니다.

## 더 파고들 거리

- [기본 상황과 비교: Kafka topic의 파티션 수를 늘린 뒤 같은 키의 이전 이벤트와 새 이벤트 순서가 깨질 수 있는 이유는 무엇인가요?](/tech-interview/questions/kafka-partition-expansion/)
