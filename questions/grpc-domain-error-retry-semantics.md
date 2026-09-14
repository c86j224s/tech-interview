---
id: "grpc-domain-error-retry-semantics"
title: "잔액 부족을 gRPC 전송 장애처럼 반환했습니다. 상태 코드와 업무 거절을 어떻게 나눠 잘못된 재시도를 막나요?"
difficulty: "중하"
category: "설계"
tags: ["gRPC","REST","API 계약","심화 질문"]
related: ["grpc-rest-contracts","api-backward-compatibility","deadline-cancellation-propagation"]
promotedFrom: {"id":"grpc-rest-contracts","prompt":"잔액 부족 같은 규칙상 거절을 전송 오류로 표현하면 어떤 재시도 문제가 생길까요?"}
---

# 잔액 부족을 gRPC 전송 장애처럼 반환했습니다. 상태 코드와 업무 거절을 어떻게 나눠 잘못된 재시도를 막나요?

## 구두 답변

잔액 부족은 정상적으로 계산된 업무 거절이며 연결 실패와 같은 자동 재시도 신호가 아닙니다. transport status와 도메인 결과를 호출자가 구분할 수 있게 계약을 정합니다.

timeout은 잔액 검사가 실패한 것이 아니라 변경 결과가 불확실할 수 있습니다. 요청 ID·결과 조회·멱등 키를 제공하고 상세 내부 오류를 노출하지 않습니다. 다른 언어 client의 코드 매핑·재시도 interceptor가 같은 의미를 따르는지 시험합니다.

## 득점 포인트

- 잔액 부족은 정상적으로 계산된 업무 거절이며 연결 실패와 같은 자동 재시도 신호가 아닙니다. transport status와 도메인 결과를 호출자가 구분할 수 있게 계약을 정합니다.
- 다른 언어 client의 코드 매핑·재시도 interceptor가 같은 의미를 따르는지 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 잔액 부족은 정상적으로 계산된 업무 거절이며 연결 실패와 같은 자동 재시도 신호가 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: 여러 언어의 내부 서비스가 REST API로 통신합니다. gRPC로 바꾸면 계약 관리와 실행 비용에서 무엇이 달라지나요?](/tech-interview/questions/grpc-rest-contracts/)
