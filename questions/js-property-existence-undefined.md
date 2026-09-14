---
id: "js-property-existence-undefined"
title: "Object.hasOwn·in·undefined 비교는 속성의 존재와 상속·값 부재를 어떻게 다르게 판단하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","프로토타입","프로퍼티 조회","class","shadowing","심화 질문"]
related: ["js-prototype-lookup","js-object-copy"]
promotedFrom: {"id":"js-prototype-lookup","prompt":"Object.hasOwn·in·undefined 비교가 존재성에서 어떻게 다른가요?"}
---

# Object.hasOwn·in·undefined 비교는 속성의 존재와 상속·값 부재를 어떻게 다르게 판단하나요?

## 구두 답변

hasOwn은 직접 소유한 프로퍼티, in은 prototype까지 포함한 존재를 확인합니다. 값이 undefined인지 비교하면 존재하지만 값이 undefined인 경우와 없는 경우를 구분하지 못합니다.

Object.create(null)·상속된 키·getter를 포함한 테스트를 둡니다. 객체의 hasOwnProperty 메서드가 외부 키로 덮일 수 있어 안전한 호출 API를 사용합니다. 존재 확인과 허용 값·권한 검사는 별개입니다.

## 득점 포인트

- hasOwn은 직접 소유한 프로퍼티, in은 prototype까지 포함한 존재를 확인합니다. 값이 undefined인지 비교하면 존재하지만 값이 undefined인 경우와 없는 경우를 구분하지 못합니다.
- 존재 확인과 허용 값·권한 검사는 별개입니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: hasOwn은 직접 소유한 프로퍼티, in은 prototype까지 포함한 존재를 확인합니다.

## 더 파고들 거리

- [기본 상황과 비교: 객체에 직접 값을 넣었다가 삭제했는데 같은 이름의 값이 여전히 조회됩니다. 프로토타입을 따라 찾는 과정과 class 메서드의 저장 위치를 설명해 보세요.](/tech-interview/questions/js-prototype-lookup/)
