---
id: "authorization-pdp-pep-cache"
title: "정책 결정 서비스와 집행 서비스를 나눴습니다. 캐시·장애·정책 배포에서 어느 쪽이 무엇을 책임지나요?"
difficulty: "중하"
category: "보안"
tags: ["인증","인가","접근 제어","최소 권한","RBAC","ABAC","심화 질문"]
related: ["authentication-vs-authorization","cache-aside-consistency","transaction-and-lost-update"]
promotedFrom: {"id":"authentication-vs-authorization","prompt":"정책 결정과 집행을 분리할 때 캐시·장애·정책 배포의 책임은 어디에 둘까요?"}
---

# 정책 결정 서비스와 집행 서비스를 나눴습니다. 캐시·장애·정책 배포에서 어느 쪽이 무엇을 책임지나요?

## 구두 답변

PDP는 정책을 평가하고 PEP는 실제 요청에 결정을 적용합니다. 원격 결정이 있다고 PEP가 대상·행동·정책 version을 생략하면 다른 요청의 허가를 재사용할 수 있습니다.

결정 cache는 사용자·자원·행동·관련 속성과 만료를 묶고 권한 철회 지연을 명시합니다. PDP 장애 때 민감 변경은 안전하게 제한하며 마지막 정상 허가를 무기한 사용하지 않습니다. 정책 배포와 데이터 변경의 TOCTOU를 저장 조건·짧은 승인으로 보완합니다.

## 득점 포인트

- PDP는 정책을 평가하고 PEP는 실제 요청에 결정을 적용합니다. 원격 결정이 있다고 PEP가 대상·행동·정책 version을 생략하면 다른 요청의 허가를 재사용할 수 있습니다.
- 정책 배포와 데이터 변경의 TOCTOU를 저장 조건·짧은 승인으로 보완합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: PDP는 정책을 평가하고 PEP는 실제 요청에 결정을 적용합니다.

## 더 파고들 거리

- [기본 상황과 비교: 로그인한 사용자가 URL의 주문 ID를 바꿔 다른 사람의 주문을 요청합니다. 로그인 확인만으로 충분하며, 인증과 인가를 어디에서 구분해 검사해야 하나요?](/tech-interview/questions/authentication-vs-authorization/)
