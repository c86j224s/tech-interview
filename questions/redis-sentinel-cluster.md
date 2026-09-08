---
id: redis-sentinel-cluster
title: "Redis Sentinel과 Cluster는 고가용성·샤딩·클라이언트 라우팅에서 어떤 문제를 각각 해결하나요?"
difficulty: 하
category: 데이터베이스
tags: ["Redis","Sentinel","Cluster"]
related: ["hash-sharding-and-resharding"]
---

# Redis Sentinel과 Cluster는 고가용성·샤딩·클라이언트 라우팅에서 어떤 문제를 각각 해결하나요?

## 구두 답변

Sentinel은 주로 한 Redis 데이터셋의 primary와 replica를 감시하고, 장애가 의심되는 primary 대신 적합한 replica를 새 primary로 승격하며 클라이언트가 새 주소를 찾도록 돕습니다. 데이터 키 공간을 여러 primary로 나누는 샤딩을 제공하지는 않습니다. Cluster는 키 공간을 슬롯으로 나누어 여러 primary에 분산하고, 각 슬롯의 replica와 장애 전환, 슬롯 라우팅을 함께 다룹니다.

따라서 한 노드의 메모리·처리량 안에서 primary 장애 전환이 필요한 시스템은 Sentinel을 검토할 수 있고, 단일 노드의 용량을 넘어 데이터를 나눠야 하면 Cluster의 슬롯 배치와 클라이언트 지원을 검토합니다. Cluster에서는 다중 키 명령이 같은 슬롯을 요구하고, 클라이언트가 `MOVED`·`ASK` 리다이렉트를 처리해야 합니다. Sentinel을 붙였다고 다중 primary 샤딩이 생기지는 않습니다.

두 구성 모두 일반적인 비동기 복제에서는 primary가 성공 응답한 최신 쓰기가 장애 전환 때 승격된 replica에 없을 수 있습니다. replica가 있다는 사실은 모든 확인된 쓰기의 영구 보존을 뜻하지 않으며, 재연결·재시도 중 중복 효과도 업무별로 다뤄야 합니다. 더 강한 보장이 필요하면 복제 확인, 지속성, 애플리케이션 멱등성을 함께 설계하되 전체 장애 조합을 시험해야 합니다.

검증은 primary 중단, 네트워크 분할, 승격 중 연결 재사용, Cluster 슬롯 이동을 실제로 발생시켜 탐지 시간, 새 노드 발견, 읽기·쓰기 오류, 최신 데이터와 재시도 결과를 확인하는 방식으로 하겠습니다.

## 득점 포인트

- 감시·장애 전환과 키 공간 분산의 역할을 구분한다.
- Cluster의 다중 키·리다이렉트 제약을 설명한다.
- 비동기 복제의 유실과 재시도 비용을 인정한다.

## 감점 포인트

- Sentinel이 키를 여러 primary에 나눈다고 말한다.
- Cluster면 어느 슬롯의 다중 키도 원자적이라고 말한다.
- replica가 있으면 성공한 모든 쓰기가 보존된다고 말한다.

## 더 파고들 거리

- Sentinel quorum과 실제 승격 권한은 어떻게 연결되나요?
- 슬롯 재배치 중 `MOVED`와 `ASK`를 클라이언트가 어떻게 처리하나요?
- 장애 전환 뒤 오래된 커넥션 풀을 어떤 조건으로 폐기하나요?
