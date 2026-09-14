---
id: "annotation-processor-incremental-inputs"
title: "annotation processor 산출물이 증분 빌드에서 낡았습니다. 어떤 입력·삭제·의존 관계를 추적해야 하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Java","어노테이션","Retention","reflection","annotation processor","심화 질문"]
related: ["java-annotation-retention","java-overload-override"]
promotedFrom: {"id":"java-annotation-retention","prompt":"annotation processor의 증분 빌드 산출물이 stale해지지 않게 무엇을 추적할까요?"}
---

# annotation processor 산출물이 증분 빌드에서 낡았습니다. 어떤 입력·삭제·의존 관계를 추적해야 하나요?

## 구두 답변

processor 입력에는 annotation이 붙은 소스뿐 아니라 참조 타입·설정·processor 버전과 삭제된 요소가 포함될 수 있습니다. 증분 분류가 틀리면 stale 생성 파일이 남습니다.

clean build와 incremental build 결과를 비교하고 이름 변경·삭제·공통 타입 변경을 시험합니다. 생성 코드만 최신이라고 원본 계약이 맞는 것은 아닙니다. cache key와 출력 소유권을 명시해 다른 processor 결과를 지우지 않습니다.

## 득점 포인트

- processor 입력에는 annotation이 붙은 소스뿐 아니라 참조 타입·설정·processor 버전과 삭제된 요소가 포함될 수 있습니다. 증분 분류가 틀리면 stale 생성 파일이 남습니다.
- cache key와 출력 소유권을 명시해 다른 processor 결과를 지우지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: processor 입력에는 annotation이 붙은 소스뿐 아니라 참조 타입·설정·processor 버전과 삭제된 요소가 포함될 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 어노테이션을 붙였는데 런타임 reflection에서 보이지 않습니다. SOURCE·CLASS·RUNTIME 보존과 실제 처리자의 차이는 무엇인가요?](/tech-interview/questions/java-annotation-retention/)
