---
id: "upper-bound-duplicate-range"
title: "정렬 배열에서 target과 같은 값이 여러 개입니다. upper_bound로 동등 구간과 부재를 어떻게 구분하나요?"
difficulty: "중하"
category: "알고리즘"
tags: ["이진 탐색","경계","불변식","심화 질문"]
related: ["binary-search-boundary"]
promotedFrom: {"id":"binary-search-boundary","prompt":"target보다 큰 첫 위치를 찾을 때 비교식과 반환 후 검사를 어떻게 바꿀지 설명해 보세요."}
---

# 정렬 배열에서 target과 같은 값이 여러 개입니다. upper_bound로 동등 구간과 부재를 어떻게 구분하나요?

## 구두 답변

lower_bound는 target 이상 첫 위치, upper_bound는 target보다 큰 첫 위치입니다. 정렬 기준이 같다면 두 경계의 차이는 같은 값의 개수를 나타내며 둘이 같으면 그 값이 없습니다.

[1,2,2,4]에서 2의 구간은 [1,3), 3의 두 경계는 모두 3입니다. upper_bound는 mid 값이 target 이하일 때 왼쪽을 버립니다. 반환 n은 합법적인 삽입 위치지만 원소 접근 가능한 인덱스는 아니므로 후속 코드를 따로 검사합니다.

## 득점 포인트

- lower_bound는 target 이상 첫 위치, upper_bound는 target보다 큰 첫 위치입니다. 정렬 기준이 같다면 두 경계의 차이는 같은 값의 개수를 나타내며 둘이 같으면 그 값이 없습니다.
- 반환 n은 합법적인 삽입 위치지만 원소 접근 가능한 인덱스는 아니므로 후속 코드를 따로 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: lower_bound는 target 이상 첫 위치, upper_bound는 target보다 큰 첫 위치입니다.

## 더 파고들 거리

- [기본 상황과 비교: 정렬된 배열에서 target 이상인 첫 위치를 찾습니다. 이진 탐색의 경계 오류를 어떻게 피하나요?](/tech-interview/questions/binary-search-boundary/)
