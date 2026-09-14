---
id: "queue-budget-from-deadline"
title: "요청마다 처리 시간이 다릅니다. deadline 안에 끝낼 수 있는 동시 실행 수와 대기열 길이를 어떻게 정하나요?"
difficulty: "중하"
category: "동시성"
tags: ["비동기","블로킹","스레드","이벤트 루프","future","백프레셔","심화 질문"]
related: ["async-api-and-blocking","io-readiness-vs-completion","goroutine-lifecycle-and-leaks"]
promotedFrom: {"id":"async-api-and-blocking","prompt":"동시 실행 수와 대기열 상한을 정할 때 처리 시간 분포와 요청 데드라인을 어떻게 이용할까요?"}
---

# 요청마다 처리 시간이 다릅니다. deadline 안에 끝낼 수 있는 동시 실행 수와 대기열 길이를 어떻게 정하나요?

## 구두 답변

평균 처리 시간만으로 큐 길이를 정하면 긴 꼬리 작업 때문에 deadline을 넘길 수 있습니다. 도착률·작업 비용 분포·현재 실행량과 남은 기한을 보고 수락·대기·거절을 나눕니다.

대기 예상이 남은 deadline보다 길면 새 일을 쌓기보다 빠르게 실패하거나 비동기 접수로 바꿉니다. 예측은 보장이 아니므로 큐·실행·하위 자원 상한과 실제 취소를 함께 둡니다. 평균 용량 관계와 p99·burst 검증을 구분하고 작업 종류별로 측정합니다.

## 득점 포인트

- 평균 처리 시간만으로 큐 길이를 정하면 긴 꼬리 작업 때문에 deadline을 넘길 수 있습니다. 도착률·작업 비용 분포·현재 실행량과 남은 기한을 보고 수락·대기·거절을 나눕니다.
- 평균 용량 관계와 p99·burst 검증을 구분하고 작업 종류별로 측정합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 평균 처리 시간만으로 큐 길이를 정하면 긴 꼬리 작업 때문에 deadline을 넘길 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 비동기 DB 조회로 future를 받았지만 결과를 기다리는 동안 서버가 멈춥니다. 비동기 API를 써도 스레드가 블로킹될 수 있나요?](/tech-interview/questions/async-api-and-blocking/)
