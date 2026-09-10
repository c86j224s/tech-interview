---
id: redis-wait-durability
title: "Redis WAIT가 복제 확인을 반환한 뒤에도 장애 전환에서 쓰기 보존을 단정할 수 없는 이유는 무엇인가요?"
answerMinutes: 5
followups: [{"id":"redis-sentinel-cluster","prompt":"Sentinel·Cluster의 승격 선택과 WAIT가 확인한 replica 집합이 어떻게 어긋날 수 있나요?"},{"id":"redis-rdb-aof","prompt":"WAIT의 복제 ACK와 RDB·AOF·WAITAOF의 디스크 내구 지점을 어떤 장애로 비교하나요?"},{"id":"request-timeout-idempotency","prompt":"WAIT timeout 뒤 primary에 이미 적용됐을 수 있는 쓰기를 어떻게 조회하고 안전하게 재시도하나요?"}]
difficulty: 중하
category: 데이터베이스
tags: ["Redis","WAIT","복제","내구성"]
related: ["redis-sentinel-cluster","redis-rdb-aof"]
---

# Redis WAIT가 복제 확인을 반환한 뒤에도 장애 전환에서 쓰기 보존을 단정할 수 없는 이유는 무엇인가요?

## 구두 답변

`WAIT`는 현재 연결의 앞선 쓰기에 대해 지정한 replica 수의 확인 또는 지정 timeout까지 기다리고 실제 확인 수를 반환합니다. 반환값이 목표보다 작으면 확인 목표를 충족하지 못한 것이지 쓰기가 취소된 것은 아닙니다. primary 하나만 성공한 경우보다 장애 뒤 최신 값이 남을 가능성을 높이지만, replica ACK는 모든 장애 조합에서 강한 일관성이나 디스크 내구성을 보장하지 않습니다. 어떤 replica가 승격되는지, ACK를 보낸 노드가 살아남는지, 각 노드가 메모리·디스크에 어떻게 기록하는지는 별도의 조건입니다.

### ACK의 대상과 승격 대상을 분리합니다

primary가 쓰기를 적용하고 replica A·B가 ACK를 보냈더라도 A·B가 함께 고장 나고 ACK를 보내지 않은 C가 승격되면 해당 쓰기가 사라질 수 있습니다. 네트워크 분할이나 failover 정책은 ‘몇 개가 복제했다’와 ‘승격될 노드가 그 값을 갖는다’를 자동으로 같게 만들지 않습니다. `WAIT`의 timeout은 원래 쓰기가 취소됐다는 뜻도 아닙니다. primary에는 이미 반영됐을 수 있으므로 타임아웃 뒤 증분 쓰기를 무조건 재전송하면 중복 효과가 생깁니다.

`WAIT`는 복제 메모리 적용 확인과 관계있고, Redis의 지속성·AOF/RDB flush는 디스크 기록 지점을 다룹니다. 지원 버전의 `WAITAOF`가 제공하는 확인 범위와 설정, replica의 fsync, 저장장치 장애 도메인은 별도로 검토합니다. 이것도 quorum 기반 합의나 애플리케이션의 불변식을 대신하지 않습니다. Sentinel과 Cluster의 장애 전환은 승격·슬롯 라우팅을 담당하지만 ACK가 있었던 값을 반드시 보존한다는 추가 계약은 아닙니다.

### 불확실한 결과를 멱등하게 처리합니다

변경 요청에 고유 요청 ID와 최종 상태 조회를 두고, 재시도 전에 primary·승격 노드·처리 기록에서 이미 반영됐는지 확인하겠습니다. 결과를 확인할 수 없는 작업이라면 중복 적용에 안전한 상태 머신이나 원자적인 요청 기록을 설계합니다. 단순히 `WAIT` 성공 횟수를 로그로 남기는 것보다 실패 순서에서 최종 키·원장·처리 ID가 어떻게 남는지가 검증 기준입니다.

테스트는 replica 확인 전·후 primary 중단, ACK replica 동시 중단, 다른 replica 승격, 네트워크 분할, WAIT timeout, timeout 뒤 재시도를 재현합니다. Redis 버전과 replication backlog·failover 설정에 따라 관찰 결과가 달라질 수 있으므로 실제 구성에서 확인합니다. 강한 보존이 필요하면 장애 도메인 배치·지속성·승격 정책·합의 저장소·원본 DB를 다시 비교하고, `WAIT`를 ‘손실 가능성을 낮추는 조건’ 이상으로 과장하지 않겠습니다.

확인 replica 수만 늘리는 것이 항상 강한 보장을 만드는 것도 아닙니다. 같은 호스트·랙·전원 도메인의 replica가 동시에 손실되면 숫자만으로 생존성을 설명할 수 없습니다. `WAIT`가 반환한 수와 실제 승격 노드의 replication offset, AOF·RDB 상태를 장애 시점별로 기록하겠습니다. 불확정 쓰기는 요청 ID와 결과 조회로 한 번만 확정하고, 복구 뒤 원장과 대조해 누락·중복을 보정할 수 있어야 합니다.

## 득점 포인트

- 복제 ACK·디스크 기록·승격 선택을 별도 보장으로 구분한다.
- WAIT timeout을 불확정 결과로 다뤄 중복 재시도를 막는다.
- 장애 도메인·지속성·멱등성을 함께 검증한다.

## 감점 포인트

- WAIT 성공이면 모든 장애에서 무손실이라고 말한다.
- WAIT 실패가 primary의 원래 쓰기를 롤백한다고 한다.
- timeout 뒤 증분 쓰기를 무조건 재전송해도 안전하다고 한다.

## 더 파고들 거리

- WAITAOF와 WAIT가 확인하는 내구 지점을 비교해 보세요.
- 복제 지연·확인 replica 수·장애 도메인의 교환을 정해 보세요.
- 승격 뒤 오래된 커넥션과 결과 조회 경로를 검증해 보세요.
