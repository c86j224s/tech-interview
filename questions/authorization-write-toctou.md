---
id: "authorization-write-toctou"
title: "권한을 확인한 직후 소유권이 바뀝니다. 인가와 실제 변경을 한 저장 경계에 묶지 못하면 어떻게 보호하나요?"
difficulty: "중하"
category: "보안"
tags: ["인증","인가","접근 제어","최소 권한","RBAC","ABAC","심화 질문"]
related: ["authentication-vs-authorization","cache-aside-consistency","transaction-and-lost-update"]
promotedFrom: {"id":"authentication-vs-authorization","prompt":"권한 검사와 변경을 원자적으로 묶지 못할 때 TOCTOU를 어떻게 줄일까요?"}
---

# 권한을 확인한 직후 소유권이 바뀝니다. 인가와 실제 변경을 한 저장 경계에 묶지 못하면 어떻게 보호하나요?

## 구두 답변

가능하면 자원 소유권·정책 버전 조건을 실제 UPDATE의 WHERE나 같은 transaction의 잠금에 포함합니다. 검사와 쓰기가 다른 저장소라면 짧은 승인 수명·버전 재검사·권위 있는 실행 서비스를 사용해 틈을 줄입니다.

소유권이 바뀌어도 옛 승인으로 쓰면 안 되는 기능과 이미 접수한 작업을 마칠 수 있는 기능을 구분합니다. 검사 직후 재검사도 경쟁을 완전히 없애지는 않습니다. 민감 변경은 실패 폐쇄·명시적 재승인·감사를 포함하고 정책 저장소 장애를 성공으로 숨기지 않습니다.

## 득점 포인트

- 가능하면 자원 소유권·정책 버전 조건을 실제 UPDATE의 WHERE나 같은 transaction의 잠금에 포함합니다. 검사와 쓰기가 다른 저장소라면 짧은 승인 수명·버전 재검사·권위 있는 실행 서비스를 사용해 틈을 줄입니다.
- 민감 변경은 실패 폐쇄·명시적 재승인·감사를 포함하고 정책 저장소 장애를 성공으로 숨기지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 가능하면 자원 소유권·정책 버전 조건을 실제 UPDATE의 WHERE나 같은 transaction의 잠금에 포함합니다.

## 더 파고들 거리

- [기본 상황과 비교: 로그인한 사용자가 URL의 주문 ID를 바꿔 다른 사람의 주문을 요청합니다. 로그인 확인만으로 충분하며, 인증과 인가를 어디에서 구분해 검사해야 하나요?](/tech-interview/questions/authentication-vs-authorization/)
