---
id: "python-yield-from-control"
title: "yield from은 generator의 값뿐 아니라 send·throw·close를 어떻게 위임하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Python","iterable","iterator","generator","지연 평가","심화 질문"]
related: ["python-generator-iterator"]
promotedFrom: {"id":"python-generator-iterator","prompt":"`yield from`과 generator의 send·throw·close는 제어를 어떻게 주고받나요?"}
---

# yield from은 generator의 값뿐 아니라 send·throw·close를 어떻게 위임하나요?

## 구두 답변

yield from은 하위 iterator의 값을 전달하고 지원되는 generator 제어를 위임하는 문법입니다. 단순 for-yield와 send·throw·close·반환값 전달에서 차이가 있습니다.

하위 종료의 StopIteration.value가 위임 표현식 결과가 될 수 있습니다. 중간 중단·예외·자원 정리를 시험하고 한 generator를 여러 소비자가 공유하는 수명과 구분합니다.

## 득점 포인트

- yield from은 하위 iterator의 값을 전달하고 지원되는 generator 제어를 위임하는 문법입니다. 단순 for-yield와 send·throw·close·반환값 전달에서 차이가 있습니다.
- 중간 중단·예외·자원 정리를 시험하고 한 generator를 여러 소비자가 공유하는 수명과 구분합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: yield from은 하위 iterator의 값을 전달하고 지원되는 generator 제어를 위임하는 문법입니다.

## 더 파고들 거리

- [기본 상황과 비교: 큰 데이터를 generator로 한 번 순회한 뒤 다시 읽으니 아무 값도 나오지 않습니다. iterable·iterator·generator는 무엇이 다르며 다시 순회하려면 어떻게 해야 하나요?](/tech-interview/questions/python-generator-iterator/)
