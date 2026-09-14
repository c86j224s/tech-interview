---
id: "immutable-proxy-update-cost"
title: "불변 업데이트에서 직접 경로 복사와 proxy 기반 라이브러리를 비교합니다. 변경률·읽기·할당 비용은 어떻게 측정하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","객체 복사","spread","structuredClone","참조 공유","심화 질문"]
related: ["js-object-copy","js-prototype-lookup","js-equality-coercion"]
promotedFrom: {"id":"js-object-copy","prompt":"불변 업데이트와 Immer의 프록시 비용을 어떤 변경 패턴에서 비교할까요?"}
---

# 불변 업데이트에서 직접 경로 복사와 proxy 기반 라이브러리를 비교합니다. 변경률·읽기·할당 비용은 어떻게 측정하나요?

## 구두 답변

직접 경로 복사는 변경 경로를 명시하고 proxy 방식은 변경을 추적해 필요한 복사본을 만들 수 있습니다. 읽기·proxy trap·freeze·할당과 구조 공유의 비용이 workload에 따라 다릅니다.

깊은 tree의 작은 변경과 대량 변경·반복 읽기를 비교합니다. 결과가 불변이라는 계약과 내부 객체가 여전히 공유되는 범위를 확인합니다. library 사용이 외부 자원 복사·동시 writer 충돌까지 해결하지 않습니다.

## 득점 포인트

- 직접 경로 복사는 변경 경로를 명시하고 proxy 방식은 변경을 추적해 필요한 복사본을 만들 수 있습니다. 읽기·proxy trap·freeze·할당과 구조 공유의 비용이 workload에 따라 다릅니다.
- library 사용이 외부 자원 복사·동시 writer 충돌까지 해결하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 직접 경로 복사는 변경 경로를 명시하고 proxy 방식은 변경을 추적해 필요한 복사본을 만들 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 객체를 spread로 복사했는데 중첩 값이 함께 바뀝니다. 얕은 복사와 structuredClone의 범위는 어떻게 다른가요?](/tech-interview/questions/js-object-copy/)
