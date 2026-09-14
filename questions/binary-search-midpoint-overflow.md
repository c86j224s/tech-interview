---
id: "binary-search-midpoint-overflow"
title: "정수 범위 끝에서 이진 탐색 중간값 계산이 넘칠 수 있습니다. 안전한 식도 어떤 구간 전제를 요구하나요?"
difficulty: "중하"
category: "알고리즘"
tags: ["이진 탐색","경계","불변식","심화 질문"]
related: ["binary-search-boundary"]
promotedFrom: {"id":"binary-search-boundary","prompt":"정수 오버플로가 가능한 언어에서 중간값 계산을 안전하게 하는 이유를 말해 보세요."}
---

# 정수 범위 끝에서 이진 탐색 중간값 계산이 넘칠 수 있습니다. 안전한 식도 어떤 구간 전제를 요구하나요?

## 구두 답변

lo+(hi-lo)/2는 lo+hi의 덧셈 overflow를 피하지만 hi-lo 자체가 표현 가능하다는 전제가 필요합니다. 일반 배열의 0≤lo≤hi≤n 범위와 전체 signed 정수 영역 탐색을 구분해야 합니다.

중간값이 어느 쪽으로 반올림되는지와 lo·hi 갱신이 반드시 진행하는지 확인합니다. 언어의 signed overflow·정수 나눗셈·unsigned 혼합 규칙을 따릅니다. 최대·최소·빈 구간·두 후보만 남은 상태를 테스트하고 계산이 안전해도 반환 후 범위 검사는 별도입니다.

## 득점 포인트

- lo+(hi-lo)/2는 lo+hi의 덧셈 overflow를 피하지만 hi-lo 자체가 표현 가능하다는 전제가 필요합니다. 일반 배열의 0≤lo≤hi≤n 범위와 전체 signed 정수 영역 탐색을 구분해야 합니다.
- 최대·최소·빈 구간·두 후보만 남은 상태를 테스트하고 계산이 안전해도 반환 후 범위 검사는 별도입니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: lo+(hi-lo)/2는 lo+hi의 덧셈 overflow를 피하지만 hi-lo 자체가 표현 가능하다는 전제가 필요합니다.

## 더 파고들 거리

- [기본 상황과 비교: 정렬된 배열에서 target 이상인 첫 위치를 찾습니다. 이진 탐색의 경계 오류를 어떻게 피하나요?](/tech-interview/questions/binary-search-boundary/)
