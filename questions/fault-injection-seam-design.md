---
id: "fault-injection-seam-design"
title: "테스트를 위해 실패 지점을 넣으려 합니다. 운영 코드의 내부 구현을 과하게 노출하지 않고 무엇을 주입하나요?"
difficulty: "중하"
category: "설계"
tags: ["동시성 테스트","경쟁 상태","불변식","심화 질문"]
related: ["deterministic-concurrency-testing","transaction-and-lost-update","atomics-memory-order"]
promotedFrom: {"id":"deterministic-concurrency-testing","prompt":"실패 주입 위치를 너무 많이 노출하지 않고 테스트 가능하게 설계하려면 어떻게 할까요?"}
---

# 테스트를 위해 실패 지점을 넣으려 합니다. 운영 코드의 내부 구현을 과하게 노출하지 않고 무엇을 주입하나요?

## 구두 답변

네트워크·시계·저장소·scheduler처럼 이미 의미 있는 경계에 실패를 주입합니다. 임의 private 변수마다 test flag를 추가하면 구현과 테스트가 과하게 결합됩니다.

commit 전후·응답 유실·소유권 전환 같은 관찰 가능한 경계를 골라 최소 반례를 만듭니다. 운영에서는 기본 구현이 정상 경로만 수행하고 주입 권한을 외부 입력이 켜지 못하게 합니다. fake와 실제 adapter의 계약 테스트를 함께 유지합니다.

## 득점 포인트

- 네트워크·시계·저장소·scheduler처럼 이미 의미 있는 경계에 실패를 주입합니다. 임의 private 변수마다 test flag를 추가하면 구현과 테스트가 과하게 결합됩니다.
- fake와 실제 adapter의 계약 테스트를 함께 유지합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 네트워크·시계·저장소·scheduler처럼 이미 의미 있는 경계에 실패를 주입합니다.

## 더 파고들 거리

- [기본 상황과 비교: 동시에 재고를 차감할 때 가끔 음수가 되지만 반복 테스트에서는 잘 재현되지 않습니다. 두 요청의 실행 순서를 어떻게 통제해 검증하나요?](/tech-interview/questions/deterministic-concurrency-testing/)
