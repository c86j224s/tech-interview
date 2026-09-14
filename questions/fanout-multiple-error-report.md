---
id: "fanout-multiple-error-report"
title: "하위 호출 여러 개가 동시에 실패합니다. 대표 오류·부분 결과·나머지 진단을 어떻게 구성하나요?"
difficulty: "중하"
category: "설계"
tags: ["구조화된 동시성","취소","팬아웃","심화 질문"]
related: ["structured-concurrency-fanout","deadline-cancellation-propagation","go-channel-close-ownership"]
promotedFrom: {"id":"structured-concurrency-fanout","prompt":"여러 오류 중 대표 오류와 나머지 진단을 어떻게 구성하나요?"}
---

# 하위 호출 여러 개가 동시에 실패합니다. 대표 오류·부분 결과·나머지 진단을 어떻게 구성하나요?

## 구두 답변

사용자에게 필요한 대표 실패와 진단용 나머지 오류를 분리하되 원인을 잃지 않습니다. 첫 도착 오류가 항상 근본 원인은 아니며 취소로 파생된 오류와 원래 실패를 구분합니다.

필수·선택 결과의 성공 조건과 부분 결과 표시를 정합니다. 내부 stack·비밀은 노출하지 않고 trace로 연결합니다. 동시 실패·늦은 성공·취소 cleanup 실패를 시험합니다.

## 득점 포인트

- 사용자에게 필요한 대표 실패와 진단용 나머지 오류를 분리하되 원인을 잃지 않습니다. 첫 도착 오류가 항상 근본 원인은 아니며 취소로 파생된 오류와 원래 실패를 구분합니다.
- 동시 실패·늦은 성공·취소 cleanup 실패를 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 사용자에게 필요한 대표 실패와 진단용 나머지 오류를 분리하되 원인을 잃지 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: 요청 하나에서 여러 하위 API를 호출하는데 하나가 실패하거나 사용자가 연결을 끊었습니다. 꼭 필요한 결과와 선택 결과를 나누고 남은 작업의 수명을 어떻게 관리하나요?](/tech-interview/questions/structured-concurrency-fanout/)
