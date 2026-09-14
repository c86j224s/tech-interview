---
id: "python-c3-linearization-example"
title: "다이아몬드 상속의 C3 MRO를 계산합니다. 후보 head를 tail과 비교하는 규칙은 왜 필요한가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Python","다중 상속","MRO","C3","super","심화 질문"]
related: ["python-mro-super"]
promotedFrom: {"id":"python-mro-super","prompt":"C3 선형화의 후보 head와 tail을 손으로 어떻게 계산할까요?"}
---

# 다이아몬드 상속의 C3 MRO를 계산합니다. 후보 head를 tail과 비교하는 규칙은 왜 필요한가요?

## 구두 답변

C3는 부모의 선형화와 직접 부모 순서를 합칠 때 다른 목록의 tail에 나타나지 않는 head를 선택해 순서를 보존합니다. 선택 가능한 head가 없으면 일관된 MRO를 만들 수 없습니다.

다이아몬드에서 같은 조상이 한 번만 등장하는 순서를 계산하고 super가 직접 부모 하나가 아니라 MRO의 다음 구현을 호출함을 확인합니다. cooperative 메서드는 인자와 다음 호출 규칙을 함께 지켜야 합니다.

## 득점 포인트

- C3는 부모의 선형화와 직접 부모 순서를 합칠 때 다른 목록의 tail에 나타나지 않는 head를 선택해 순서를 보존합니다. 선택 가능한 head가 없으면 일관된 MRO를 만들 수 없습니다.
- cooperative 메서드는 인자와 다음 호출 규칙을 함께 지켜야 합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: C3는 부모의 선형화와 직접 부모 순서를 합칠 때 다른 목록의 tail에 나타나지 않는 head를 선택해 순서를 보존합니다.

## 더 파고들 거리

- [기본 상황과 비교: Python 다중 상속에서 super()를 호출했더니 예상한 부모와 다른 클래스의 메서드가 실행됩니다. 호출 순서는 어떻게 정해지며 협력적으로 초기화하려면 무엇을 맞춰야 하나요?](/tech-interview/questions/python-mro-super/)
