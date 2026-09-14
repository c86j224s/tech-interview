---
id: "safe-http-observational-effects"
title: "GET 처리도 로그와 통계 카운터를 바꿉니다. 안전한 메서드의 허용된 관찰 효과와 업무 변경을 어떻게 구분하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["HTTP","GET","POST","안전성","캐시","심화 질문"]
related: ["http-get-post-semantics","http-cache-validation","csrf-vs-xss"]
promotedFrom: {"id":"http-get-post-semantics","prompt":"안전한 메서드의 로그·카운터 효과와 캐시 부작용의 허용 범위를 어떻게 정할까요?"}
---

# GET 처리도 로그와 통계 카운터를 바꿉니다. 안전한 메서드의 허용된 관찰 효과와 업무 변경을 어떻게 구분하나요?

## 구두 답변

안전한 메서드는 client가 요청한 의미가 자원 변경을 요구하지 않는다는 계약입니다. 로그·통계처럼 부수적인 관찰 기록이 있다고 모든 GET이 곧 비안전한 것은 아닙니다.

GET에서 지급·삭제·예약을 수행하면 crawler·cache 재검증·재시도로 효과가 반복될 수 있습니다. 관찰 로그도 개인정보·용량·오류 전파를 제한합니다. 메서드 이름과 실제 업무 의미를 대조합니다.

## 득점 포인트

- 안전한 메서드는 client가 요청한 의미가 자원 변경을 요구하지 않는다는 계약입니다. 로그·통계처럼 부수적인 관찰 기록이 있다고 모든 GET이 곧 비안전한 것은 아닙니다.
- 메서드 이름과 실제 업무 의미를 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 안전한 메서드는 client가 요청한 의미가 자원 변경을 요구하지 않는다는 계약입니다.

## 더 파고들 거리

- [기본 상황과 비교: 검색과 등록 API의 HTTP 메서드를 정하려 합니다. GET과 POST의 의미는 어떻게 다르며, 민감한 값을 POST 본문에 넣는 것만으로 보호할 수 있나요?](/tech-interview/questions/http-get-post-semantics/)
