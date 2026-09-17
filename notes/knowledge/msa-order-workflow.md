---
id: msa-order-workflow
title: 마이크로서비스 주문 처리
topic: 설계
summary: 주문·재고·결제·배송을 서비스별 로컬 확정과 사가 상태로 연결하고 중복·응답 유실·보상 실패를 실제 순서로 다룹니다.
questionIds: []
prerequisites: [msa-foundations, transactions]
related: [consumer-inbox, idempotency, event-contracts, retry-circuit, messaging-ownership]
reviewedAt: '2026-09-17'
---

# 마이크로서비스 주문 처리

## 주문 완료와 전체 성공

서비스가 분리된 주문 처리는 “네 번의 API를 순서대로 호출하면 끝난다”는 문제가 아닙니다. 주문·재고·결제·배송은 각자 원본 데이터와 로컬 트랜잭션을 소유하고, 전체 흐름은 그 사이의 진행과 실패를 기록하는 업무 workflow입니다. 한 단계의 커밋은 그 서비스의 사실을 확정하지만 전체 주문의 완료를 자동으로 확정하지는 않습니다.

이런 여러 로컬 트랜잭션을 하나의 업무 흐름으로 묶고, 뒤 단계가 실패했을 때 앞 단계에 의미 있는 반대 동작을 요청하는 패턴을 **사가**(saga)라고 부릅니다. 사가는 ACID 트랜잭션의 rollback을 여러 데이터베이스에 복사한 기능이 아닙니다. 이미 외부에서 관찰된 승인·예약·배송을 정확히 없앨 수 없는 경우가 있으므로, 보상과 대사 상태까지 함께 설계해야 합니다.

예제 주문은 `o-17`, 재고 예약은 `H-7`, 결제 승인은 `P-3`, 배송 요청은 `S-2`로 고정하겠습니다. 이 ID들은 재시도에도 유지되는 업무 식별자입니다. 사용자가 결제 버튼을 여러 번 눌러도 새 workflow를 만들지 않고 같은 주문과 같은 단계 결과를 조회할 수 있어야 합니다.

## 서비스별 권위와 단계 계약

| 서비스 | 원본 데이터 | 명령 | 성공 사실 | 실패·복구 담당 |
| --- | --- | --- | --- | --- |
| Order | 주문 상태·금액·통화 | `accept(o-17)` | 주문 수락 | 주문 상태·사용자 안내 |
| Inventory | 재고 수량·hold 세대 | `hold(o-17,H-7)` | 재고 확보 | hold 만료·해제 |
| Payment | 승인·환불 기록 | `authorize(o-17,P-3)` | 승인 확정 또는 확인 필요 | 상태 조회·void/refund |
| Shipping | 배송 생성 기록 | `create(o-17,S-2)` | 배송 생성 | 중복 조회·재시도 |

OrderService가 Inventory DB를 직접 읽지 않도록 합니다. 재고 가능 여부는 `hold` 명령의 결과로 확정하고, 화면용 검색 projection은 업무 권위가 아니라 파생 표현으로 둡니다. Payment 응답이 timeout이면 `실패`가 아니라 `UNKNOWN`일 수 있습니다. provider가 요청을 받았지만 응답만 잃었을 가능성이 있기 때문입니다.

각 명령 계약에는 안정 ID, 기대 상태 또는 세대, deadline, 오류 분류, 결과 조회 방법을 포함합니다. 예를 들면 `hold(o-17, H-7, generation=7)`은 “현재 hold가 아직 이 주문에 속하는지”를 확인하는 조건을 가질 수 있습니다. 늦은 요청이 새 사용자에게 재할당된 자원을 확정하지 못하게 하는 경계입니다.

## 사가 진행 상태

사가 실행자는 중앙 조정자일 수도 있고, 이벤트 구독으로 각 서비스가 반응하는 방식일 수도 있습니다. 여기서는 전체 순서와 보상 정책을 한 곳에서 확인하기 쉬운 중앙 조정자를 사용합니다. 조정자는 자기 상태를 별도 내구 저장소에 기록하거나, 조정 서비스가 소유한 workflow 원장에 기록합니다. 메모리의 현재 단계만으로는 재시작 뒤 이어갈 수 없습니다.

```diagram
{"title":"주문 사가의 진행과 보상","caption":"각 화살표는 별도 서비스의 로컬 확정입니다. 배송 생성이 실패하면 이미 확정된 결제와 재고에 의미적 보상을 시도하지만, 모든 외부 효과가 과거로 되돌아간다는 뜻은 아닙니다.","rows":[[{"id":"order","label":"주문 수락","detail":["o-17"]}],[{"id":"hold","label":"재고 hold","detail":["H-7 / generation 7"]}],[{"id":"pay","label":"결제 승인","detail":["P-3"]}],[{"id":"ship","label":"배송 생성","detail":["S-2"]}],[{"id":"comp","label":"보상·대사","detail":["환불·hold 해제·검토"]}]],"edges":[{"from":"order","to":"hold","label":"다음 단계"},{"from":"hold","to":"pay","label":"hold 확정"},{"from":"pay","to":"ship","label":"승인 확정"},{"from":"ship","to":"comp","label":"실패 시 보상 경로"},{"from":"pay","to":"comp","label":"배송 실패"},{"from":"hold","to":"comp","label":"배송 실패"}]}
```

상태는 최소한 `ACCEPTED`, `INVENTORY_HELD`, `PAYMENT_AUTHORIZED`, `SHIPPING_CREATED`, `COMPENSATING`, `NEEDS_REVIEW`, `COMPLETED`, `CANCELLED`를 구분합니다. `PAYMENT_UNKNOWN`처럼 외부 결과가 확인되지 않은 상태도 필요합니다. `FAILED` 하나로 합치면 결제 미실행, 결제 승인 후 배송 실패, 보상 실패를 같은 의미로 오해하게 됩니다.

| 단계 | workflow 상태 | 서비스 사실 | 다음 판단 |
| --- | --- | --- | --- |
| t0 | `NEW` | 주문 없음 | 주문 수락 실행 |
| t1 | `ACCEPTED` | 주문 v1 확정 | `H-7`로 hold 실행 |
| t2 | `INVENTORY_HELD` | hold 세대 7 확정 | `P-3` 승인 실행 |
| t3 | `PAYMENT_AUTHORIZED` | provider 승인 ID 저장 | `S-2` 배송 실행 |
| t4 | `SHIPPING_CREATED` | 배송 ID 저장 | `COMPLETED` |

각 행의 “서비스 사실”은 해당 서비스가 자기 DB에 커밋한 결과입니다. 조정자가 `t3`을 기록했다고 Payment DB가 승인된 것은 아닙니다. 반대로 Payment가 승인됐는데 조정자 응답이 끊겼다면 Payment 조회로 사실을 복원하고 같은 단계 ID를 계속 사용해야 합니다.

## 정상 실행의 실제 순서

`t0`에서 OrderService는 고객 권한·가격·주문 중복 여부를 확인하고 `o-17`을 `ACCEPTED`로 바꿉니다. 주문 변경과 다음 단계 시작 의도는 같은 로컬 DB에 outbox로 남길 수 있습니다. 이 기록은 조정자나 이벤트 전달자가 재시작 뒤 작업을 이어갈 수 있게 합니다.

`t1`에서 InventoryService는 `H-7`을 생성하며 SKU-A의 `available=1, reserved=0`을 `available=0, reserved=1`로 바꿉니다. hold에는 만료 시각과 generation 7을 저장합니다. 동일 `H-7` 재수신은 기존 결과를 돌려주고, 다른 주문이 이미 수량을 차지했으면 `INSUFFICIENT_STOCK`를 확정합니다.

`t2`에서 PaymentService는 `P-3`으로 승인을 요청합니다. provider가 `AUTHORIZED`를 응답하면 Payment DB에 승인 ID와 금액·통화를 기록하고 `PAYMENT_AUTHORIZED`를 알립니다. 이때 승인 사실을 주문 서비스가 추정하지 않고 Payment의 원본 결과를 사용합니다.

`t3`에서 ShippingService는 `S-2`로 배송을 생성합니다. timeout이면 새 `S-3`을 만들지 않고 provider 조회나 Shipping DB의 요청 원장을 먼저 확인합니다. 배송 생성이 확인되면 주문은 `COMPLETED`가 됩니다. 최종 상태를 쓰는 명령도 같은 workflow ID를 사용해 중복 완료 event를 막습니다.

## 실패와 보상의 의미

배송이 영구적으로 거절되면 조정자는 먼저 배송 요청의 불확정 여부를 확인합니다. 실제 배송이 생성되지 않았다는 증거가 있을 때만 `P-3`의 결제 void/refund와 `H-7`의 hold 해제를 역순으로 시도합니다. 보상은 원래 잔액을 과거 값으로 덮어쓰는 작업이 아니라, 해당 승인과 hold ID를 대상으로 하는 별도 업무 효과입니다.

| 상황 | 사용자 상태 | 조정자 행동 | 운영 상태 |
| --- | --- | --- | --- |
| 재고 부족 | 주문 거절 | 결제 단계 시작 안 함 | `CANCELLED` |
| 결제 명시 거절 | 결제 실패 | `H-7` 해제 | `CANCELLED` |
| 결제 timeout | 처리 중 | `P-3` 조회 후 판단 | `PAYMENT_UNKNOWN` |
| 배송 일시 오류 | 처리 중 | 제한된 `S-2` 재시도 | `SHIPPING_PENDING` |
| 배송 영구 실패 | 취소·환불 중 | 배송 확인 후 보상 | `COMPENSATING` |
| 환불 실패 | 운영 확인 필요 | 재시도·수동 승인 | `NEEDS_REVIEW` |

보상 자체도 멱등이어야 합니다. `refund-P-3`이라는 안정 ID로 한 번만 환불 효과를 확정하고, timeout 뒤 같은 ID의 상태를 조회합니다. 환불이 실패했다고 Payment 원장에 이미 성공한 환불을 다시 기록하지 않습니다. 보상 대기 상태는 사용자가 보는 “환불 처리 중”과 운영자가 해결할 책임을 연결합니다.

AWS Prescriptive Guidance가 설명하는 사가 모델에서는 여러 로컬 트랜잭션 사이에 하나의 ACID 트랜잭션 격리가 제공되지 않습니다. 결제가 승인된 상태를 다른 요청이 볼 수 있고, 그 사이 사용자가 주문 취소를 요청할 수 있습니다. 취소와 보상이 경쟁할 때는 주문 버전·단계 세대·업무 상태를 조건으로 원자 전이를 수행하고, 이미 실행된 외부 효과는 별도 대사로 남깁니다.

## 만료와 늦은 결과

`t2`에서 재고 hold H-7이 만료된 뒤 다른 주문에 수량이 재할당됐다고 합시다. 늦게 도착한 결제 성공 응답만 보고 o-17을 `CONFIRMED`로 바꾸면 초과 판매가 됩니다. Payment의 승인은 사실로 인정하되, 현재 Inventory의 hold ID와 generation 7이 아직 유효한지 조건부로 확인합니다.

| 입력 | 현재 재고 상태 | 허용 전이 | 결과 |
| --- | --- | --- | --- |
| hold H-7 결제 성공 | generation 7, held | `held→confirmed` | 주문 진행 |
| hold H-7 결제 성공 | expired, generation 8 | 없음 | `payment_succeeded_but_hold_lost` |
| hold H-7 만료 작업 | 이미 confirmed | 만료 거절 | 결제·재고 유지 |
| 취소 요청 | 보상 중 | 조건부 취소 | workflow 버전 증가 |

`payment_succeeded_but_hold_lost`는 실패를 숨기는 임시 문자열이 아니라 후속 정책의 입력입니다. 승인 상태를 조회하고, 멱등 환불을 실행하거나 새 재고 예약을 제안하거나, 금액·배송 약속에 따라 운영자 확인으로 보냅니다. 원래의 재고 행을 과거 값으로 복원하면 generation 8의 정상 할당을 덮어쓸 수 있으므로 금지합니다.

## 구현 순서와 재처리

구현은 업무 상태부터 시작합니다. 먼저 각 서비스의 원본 데이터와 local transaction을 작성하고, 단계마다 안정적인 명령 ID·event ID·aggregate version을 저장합니다. 그 뒤 조정자 상태, outbox 전달, consumer inbox, 보상 원장을 연결합니다. outbox는 변경과 전달 의도를 함께 기록하지만, consumer의 효과 중복까지 자동으로 막지는 않습니다.

소비자는 `event_id`만으로 모든 중복을 판단하지 않을 수 있습니다. 같은 workflow의 결제 승인과 환불은 서로 다른 event이지만 Payment 업무 원장에서는 `P-3`과 `refund-P-3`의 관계를 함께 검사해야 합니다. inbox 처리 마커와 실제 원장 효과를 같은 데이터베이스 트랜잭션에 넣고 커밋 후 ACK를 보냅니다. ACK 직전에 중단되면 같은 event가 다시 와도 기존 결과를 반환합니다.

조정자가 재시작하면 “마지막 메모리 단계”가 아니라 내구 상태를 읽습니다. `PAYMENT_UNKNOWN`이면 성공으로 진행하거나 보상하지 말고 provider 조회 정책을 먼저 실행합니다. 각 단계의 timeout은 전체 deadline 안에서 계산하며, 자동 재시도 가능한 오류와 영구 업무 거절을 구분합니다. 재시도 횟수를 늘리는 것이 불확정 외부 효과를 해결하지는 않습니다.

## 운영과 진단

운영자는 최종 주문 수만 보지 않고 단계별 적체를 봅니다. `INVENTORY_HELD`가 오래된 주문 수, `PAYMENT_UNKNOWN`의 최대 나이, 보상 대기 수, hold 만료 후 결제 성공 수, workflow별 마지막 시도와 담당자를 별도로 집계합니다. 결제 provider timeout이 늘었을 때 결제가 실제로 몇 번 시도됐는지와 원장상 승인 수를 나누어야 중복 효과를 발견할 수 있습니다.

장애 대응 순서는 논리 ID `o-17`에서 시작합니다. trace와 workflow 원장을 따라 Order v1, H-7 generation 7, P-3 승인 결과, S-2 요청 결과를 대조합니다. `P-3`이 승인됐지만 Shipping이 `UNKNOWN`이면 배송 조회를 먼저 하고, 실제 배송이 없다면 refund를 실행합니다. 이미 배송된 뒤 refund만 실행하는 것은 보상이 아니라 또 다른 업무 오류입니다.

검증은 정상 완료만으로 충분하지 않습니다. 재고 부족, 결제 명시 거절, 결제 timeout, coordinator 재시작, participant 중복 호출, 배송 응답 유실, 보상 실패, hold 만료와 늦은 결제, 취소와 보상 경쟁을 각각 재현합니다. 확인 항목은 최종 상태뿐 아니라 중간 사용자 상태, 실제 결제·재고 효과 수, 보상 ID, 대사 상태입니다.

## 참고 자료와 검증 범위

- [Saga orchestration pattern - AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-orchestration.html) — 2026-09-17 확인. 페이지 버전·날짜가 확인되지 않은 버전 중립적 패턴 지침으로 취급했습니다. 중앙 조정자, eventual consistency, 멱등성, 격리 부재, 완료 단계의 보상 시도 주장을 사용했습니다. Step Functions 예시는 AWS 제품 범위로 한정해야 하므로 본문은 일반 조정자 개념만 사용했습니다.
- [Saga choreography pattern - AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-choreography.html) — 2026-09-17 확인. 페이지 버전·날짜가 확인되지 않은 버전 중립적 패턴 지침입니다. 이벤트 구독 기반 조정과 참가자 증가 시 상호작용·관측 비용 주장을 사용했습니다.
- [Transactional outbox pattern - AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) — 2026-09-17 확인. 페이지 버전·날짜가 확인되지 않은 버전 중립적 패턴 지침입니다. 로컬 DB 변경과 outbox 기록의 같은 트랜잭션, 소비자 중복 허용 주장을 사용했습니다.
- 본문은 실제 결제 제공자, 브로커, 재고 시스템, 조정자를 실행한 결과가 아닙니다. ID·상태·수치는 worked example이며, 검증 항목은 실행 결과가 아니라 제안된 시험 순서입니다. 특정 결제사나 메시지 브로커의 현재 재전달 계약은 이 글의 범위에 포함하지 않았습니다.
