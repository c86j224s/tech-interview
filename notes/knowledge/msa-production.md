---
id: msa-production
title: 마이크로서비스 배포와 장애 운영
topic: 설계
summary: 혼합 버전 배포와 점진적 스키마 전환을 연결하고 관측·재시도·격리·대사로 부분 장애를 운영합니다.
questionIds: []
prerequisites: [msa-foundations, msa-order-workflow, operations-foundations]
related: [migration-orchestration, schema-cutover, probe-contracts, retry-circuit, log-audit-budget]
reviewedAt: '2026-09-17'
---

# 마이크로서비스 배포와 장애 운영

## 운영 계약과 성공의 정의

마이크로서비스의 독립 배포는 새 이미지를 올리는 일로 끝나지 않습니다. 구버전과 신버전이 잠시 함께 요청을 처리하고, 데이터 스키마도 단계적으로 바뀌며, 메시지는 재전달될 수 있습니다. 그러므로 배포 성공은 “새 Pod가 생겼다”가 아니라 요청·이벤트·데이터가 혼합 버전 구간에서도 의미를 보존하고, 실패 시 이전 또는 보정 경로로 회복할 수 있다는 증거입니다.

장애 운영도 오류율 하나만으로는 부족합니다. 주문이 `PAYMENT_UNKNOWN`으로 멈췄는지, outbox가 오래 쌓였는지, 소비자가 같은 event를 반복 처리하는지, 재시도가 외부 provider를 더 압박하는지 구분해야 합니다. **관측 가능성**(observability)은 시스템 내부를 미리 모두 알지 못해도 외부에서 보이는 신호로 상태와 원인을 추론하는 능력입니다. trace는 한 요청의 경로, metric은 기간 동안 집계된 수치, log는 시각이 있는 사건 기록으로 역할이 다릅니다.

이 장에서는 주문 `o-17`을 배포·장애 운영의 공통 사례로 사용합니다. 원칙은 제품과 버전에 덜 묶인 내용으로 설명하고, Kubernetes와 PostgreSQL의 구체적 문서는 적용 버전을 따로 표시합니다.

## 혼합 버전과 스키마 전환

`orders.status`를 문자열에서 `status_code`로 바꾼다고 합시다. 구버전은 `status`만 읽고 쓰며, 신버전은 `status_code`를 읽으려 합니다. 먼저 컬럼을 추가하고, 구버전도 깨지지 않도록 호환 writer를 배포합니다. 그 다음 기존 행을 채우고, 신버전이 두 컬럼을 읽을 수 있게 한 뒤 쓰기 권위를 전환합니다. 모든 소비자가 새 경로로 이동한 후에야 옛 컬럼을 제거합니다.

| 단계 | 애플리케이션 | 데이터 | 중단·복구 의미 |
| --- | --- | --- | --- |
| 확장 | 구버전 유지 | 새 컬럼 추가 | 앱 rollback 가능 |
| 호환 쓰기 | 구·신 공존 | 양쪽 의미 일치 | 한쪽 쓰기 실패 대사 |
| 백필 | 구·신 공존 | 행별 조건·version 확인 | checkpoint부터 재개 |
| 읽기 전환 | 신버전 우선 | fallback 또는 새 값 | 결과 일치 확인 |
| 권위 전환 | 신 writer | 새 컬럼 단일 쓰기 | 구 writer 차단 |
| 축소 | 신버전만 | 옛 컬럼 제거 | 별도 승인·복구 |

양쪽에 동시에 쓰는 **dual write**는 두 저장소를 자동으로 원자화하지 않습니다. 같은 데이터베이스 안에서 두 컬럼을 같은 transaction에 쓰는지, 별도 서비스라면 outbox·대사로 부분 실패를 보이는지 구분해야 합니다. 백필이 끝났다는 hook 성공만으로 데이터가 맞다고 결론 내리지 않고, 대상 범위·행 version·누락·정상 쓰기 경합을 확인합니다.

Kubernetes 공식 문서의 Deployment 설명에 따르면 Deployment는 선언한 desired state를 향해 새 ReplicaSet과 옛 ReplicaSet을 조절하며 교체하는 컨트롤러입니다. 이 문장은 해당 문서의 개념 설명 범위입니다. 공식 문서가 설명하는 controlled replacement와 `kubectl rollout status` 명령 예시는 배포 상태를 관찰하는 방법을 보여 주지만, DB 호환성과 업무 완료를 대신하지 않습니다. 이 글에서 Kubernetes 동작은 확인된 문서 범위에서만 말하며, 실제 클러스터 실행 결과로 확대하지 않습니다.

## 배포 용량과 준비 상태

`replicas=4`, `maxSurge=1`, `maxUnavailable=1`인 경우, 이 설정이 허용하는 교체 경로에서는 목표보다 하나 많은 Pod가 생길 수 있고 Available 하한은 3개로 계산됩니다. 그러나 새 Pod가 Pending이면 객체 수는 늘어도 이 장에서 말하는 실제 처리 용량은 늘지 않습니다. 노드 자원, 연결 수, readiness, 초기화 시간, 종료 중인 옛 Pod를 함께 봐야 합니다.

단일 replica 서비스에서 `maxUnavailable=0`, surge 1을 사용해도 새 Pod를 배치할 노드나 quota가 없으면 교체가 멈춥니다. 새 코드가 DB를 읽을 준비가 안 되었는데 readiness가 너무 일찍 성공하면 요청이 실패할 수 있습니다. 반대로 readiness가 하위 provider 장애까지 그대로 반영하면 일시적 외부 장애가 모든 Pod의 endpoint를 제거할 수 있습니다. 준비 신호의 범위를 업무 계약과 함께 정합니다.

종료도 전체 예산 안에 넣습니다. 예를 들어 종료 유예가 30초인데 preStop이 20초를 쓰고 애플리케이션이 추가로 30초 drain을 기다리면 예산을 넘깁니다. 새 요청과 메시지 수신을 막고 기존 연결과 작업을 정리하되, 이미 시작된 외부 효과를 ACK만으로 끝냈다고 표시하지 않습니다. 장시간 작업은 checkpoint·재전달·멱등 효과로 이어지게 합니다.

```diagram
{"title":"배포와 스키마 준비의 별도 증거","caption":"앱 교체의 진행과 DB 데이터의 준비는 서로 다른 증거입니다. 한쪽이 성공해도 다른 쪽의 성공을 자동으로 뜻하지 않습니다.","rows":[[{"id":"schema","label":"호환 스키마 확장"}],[{"id":"mixed","label":"구·신 버전 공존"},{"id":"rollout","label":"Deployment 교체"}],[{"id":"verify","label":"행·계약·readiness 검증"}],[{"id":"switch","label":"읽기·쓰기 권위 전환"}],[{"id":"contract","label":"옛 경로 축소"}]],"edges":[{"from":"schema","to":"mixed","label":"구 코드 호환"},{"from":"rollout","to":"mixed","label":"혼합 구간"},{"from":"mixed","to":"verify","label":"실제 상태 대조"},{"from":"verify","to":"switch","label":"조건 충족"},{"from":"switch","to":"contract","label":"모든 소비자 전환"}]}
```

## 배포 순서와 Migration 소유권

공유 DB를 여러 서비스가 사용한다면 migration을 각 앱의 시작 hook에 넣고 동시에 실행하게 하지 않습니다. 단일 migration owner와 버전 원장을 두고, 앱과 배치·관리 도구·ETL·오래된 worker까지 모든 소비자를 조사합니다. DB 잠금이나 `IF NOT EXISTS`는 중복 실행을 줄이는 수단일 수 있지만, 기존 컬럼의 타입·제약·의미가 올바르다는 사실까지 증명하지는 않습니다.

대량 백필은 짧은 배포 hook이 한 번에 처리할 작업이 아닙니다. 처리 범위, 읽은 row version, checkpoint, 누락과 충돌 수를 내구적으로 기록하고 중단 뒤 재개합니다. 같은 행을 다시 읽을 수 있으므로 결과가 멱등인지, 조건부 update가 최신 정상 쓰기를 덮어쓰지 않는지 확인합니다. 백필 부하가 주문 요청의 DB 자원을 모두 차지하지 않도록 별도 상한을 둡니다.

hook이 DDL을 커밋한 뒤 네트워크 응답 전에 죽으면 다음 실행은 “실패했으므로 처음부터”라고 가정하지 않습니다. migration 원장과 실제 DB schema를 대조하고, 이미 완료된 단계는 재사용하며, 부분 변경은 보정 또는 수동 복구로 분류합니다. 앱 rollback도 데이터 rollback과 같지 않습니다. 신 컬럼을 이미 읽는 다른 서비스가 있으면 구 이미지로 돌아가더라도 호환 구조를 남겨야 합니다.

| 증거 | 확인하는 사실 | 확인하지 못하는 사실 |
| --- | --- | --- |
| hook 종료 코드 | 프로세스가 결과를 보고했는가 | 실제 schema와 행 전체의 정확성 |
| migration 원장 | 시작·완료 버전과 실행자 | 외부 로그가 없는 실행의 모든 세부 |
| schema 조회 | 컬럼·제약의 현재 구조 | 모든 앱이 의미를 올바르게 해석하는가 |
| backfill 대사 | 범위·누락·충돌 | 이후 요청이 계속 같은 규칙을 지키는가 |
| rollout status | Pod 교체 진행 | 결제·주문 업무 완료 |

## 장애 전파와 회복 제어

결제 provider가 느려져도 주문 조회와 로그인까지 같은 worker·HTTP 연결·DB 연결을 기다리게 하면 선택 기능의 장애가 핵심 기능으로 번집니다. 기능별 실행 자원과 연결 상한을 나누는 **벌크헤드 격리**(bulkhead isolation)는 이 전파 범위를 줄입니다. 하지만 공통 CPU·메모리·DB가 포화되면 풀을 나눈 것만으로 완전한 격리가 되지 않습니다.

재시도는 전체 deadline 안에서 한 계층이 주도해야 합니다. 예를 들어 API가 세 번 재시도하고 내부 worker도 세 번 재시도하면, 한 사용자 요청이 provider에 최대 9번 도달할 수 있습니다. 실제로 모든 시도가 독립적인지, 동일 업무 ID를 재사용하는지, provider가 timeout 뒤 요청을 받았는지 별도로 기록합니다. 지수 backoff와 **jitter**(재시도 시각에 작은 무작위 차이를 넣는 방식)는 동시 재시도 폭주를 줄이지만, 이미 승인된 결제의 결과를 확정해 주지는 않습니다.

**회로 차단기**(circuit breaker)는 지속적인 실패를 감지해 호출을 잠시 막고, 제한된 시험 호출로 회복을 판단하는 상태 기계입니다. `OPEN`에서 모든 요청을 통과시키지 않고, `HALF_OPEN`에서 여러 결제를 한꺼번에 실행하는 대신 부작용이 없는 상태 조회나 제한된 합성 확인을 선택합니다. 회로 상태 저장소가 고장 나더라도 로컬 동시성·deadline 상한을 유지하는 안전한 기본값이 필요합니다.

선택 기능은 짧은 deadline 뒤 캐시나 생략으로 점진적 기능 저하를 할 수 있습니다. 그러나 결제 승인을 확인하지 못했는데 성공으로 바꾸거나, 권한 조회 실패를 허용으로 처리하는 대체는 금지합니다. 실패 응답을 HTTP 200 안에 숨기면 전체 성공률이 왜곡되므로 선택 기능 누락률과 핵심 거래 성공률을 별도 집계합니다.

## 관측 신호와 장애 진단

주문 `o-17` 하나가 API→OrderService→outbox `evt-5`→Inventory→Payment provider로 흐른다고 합시다. trace는 이 요청이 지나간 span의 경로를 보여 주고, 각 시도는 `attempt_id`로 구분합니다. `trace_id`는 요청 경로, `workflow_id`는 주문 흐름, `event_id`는 전달된 사건, `attempt_id`는 특정 호출 시도를 나타내므로 같은 값을 모든 의미에 재사용하지 않습니다.

최소한 다음 신호를 함께 기록합니다.

| 신호 | 예시 | 의미 |
| --- | --- | --- |
| trace | `tr-9`의 API·서비스 span | 한 작업의 경로와 시간 |
| metric | Payment timeout count | 기간별 현상 규모 |
| log | `o-17`, `P-3`, 오류 분류 | 특정 사건의 원인 단서 |
| outbox age | 가장 오래된 pending 180초 | 전달 적체 |
| consumer lag | 마지막 적용 version | 파생 모델 지연 |
| business ledger | 승인 1회, refund 0회 | 실제 업무 효과 |

로그와 메시지 header에 correlation 정보를 전파하되 인증 토큰, 비밀번호, 카드 원문, 전체 개인정보를 복사하지 않습니다. 상관 ID는 호출을 연결하는 값이지 호출 권한을 증명하는 자격이 아닙니다. 로그를 많이 남기는 것보다 질문에 답할 필드를 안정된 구조로 남기는 것이 중요합니다.

장애 진단은 사용자 효과에서 시작합니다. `o-17`이 pending이라면 주문 상태 version, `evt-5` outbox age, Inventory hold generation, Payment `P-3` provider 결과, Shipping `S-2`의 확인 상태를 순서대로 대조합니다. Payment timeout이 곧 결제 미실행은 아니므로, 결과 조회 전에는 환불이나 재승인을 자동으로 단정하지 않습니다.

## 재처리와 대사

outbox의 `PENDING`과 consumer lag가 늘면 전달자와 소비자의 어느 경계가 막혔는지 나눕니다. 브로커에 이미 수락됐지만 `SENT` 표시 전에 Relay가 죽으면 같은 event가 다시 전달될 수 있습니다. 소비자는 inbox의 `event_id`와 실제 업무 effect key를 같은 로컬 트랜잭션에서 처리하고, 커밋 후 ACK합니다. 이 구조는 중복 전달을 흡수하지만 브로커와 결제 provider의 전체 exactly-once를 보장하지 않습니다.

DLQ나 quarantine은 완료 상태가 아닙니다. 원인 수정, payload·schema 확인, 영향 범위 대사, 제한된 replay, 중복 효과 검사 뒤에야 재처리합니다. 오래된 이벤트를 현재 주문 가격으로 다시 조립하면 과거 사실이 바뀌므로 event payload와 aggregate version을 보존합니다. replay는 projection 재구축에는 유용하지만 외부 결제·메일·배송 effect를 다시 실행하는 통로가 되어서는 안 됩니다.

대사는 서로 다른 원장을 비교하는 절차입니다. Payment 승인 원장에 `P-3`이 한 번 있고 Order에는 `PAYMENT_AUTHORIZED`가 없으면, 주문을 임의로 성공으로 고치지 않고 보정 workflow를 만듭니다. Inventory hold가 만료됐는데 Payment 승인만 남았다면 `payment_succeeded_but_hold_lost`를 운영 상태로 남기고 멱등 refund 또는 재예약 정책을 적용합니다.

```text
장애 입력: Payment timeout
1. o-17의 workflow 상태와 마지막 version 조회
2. P-3의 provider 결과 조회
3. 승인 확인이면 Order의 다음 단계 또는 refund 정책 선택
4. 승인 불명확이면 재승인 금지, 조회 재시도와 deadline 적용
5. hold generation이 유효한지 Inventory에 조건부 확인
6. 불일치면 needs_review와 담당자를 기록
7. 실제 원장 효과 수와 시도 수를 분리 집계
```

## 구현과 검증 순서

배포 파이프라인은 이미지 revision, schema version, migration 실행 ID, readiness 결과, rollout 관찰값을 연결합니다. PostgreSQL 18.6 문서 범위에서는 상수 기본값 컬럼 추가가 ALTER TABLE 실행 시 모든 행을 갱신하지 않을 수 있고, volatile 기본값은 행별 갱신을 요구할 수 있다고 설명되어 있습니다. 이 동작은 PostgreSQL 18.6 문서 범위의 주장으로만 사용하며, 다른 데이터베이스에 일반화하지 않습니다.

검증은 먼저 혼합 버전에서 시작합니다. 구 producer·신 consumer, 신 producer·구 consumer, 신 앱 rollback 뒤 구 앱과의 조합에서 상태 의미·null·단위·이벤트 payload를 확인합니다. 이어 DDL commit 뒤 연결 유실, 백필 중단과 재개, 정상 쓰기 경합, stale worker의 늦은 쓰기, readiness 실패, 긴 연결 drain을 나눠 시험합니다.

장애 시험에서는 Payment만 느리게 만들고 로그인과 주문 조회의 p99·성공률·연결 대기를 비교합니다. API와 worker의 재시도 상한을 곱해 실제 provider 호출 횟수를 계산하고, outbox age·DLQ age·in-flight·redelivery·projection lag와 업무 원장을 함께 봅니다. 이러한 시험은 설계상 검증 절차이며 이 저장소에서 실제 Kubernetes, PostgreSQL migration, OpenTelemetry collector, broker, provider 부하를 실행한 결과가 아닙니다.

운영의 완료 조건은 “알람이 꺼졌다”가 아니라 “사용자 상태·데이터 권위·복구 담당·미완료 효과가 설명된다”입니다. 일부 서비스만 rollback해도 이미 커밋한 외부 효과는 돌아오지 않으므로, 컨테이너 복귀와 데이터 복구·보상을 별도 사건으로 기록합니다. 독립 배포의 목적은 실패를 없애는 것이 아니라, 실패가 어느 경계를 넘었는지 알고 안전하게 멈추고 재개하는 것입니다.

## 참고 자료와 검증 범위

- [Deployments - Kubernetes](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) — 2026-09-17 확인. 문서 탐색 기준 Kubernetes v1.37, 예시는 `apps/v1`이며 Deployment의 desired state, controlled ReplicaSet replacement, `kubectl rollout status`, rollback 개념만 적용 버전 범위로 사용했습니다. 실제 클러스터 rollout은 실행하지 않았습니다.
- [PostgreSQL: Documentation: 18: 5.7. Modifying Tables](https://www.postgresql.org/docs/18/ddl-alter.html) — 2026-09-17 확인. PostgreSQL 18 문서이며 탐색상 PostgreSQL 18.6입니다. 상수·volatile default와 기존 행·미래 insert 의미만 PostgreSQL 18 범위로 사용했고, lock-free나 다른 DB 일반 주장은 하지 않았습니다.
- [Observability primer - OpenTelemetry](https://opentelemetry.io/docs/concepts/observability-primer/) — 2026-09-17 확인. 버전과 갱신일이 응답에 노출되지 않은 개념 문서로 취급했습니다. trace·metric·log의 역할만 사용했으며, literal context propagation 정의나 실제 collector 동작을 주장하지 않았습니다.
- [Saga orchestration pattern - AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-orchestration.html) — 2026-09-17 확인. 페이지 버전·날짜가 확인되지 않은 버전 중립적 패턴 지침입니다. 보상·멱등·eventual consistency·격리 부재를 장애 운영의 개념 근거로 사용했습니다.
- 본문은 실제 배포·마이그레이션·브로커·관측 수집기·결제 provider 부하를 실행하지 않았습니다. 수치와 상태는 설명용 worked example 또는 산술이며, 검증 절차를 실행 증거로 표현하지 않았습니다.
