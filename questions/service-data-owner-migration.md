---
id: "service-data-owner-migration"
title: "서비스 경계를 옮기며 상대 DB 직접 조회를 없앱니다. API·이벤트·읽기 모델과 쓰기 권위는 어떤 순서로 전환하나요?"
difficulty: "중하"
category: "설계"
tags: ["서비스 경계","도메인","MSA","심화 질문"]
related: ["service-boundary-design","saga-compensation"]
promotedFrom: {"id":"service-boundary-design","prompt":"데이터 소유권을 이전할 때 직접 DB 조회를 어떤 API·이벤트로 바꾸나요?"}
---

# 서비스 경계를 옮기며 상대 DB 직접 조회를 없앱니다. API·이벤트·읽기 모델과 쓰기 권위는 어떤 순서로 전환하나요?

## 구두 답변

원본 데이터의 쓰기 owner를 정하고 다른 서비스의 직접 DB 의존을 API·이벤트 계약으로 바꿉니다. 읽기 모델과 동시 쓰기·재처리·호환을 준비한 뒤 권위를 전환합니다.

새 서비스 배포만으로 완료가 아닙니다. 배치·관리 도구·복구 절차의 옛 접근을 조사합니다. dual write의 부분 실패와 rollback 시 새 데이터 반영을 원장·version으로 대사합니다.

## 득점 포인트

- 원본 데이터의 쓰기 owner를 정하고 다른 서비스의 직접 DB 의존을 API·이벤트 계약으로 바꿉니다. 읽기 모델과 동시 쓰기·재처리·호환을 준비한 뒤 권위를 전환합니다.
- dual write의 부분 실패와 rollback 시 새 데이터 반영을 원장·version으로 대사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 원본 데이터의 쓰기 owner를 정하고 다른 서비스의 직접 DB 의존을 API·이벤트 계약으로 바꿉니다.

## 더 파고들 거리

- [기본 상황과 비교: 주문·결제·재고 테이블을 각각 서비스로 나누자는 제안이 나왔습니다. 어떤 변경은 함께 확정해야 하는지와 데이터 소유권을 기준으로 경계를 어떻게 검토하나요?](/tech-interview/questions/service-boundary-design/)
