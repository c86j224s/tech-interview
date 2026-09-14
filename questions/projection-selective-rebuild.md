---
id: "projection-selective-rebuild"
title: "원본과 일부 요약 행이 다릅니다. 전체 삭제 없이 대조·선택 재생성·실시간 이벤트 적용을 어떻게 조합하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["반정규화","중복 데이터","갱신 책임","읽기 모델","심화 질문"]
related: ["denormalization-maintenance","normalization-anomalies","db-n-plus-one"]
promotedFrom: {"id":"denormalization-maintenance","prompt":"원본·요약 대조 쿼리와 선택적 재생성 절차를 만들어 보세요."}
---

# 원본과 일부 요약 행이 다릅니다. 전체 삭제 없이 대조·선택 재생성·실시간 이벤트 적용을 어떻게 조합하나요?

## 구두 답변

원본 version과 projection의 계산 규칙·적용 위치를 대조해 차이가 있는 범위만 새로 계산합니다. 재계산 중 들어온 이벤트를 놓치지 않게 snapshot 기준과 이후 증분을 연결합니다.

새 결과 게시 때 현재 version을 비교하고 늦은 재구축이 새 값을 덮지 않게 합니다. 전체 상태와 delta 적용의 의미를 구분합니다. 삭제·환불·계산 규칙 변경을 포함해 checksum·합계·관계를 검사하고 보정 작업 자체를 멱등하게 만듭니다.

## 득점 포인트

- 원본 version과 projection의 계산 규칙·적용 위치를 대조해 차이가 있는 범위만 새로 계산합니다. 재계산 중 들어온 이벤트를 놓치지 않게 snapshot 기준과 이후 증분을 연결합니다.
- 삭제·환불·계산 규칙 변경을 포함해 checksum·합계·관계를 검사하고 보정 작업 자체를 멱등하게 만듭니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 원본 version과 projection의 계산 규칙·적용 위치를 대조해 차이가 있는 범위만 새로 계산합니다.

## 더 파고들 거리

- [기본 상황과 비교: 조회 속도를 위해 주문 요약에 상품명과 합계 금액을 복사하려 합니다. 중복을 안전하게 유지하려면 무엇을 정해야 하나요?](/tech-interview/questions/denormalization-maintenance/)
