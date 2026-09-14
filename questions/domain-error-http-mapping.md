---
id: "domain-error-http-mapping"
title: "형식 오류·업무 거절·인프라 장애를 HTTP 응답으로 바꿉니다. 도메인과 controller 사이 책임은 어떻게 나누나요?"
difficulty: "중하"
category: "설계"
tags: ["MVC","책임 분리","컨트롤러","모델","뷰","심화 질문"]
related: ["mvc-responsibilities","service-boundary-design"]
promotedFrom: {"id":"mvc-responsibilities","prompt":"입력 검증 실패·업무 규칙에 따른 거절·인프라 장애를 HTTP 응답으로 바꾸는 책임은 어느 계층에 둘까요?"}
---

# 형식 오류·업무 거절·인프라 장애를 HTTP 응답으로 바꿉니다. 도메인과 controller 사이 책임은 어떻게 나누나요?

## 구두 답변

도메인은 형식에 독립적인 결과·거절·불확정 상태를 표현하고 HTTP adapter가 이를 상태 코드·본문으로 매핑합니다. domain 코드가 모든 곳에서 HTTP 객체를 요구하면 경계가 결합됩니다.

입력 오류·인가 실패·재고 부족·DB timeout의 재시도 의미를 나눕니다. 내부 SQL·비밀을 노출하지 않고 추적 ID를 제공합니다. 같은 서비스의 메시지 consumer도 같은 업무 규칙을 사용하게 합니다.

## 득점 포인트

- 도메인은 형식에 독립적인 결과·거절·불확정 상태를 표현하고 HTTP adapter가 이를 상태 코드·본문으로 매핑합니다. domain 코드가 모든 곳에서 HTTP 객체를 요구하면 경계가 결합됩니다.
- 같은 서비스의 메시지 consumer도 같은 업무 규칙을 사용하게 합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 도메인은 형식에 독립적인 결과·거절·불확정 상태를 표현하고 HTTP adapter가 이를 상태 코드·본문으로 매핑합니다.

## 더 파고들 거리

- [기본 상황과 비교: 웹 요청 하나의 컨트롤러가 인증·가격 계산·DB 저장·HTML 렌더링을 모두 맡습니다. MVC에서 책임을 어떻게 나누나요?](/tech-interview/questions/mvc-responsibilities/)
