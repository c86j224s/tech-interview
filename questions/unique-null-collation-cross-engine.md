---
id: "unique-null-collation-cross-engine"
title: "같은 이메일 제약을 다른 DB로 옮깁니다. collation·NULL·부분 인덱스의 차이를 어떤 데이터로 검증하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["함수 종속","후보키","슈퍼키","업무 제약","심화 질문"]
related: ["functional-dependency-keys","normalization-anomalies","normal-forms-partial-transitive"]
promotedFrom: {"id":"functional-dependency-keys","prompt":"collation·NULL·부분 인덱스의 엔진별 유일성 동작을 검증해 보세요."}
---

# 같은 이메일 제약을 다른 DB로 옮깁니다. collation·NULL·부분 인덱스의 차이를 어떤 데이터로 검증하나요?

## 구두 답변

대소문자·악센트·Unicode 정규화·NULL의 UNIQUE 처리와 부분 인덱스 지원을 목표 엔진에서 확인합니다. 같은 SQL 이름이나 샘플 데이터가 같은 유일성 계약을 뜻하지 않습니다.

충돌될 수 있는 기존 키를 먼저 대사하고 표시 원문과 비교 키를 분리합니다. 활성·탈퇴·복구와 동시 삽입을 시험합니다. migration 과정에서 새 제약을 만들기 전에 임의로 계정을 합치거나 참조를 끊지 않습니다.

## 득점 포인트

- 대소문자·악센트·Unicode 정규화·NULL의 UNIQUE 처리와 부분 인덱스 지원을 목표 엔진에서 확인합니다. 같은 SQL 이름이나 샘플 데이터가 같은 유일성 계약을 뜻하지 않습니다.
- migration 과정에서 새 제약을 만들기 전에 임의로 계정을 합치거나 참조를 끊지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 대소문자·악센트·Unicode 정규화·NULL의 UNIQUE 처리와 부분 인덱스 지원을 목표 엔진에서 확인합니다.

## 더 파고들 거리

- [기본 상황과 비교: 현재 회원 데이터에서는 이메일이 모두 달라 이메일을 키로 쓰자는 제안이 나왔습니다. 후보키를 정할 때 관찰한 데이터와 반드시 지켜야 할 제약을 어떻게 구분하나요?](/tech-interview/questions/functional-dependency-keys/)
