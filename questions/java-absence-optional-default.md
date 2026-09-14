---
id: "java-absence-optional-default"
title: "숫자가 없음을 Optional·nullable 래퍼·기본값으로 표현합니다. 0과 부재를 구분하려면 무엇을 선택하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","autoboxing","unboxing","Integer","null","심화 질문"]
related: ["java-boxing-null","java-equals-hashcode"]
promotedFrom: {"id":"java-boxing-null","prompt":"Optional·nullable 래퍼·기본값 중 부재 의미를 가장 잘 표현하는 것은 무엇인가요?"}
---

# 숫자가 없음을 Optional·nullable 래퍼·기본값으로 표현합니다. 0과 부재를 구분하려면 무엇을 선택하나요?

## 구두 답변

0이 실제 값일 수 있으면 부재를 기본 0으로 합치지 않습니다. nullable은 호출자가 null을 처리해야 하고 Optional은 부재 분기를 API에 드러낼 수 있지만 사용 위치·직렬화·비용을 검토합니다.

DB NULL·JSON 생략·null·기본값의 의미를 맞춥니다. orElse의 즉시 평가와 지연 supplier 같은 호출 계약도 확인합니다. 정상 부재와 조회 실패를 같은 빈 값으로 숨기지 않습니다.

## 득점 포인트

- 0이 실제 값일 수 있으면 부재를 기본 0으로 합치지 않습니다. nullable은 호출자가 null을 처리해야 하고 Optional은 부재 분기를 API에 드러낼 수 있지만 사용 위치·직렬화·비용을 검토합니다.
- 정상 부재와 조회 실패를 같은 빈 값으로 숨기지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 0이 실제 값일 수 있으면 부재를 기본 0으로 합치지 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: Integer 비교가 작은 수에서는 맞아 보이는데 null에서는 예외가 납니다. boxing·unboxing과 ==의 비교 대상을 구분해 보세요.](/tech-interview/questions/java-boxing-null/)
