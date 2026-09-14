---
id: "api-null-omission-patch"
title: "프로필 수정 API에서 필드 생략과 null을 다르게 쓰려 합니다. 값 유지·삭제·기본값을 어떻게 명시하나요?"
difficulty: "중하"
category: "설계"
tags: ["API","호환성","프로토콜","심화 질문"]
related: ["api-backward-compatibility","db-online-schema-migration"]
promotedFrom: {"id":"api-backward-compatibility","prompt":"null과 생략을 다르게 해석하는 API를 어떻게 문서화할까요?"}
---

# 프로필 수정 API에서 필드 생략과 null을 다르게 쓰려 합니다. 값 유지·삭제·기본값을 어떻게 명시하나요?

## 구두 답변

수정 API의 필드 생략은 기존 값 유지, 명시적 null은 삭제처럼 각 상태를 구분해 정의합니다. 생성 시 기본값과 수정 시 누락의 의미를 같은 함수로 처리하면 의도하지 않은 초기화가 생길 수 있습니다.

null을 허용하지 않는 필드는 삭제 요청을 거절하고, 빈 문자열·빈 배열도 별도 의미를 정합니다. JSON Merge Patch 등 표준 형식을 택하면 그 규칙을 따르되 도메인 인가는 별도로 검사합니다. 구버전 client·중첩 필드·동시 수정에서 결과를 비교합니다.

## 득점 포인트

- 수정 API의 필드 생략은 기존 값 유지, 명시적 null은 삭제처럼 각 상태를 구분해 정의합니다. 생성 시 기본값과 수정 시 누락의 의미를 같은 함수로 처리하면 의도하지 않은 초기화가 생길 수 있습니다.
- 구버전 client·중첩 필드·동시 수정에서 결과를 비교합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 수정 API의 필드 생략은 기존 값 유지, 명시적 null은 삭제처럼 각 상태를 구분해 정의합니다.

## 더 파고들 거리

- [기본 상황과 비교: 서버의 JSON 응답에 필드나 상태 값을 추가하려 합니다. 업데이트하지 않은 모바일 앱이 왜 실패할 수 있으며 어떻게 검증하나요?](/tech-interview/questions/api-backward-compatibility/)
