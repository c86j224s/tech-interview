---
id: "python-sort-key-function-cost"
title: "Python 정렬이 느립니다. key 함수 계산과 비교·병합 비용을 어떻게 분리해 측정하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Python","sort","Timsort","run","안정성","심화 질문"]
related: ["python-timsort-stability","sorting-stability"]
promotedFrom: {"id":"python-timsort-stability","prompt":"키 함수 비용을 정렬 비교 비용과 어떻게 분리해 측정할까요?"}
---

# Python 정렬이 느립니다. key 함수 계산과 비교·병합 비용을 어떻게 분리해 측정하나요?

## 구두 답변

Python key 정렬은 일반적으로 원소별 key 계산을 재사용하는 계약을 활용할 수 있어 매 비교마다 비싼 함수를 호출하는 comparator와 다릅니다. key 계산·비교·데이터 이동을 나눠 측정합니다.

외부 조회·시간·가변 상태를 key 함수에서 읽으면 재현성과 비용이 흔들립니다. 사전 계산·cache·복합 키를 검토하되 메모리와 신선도를 확인합니다. 동일값·NaN·혼합 타입도 시험합니다.

## 득점 포인트

- Python key 정렬은 일반적으로 원소별 key 계산을 재사용하는 계약을 활용할 수 있어 매 비교마다 비싼 함수를 호출하는 comparator와 다릅니다. key 계산·비교·데이터 이동을 나눠 측정합니다.
- 동일값·NaN·혼합 타입도 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Python key 정렬은 일반적으로 원소별 key 계산을 재사용하는 계약을 활용할 수 있어 매 비교마다 비싼 함수를 호출하는 comparator와 다릅니다.

## 더 파고들 거리

- [기본 상황과 비교: Python에서 일부 정렬된 데이터를 다시 정렬하고 동점자의 기존 순서도 유지하려 합니다. sort의 보장과 이미 정렬된 구간을 활용하는 구현 특성을 어떻게 구분하나요?](/tech-interview/questions/python-timsort-stability/)
