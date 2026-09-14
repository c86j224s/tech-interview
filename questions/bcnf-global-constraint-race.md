---
id: "bcnf-global-constraint-race"
title: "BCNF 분해 뒤 제약 검사가 두 테이블의 조인을 요구합니다. 동시 삽입에서 그 제약을 어떻게 보호하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["3NF","BCNF","무손실 조인","종속성 보존","심화 질문"]
related: ["bcnf-lossless-decomposition","normal-forms-partial-transitive","functional-dependency-keys"]
promotedFrom: {"id":"bcnf-lossless-decomposition","prompt":"종속성 보존이 없는 BCNF에서 동시 삽입 검사를 설계해 보세요."}
---

# BCNF 분해 뒤 제약 검사가 두 테이블의 조인을 요구합니다. 동시 삽입에서 그 제약을 어떻게 보호하나요?

## 구두 답변

각 분해 테이블의 UNIQUE만으로 원래 종속을 표현하지 못하면 조인 검사와 동시 쓰기 보호가 필요합니다. 두 transaction이 모두 검사 후 삽입하면 단순 SELECT 검증은 경쟁을 남깁니다.

공통 권위 행 잠금·직렬화 격리·대체 고유 키·3NF 유지 중 제약을 단순하게 강제할 방법을 비교합니다. trigger도 격리와 잠금 범위가 맞아야 합니다. 유효·무효 예제를 동시 삽입해 원래 함수 종속을 실제로 거절하는지 확인합니다.

## 득점 포인트

- 각 분해 테이블의 UNIQUE만으로 원래 종속을 표현하지 못하면 조인 검사와 동시 쓰기 보호가 필요합니다. 두 transaction이 모두 검사 후 삽입하면 단순 SELECT 검증은 경쟁을 남깁니다.
- 유효·무효 예제를 동시 삽입해 원래 함수 종속을 실제로 거절하는지 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 각 분해 테이블의 UNIQUE만으로 원래 종속을 표현하지 못하면 조인 검사와 동시 쓰기 보호가 필요합니다.

## 더 파고들 거리

- [기본 상황과 비교: 3NF를 만족하는 테이블에도 중복이 남아 BCNF로 더 나누려 합니다. 원래 데이터를 복원할 수 있는지와 기존 제약을 계속 검사할 수 있는지는 어떻게 확인하나요?](/tech-interview/questions/bcnf-lossless-decomposition/)
