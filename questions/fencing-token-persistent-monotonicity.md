---
id: "fencing-token-persistent-monotonicity"
title: "펜싱 번호 발급기가 재시작해 번호가 작아졌습니다. 오래된 writer를 막으려면 어떤 내구·세대 조건이 필요한가요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["분산 락","lease","펜싱","심화 질문"]
related: ["distributed-lock-fencing","hash-sharding-and-resharding"]
promotedFrom: {"id":"distributed-lock-fencing","prompt":"펜싱 토큰이 재시작 후에도 단조 증가해야 하는 이유는 무엇인가요?"}
---

# 펜싱 번호 발급기가 재시작해 번호가 작아졌습니다. 오래된 writer를 막으려면 어떤 내구·세대 조건이 필요한가요?

## 구두 답변

발급기의 재시작 뒤 낮은 번호가 다시 나오면 저장소가 새 owner를 옛 writer로 거절하거나 오래된 토큰과 구분하지 못할 수 있습니다. 내구 증가 sequence나 더 큰 epoch와 counter 조합을 사용합니다.

토큰 비교 순서가 모든 자원에서 같고 실제 변경과 원자적으로 검사되어야 합니다. 캐시·백업 복구로 최대 관찰 토큰이 되돌아가는 경우도 시험합니다. 토큰은 소유권 세대이지 요청 중복 ID가 아니므로 같은 세대의 재시도는 별도 멱등성을 유지합니다.

## 득점 포인트

- 발급기의 재시작 뒤 낮은 번호가 다시 나오면 저장소가 새 owner를 옛 writer로 거절하거나 오래된 토큰과 구분하지 못할 수 있습니다. 내구 증가 sequence나 더 큰 epoch와 counter 조합을 사용합니다.
- 토큰은 소유권 세대이지 요청 중복 ID가 아니므로 같은 세대의 재시도는 별도 멱등성을 유지합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 발급기의 재시작 뒤 낮은 번호가 다시 나오면 저장소가 새 owner를 옛 writer로 거절하거나 오래된 토큰과 구분하지 못할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 분산 락을 얻은 워커가 오래 멈췄다가 락 만료 후 다시 실행됐습니다. 새 소유자와 동시에 쓰는 일을 어떻게 막나요?](/tech-interview/questions/distributed-lock-fencing/)
