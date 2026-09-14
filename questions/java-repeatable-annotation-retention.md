---
id: "java-repeatable-annotation-retention"
title: "Repeatable 어노테이션을 reflection으로 읽습니다. 반복 요소와 컨테이너의 retention·조회 API는 어떻게 맞추나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","어노테이션","Retention","reflection","annotation processor","심화 질문"]
related: ["java-annotation-retention","java-overload-override"]
promotedFrom: {"id":"java-annotation-retention","prompt":"Repeatable 어노테이션에서 컨테이너와 반복 요소의 Retention 조건은 무엇인가요?"}
---

# Repeatable 어노테이션을 reflection으로 읽습니다. 반복 요소와 컨테이너의 retention·조회 API는 어떻게 맞추나요?

## 구두 답변

반복 어노테이션은 컨테이너 타입으로 표현될 수 있어 반복 요소와 컨테이너의 retention·target이 호환되어야 합니다. reflection에서 단일 조회와 getAnnotationsByType 같은 반복 인식 조회를 구분합니다.

런타임 보존이 있어도 모듈 접근과 처리자가 실제 읽는 위치는 별도입니다. 직접·반복·상속·구버전 bytecode의 조회 결과를 검사합니다.

## 득점 포인트

- 반복 어노테이션은 컨테이너 타입으로 표현될 수 있어 반복 요소와 컨테이너의 retention·target이 호환되어야 합니다. reflection에서 단일 조회와 getAnnotationsByType 같은 반복 인식 조회를 구분합니다.
- 직접·반복·상속·구버전 bytecode의 조회 결과를 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 반복 어노테이션은 컨테이너 타입으로 표현될 수 있어 반복 요소와 컨테이너의 retention·target이 호환되어야 합니다.

## 더 파고들 거리

- [기본 상황과 비교: 어노테이션을 붙였는데 런타임 reflection에서 보이지 않습니다. SOURCE·CLASS·RUNTIME 보존과 실제 처리자의 차이는 무엇인가요?](/tech-interview/questions/java-annotation-retention/)
