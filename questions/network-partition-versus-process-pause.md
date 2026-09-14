---
id: "network-partition-versus-process-pause"
title: "분산 테스트에서 노드 종료·프로세스 정지·네트워크 분할은 어떤 서로 다른 실패를 재현하나요?"
difficulty: "중하"
category: "설계"
tags: ["동시성 테스트","경쟁 상태","불변식","심화 질문"]
related: ["deterministic-concurrency-testing","transaction-and-lost-update","atomics-memory-order"]
promotedFrom: {"id":"deterministic-concurrency-testing","prompt":"분산 테스트에서 네트워크 분할과 노드 정지를 어떻게 구분해 주입할까요?"}
---

# 분산 테스트에서 노드 종료·프로세스 정지·네트워크 분할은 어떤 서로 다른 실패를 재현하나요?

## 구두 답변

프로세스 종료는 메모리·연결을 잃고, pause는 상태·옛 권한을 유지한 채 나중 깨어납니다. 네트워크 분할은 다른 노드들이 서로 다른 생존 관찰을 하게 만들 수 있습니다.

단방향 지연·응답만 유실·디스크 stall도 별도 실패입니다. 허가된 환경에서 각 위치를 통제하고 성공 응답·로그·소유권·외부 원장을 대조합니다. heartbeat timeout을 죽음의 증거로 보지 않고 늦은 작업의 fencing·멱등성을 확인합니다.

## 득점 포인트

- 프로세스 종료는 메모리·연결을 잃고, pause는 상태·옛 권한을 유지한 채 나중 깨어납니다. 네트워크 분할은 다른 노드들이 서로 다른 생존 관찰을 하게 만들 수 있습니다.
- heartbeat timeout을 죽음의 증거로 보지 않고 늦은 작업의 fencing·멱등성을 확인합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 프로세스 종료는 메모리·연결을 잃고, pause는 상태·옛 권한을 유지한 채 나중 깨어납니다.

## 더 파고들 거리

- [기본 상황과 비교: 동시에 재고를 차감할 때 가끔 음수가 되지만 반복 테스트에서는 잘 재현되지 않습니다. 두 요청의 실행 순서를 어떻게 통제해 검증하나요?](/tech-interview/questions/deterministic-concurrency-testing/)
