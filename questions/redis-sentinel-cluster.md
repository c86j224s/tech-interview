---
id: redis-sentinel-cluster
title: "Redis 주 노드 장애에 자동 대응하고 데이터가 커지면 여러 노드로 나누려 합니다. Sentinel과 Cluster는 각각 무엇을 해결하며 클라이언트는 무엇을 지원해야 하나요?"
answerMinutes: 5
followups: [{"id":"redis-cluster-hash-tags","prompt":"Cluster의 hash tag가 다중 키 원자성과 샤딩에 어떤 제약을 만드는지 설명해 보세요."},{"id":"redis-wait-durability","prompt":"WAIT 성공 뒤에도 승격 replica에 쓰기가 없을 수 있는 장애 순서를 어떻게 재현하나요?"},{"id":"db-read-replica-consistency","prompt":"Redis replica 읽기와 관계형 read replica 읽기의 최신성·라우팅 차이를 어떻게 비교하나요?"}]
difficulty: 하
category: 데이터베이스
tags: ["Redis","Sentinel","Cluster"]
related: ["hash-sharding-and-resharding"]
---

# Redis 주 노드 장애에 자동 대응하고 데이터가 커지면 여러 노드로 나누려 합니다. Sentinel과 Cluster는 각각 무엇을 해결하며 클라이언트는 무엇을 지원해야 하나요?

## 구두 답변

Sentinel과 Cluster는 장애 대응과 데이터 분산을 서로 다른 범위에서 해결합니다. Sentinel은 한 데이터셋의 primary·replica를 감시하고 primary 장애를 판단해 replica를 승격하며 클라이언트가 새 primary 주소를 찾도록 돕습니다. 키 공간을 여러 primary에 나누는 샤딩은 제공하지 않습니다. Redis Cluster는 키 공간을 슬롯으로 나눠 여러 primary에 분산하고 각 슬롯의 replica·장애 전환·클라이언트 라우팅을 함께 다룹니다.

### 용량과 가용성의 문제를 분리합니다

단일 노드의 메모리·처리량 안에서 primary 장애 전환이 필요하면 Sentinel을 검토할 수 있습니다. 한 노드 용량을 넘는 키 공간이나 쓰기 처리량을 여러 노드에 나눠야 하면 Cluster의 슬롯 배치와 클라이언트 지원이 필요합니다. Cluster에서는 다중 키 명령·Lua가 같은 슬롯 키를 요구하고, 슬롯 이동 중 `MOVED`·`ASK`를 클라이언트가 처리해야 합니다. Sentinel을 붙였다고 다중 primary 샤딩이 생기지 않고, Cluster라고 모든 키 조합이 원자적으로 바뀌지도 않습니다.

두 구성의 비동기 복제에서 primary가 성공 응답한 쓰기가 승격 replica에 아직 없을 수 있습니다. replica의 존재는 모든 커밋의 영구 보존이나 최신 읽기를 보장하지 않습니다. 지속성 설정, 복제 확인, 장애 도메인 배치, 애플리케이션 요청 멱등성을 함께 설계해야 합니다. Sentinel quorum은 장애를 관찰·합의하는 조건이지 이미 유실된 쓰기를 복원하는 저장 보장이 아닙니다.

### 클라이언트와 장애 계약을 검증합니다

클라이언트는 Sentinel 구성에서 primary 주소를 조회하고 오래된 연결을 폐기해야 하며, Cluster 구성에서는 슬롯 캐시·리다이렉트·재연결을 지원해야 합니다. 장애 전환 중 기존 커넥션이 이전 primary를 가리키거나 명령이 실행된 뒤 응답이 유실될 수 있으므로, 쓰기 재시도는 요청 ID·결과 조회와 연결합니다. 읽기 복제본을 사용할 경우 read-your-writes가 깨질 수 있어 최신성 요구에 따라 primary 라우팅이나 버전 확인을 둡니다.

검증은 primary 중단, 네트워크 분할, Sentinel 관찰 노드 손실, 승격 중 연결 재사용, Cluster 슬롯 이동과 핫 슬롯을 재현합니다. 탐지·승격 시간, 새 주소 발견, 읽기·쓰기 오류, 승격된 값의 유실, 재시도 중복을 기록합니다. Redis 버전과 클라이언트 라이브러리의 Sentinel·Cluster 지원 계약이 다를 수 있으므로 설정 파일이 로드됐다는 사실보다 실제 장애 동작을 기준으로 판단하겠습니다.

Sentinel과 Cluster를 선택할 때 클라이언트가 실제로 어떤 장애 응답을 받는지도 중요합니다. Sentinel은 새 primary 주소를 다시 찾는 과정이 필요하고, Cluster는 슬롯 캐시가 오래되면 MOVED·ASK를 처리하며 재연결해야 합니다. 타임아웃 뒤 명령 실행 여부가 불명확한 것은 두 구성 모두의 문제이므로 요청 멱등성을 별도로 둡니다. 복제 지연·장애 탐지·승격 시간과 원본 데이터의 허용 유실을 한 표에 놓고 선택하겠습니다.

## 득점 포인트

- Sentinel의 감시·승격과 Cluster의 슬롯 샤딩을 구분한다.
- 다중 키 슬롯 제약과 클라이언트 리다이렉트를 설명한다.
- 비동기 복제 유실·재시도·장애 도메인을 보장 범위에 포함한다.

## 감점 포인트

- Sentinel이 키를 여러 primary에 나눈다고 한다.
- Cluster의 어떤 키 조합도 원자적이라고 말한다.
- replica가 모든 성공 쓰기를 보존한다고 단정한다.

## 더 파고들 거리

- Sentinel quorum과 승격 조건을 실제 장애로 확인해 보세요.
- 슬롯 이동 중 MOVED·ASK와 커넥션 폐기를 검증해 보세요.
- 장애 전환 뒤 읽기 최신성과 쓰기 중복을 측정해 보세요.
