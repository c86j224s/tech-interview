---
id: "prototype-chain-performance"
title: "prototype chain을 여러 단계로 늘렸습니다. lookup·최적화·디버깅 비용을 어떤 실제 접근 패턴으로 비교하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","프로토타입","프로퍼티 조회","class","shadowing","심화 질문"]
related: ["js-prototype-lookup","js-object-copy"]
promotedFrom: {"id":"js-prototype-lookup","prompt":"prototype chain이 길어질 때 lookup 비용과 디버깅 복잡도를 어떻게 측정할까요?"}
---

# prototype chain을 여러 단계로 늘렸습니다. lookup·최적화·디버깅 비용을 어떤 실제 접근 패턴으로 비교하나요?

## 구두 답변

prototype lookup 비용은 체인 길이뿐 아니라 객체 shape·inline cache·변경·최적화 상태에 영향을 받습니다. 고정 깊이 microbenchmark 하나로 실제 앱을 판단하지 않습니다.

동적 prototype 변경과 혼합 타입이 최적화 가정을 깨는지 확인합니다. own property·상속의 디버깅 혼란과 메모리 공유 이점도 비교합니다. 보안상 외부 키 저장은 Map·null-prototype 구조를 검토합니다.

## 득점 포인트

- prototype lookup 비용은 체인 길이뿐 아니라 객체 shape·inline cache·변경·최적화 상태에 영향을 받습니다. 고정 깊이 microbenchmark 하나로 실제 앱을 판단하지 않습니다.
- 보안상 외부 키 저장은 Map·null-prototype 구조를 검토합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: prototype lookup 비용은 체인 길이뿐 아니라 객체 shape·inline cache·변경·최적화 상태에 영향을 받습니다.

## 더 파고들 거리

- [기본 상황과 비교: 객체에 직접 값을 넣었다가 삭제했는데 같은 이름의 값이 여전히 조회됩니다. 프로토타입을 따라 찾는 과정과 class 메서드의 저장 위치를 설명해 보세요.](/tech-interview/questions/js-prototype-lookup/)
