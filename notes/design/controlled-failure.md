---
id: controlled-failure
title: 결정적 경쟁·가상 시간·실패 주입의 경계
topic: 설계
summary: barrier와 완료 신호로 재고/취소 경쟁을 만들고 clock/scheduler·fake/real 저장 계약·응답 유실·pause/종료/분할의 차이를 설명합니다.
questionIds: [deterministic-concurrency-testing, virtual-clock-timeout-testing, fault-injection-seam-design, fake-real-repository-contract-tests, network-partition-versus-process-pause]
---

# 결정적 경쟁·가상 시간·실패 주입의 경계

## 재고 차감 경쟁과 요청별 성공 원장의 일관성

재고가 1일 때 A와 B가 각각 1을 읽고 0을 저장하도록 허용하면 최종 재고는 비음수여도 판매 성공이 두 건으로 기록될 수 있습니다. 임의의 sleep 대신 두 읽기가 끝난 지점에 barrier(두 요청을 잠시 모아 두는 동기화 지점)를 두고, 두 요청이 모두 도착한 뒤 어느 쓰기를 먼저 통과시킬지 제어합니다. 그 뒤 최종 재고, 조건부 `UPDATE`의 영향 행 수, 성공 요청 수, 판매 원장, version을 함께 대조해 한 재고로 두 효과가 생겼는지 확인합니다.

임의 sleep은 scheduler가 달라지면 순서를 보장하지 않습니다. 읽기·쓰기·commit·응답 전달처럼 의미 있는 경계의 신호로 순서를 재현하고 요청 ID·입력·관측값·스케줄·seed를 남깁니다. 제어 훅이 lock 안에서 영원히 기다리지 않도록 실제 watchdog도 둡니다.

```diagram
{"title":"같은 재고를 읽는 경쟁을 의도적으로 만듭니다","caption":"화살표는 테스트가 통제한 선후 관계입니다. 두 성공과 최종 값뿐 아니라 원장까지 대조해 lost update를 검출합니다.","rows":[[{"id":"a","label":"A · stock=1 읽음"},{"id":"b","label":"B · stock=1 읽음"}],[{"id":"barrier","label":"둘 다 읽은 지점의 barrier"}],[{"id":"write","label":"정한 순서로 조건부 쓰기 허용"}],[{"id":"assert","label":"성공 수·재고·version·원장 검사"}]],"edges":[{"from":"a","to":"barrier","label":"읽기 완료"},{"from":"b","to":"barrier","label":"읽기 완료"},{"from":"barrier","to":"write","label":"스케줄 제어"},{"from":"write","to":"assert","label":"업무 불변식"}]}
```

## 가상 Clock과 Timer 실행의 분리 제어

테스트 시계의 `clock.now`만 미래로 바꿔도 등록된 timer의 callback이 자동으로 실행되지는 않습니다. 시각 조회, timer 등록, scheduler의 실행 queue를 각각 주입한 뒤 테스트가 시간을 전진시키고, queue에서 어떤 callback을 먼저 꺼낼지 정해야 합니다. 그래서 deadline(제한 시각) 직전 완료→timeout(시간 초과), timeout→늦은 완료, 같은 시각에 도착한 두 callback의 순서를 각각 재현해 검사합니다.

반복 대기마다 전체 timeout을 새로 부여하지 않고 처음 deadline의 남은 시간을 사용합니다. 사용자 결과는 한 번만 확정하되 늦은 외부 성공 사실은 감사/대사 기록에 남깁니다. 가상 시계는 실제 DB·thread·network를 멈추지 않으므로 실제 adapter 시험은 별도입니다.

## 외부 효과 경계와 실패 주입 지점

실패를 넣을 위치는 내부 변수 하나가 아니라 network·저장소·clock·scheduler adapter처럼 외부 효과가 드나드는 경계로 잡습니다. 각 경계에서 commit 전 실패, commit 후 응답 유실, 소유권 전환을 차례로 주입하면 저장은 됐지만 응답만 사라진 경우와 저장 자체가 안 된 경우를 나눠 볼 수 있습니다. 모든 private 변수에 test flag를 달면 구현에 과결합하므로, production 기본 경로는 정상 동작하게 두고 외부 요청이 실패 주입 옵션을 켤 수 없게 막습니다.

| 저장소 공통 계약 | 확인할 결과 |
| --- | --- |
| 조건부 생성 | 하나만 생성·다른 요청은 중복 |
| 같은 key·다른 payload | 충돌·기존 결과 임의 재사용 금지 |
| expected version mismatch | 변경 없음·명확한 충돌 |
| transaction 실패 | 부분 상태·처리 기록 잔존 없음 |
| 미존재·인가 실패 | 계약된 결과·정보 최소화 |
| 응답 유실 | 미실행으로 단정하지 않음 |

fake는 정책 분기를 빠르게 확인하는 데 쓰고, real DB는 고유 제약, lock, 격리 수준, 연결 실패처럼 저장소가 실제로 조정하는 부분을 확인하는 데 씁니다. 단일 thread의 map fake는 두 요청이 동시에 들어오는 경쟁을 만들지 않아 실제 DB보다 강한 것처럼 보일 수 있습니다. 따라서 `exists`를 읽고 `insert`하는 두 단계가 경쟁을 허용한다면, port(저장소가 제공하는 계약)를 원자적 생성 한 번으로 바꾼 뒤 fake와 real DB에 같은 계약 test를 적용합니다.

## 종료·Pause·Partition·disk stall의 실패 의미

process 종료는 메모리 상태·연결을 잃고, pause는 옛 권한·입력을 가진 채 나중에 깨어납니다. partition은 노드마다 서로 다른 생존 관측을 만들며 한 방향만 통하거나 응답만 유실될 수도 있습니다. disk stall도 network 단절과 다릅니다.

heartbeat timeout은 죽음의 증거가 아닙니다. 새 owner 선출 뒤 옛 worker가 깨어났을 때 실제 저장 경계의 fencing·idempotency가 작동하는지 봅니다. 허가된 격리 환경에서만 주입하고 호출/응답·term/세대·외부 원장을 대조합니다.

## 결정적 회귀와 스케줄 탐색의 결합

race detector는 보호 없는 메모리 접근에 유용하지만 모두 atomic인 잘못된 check-then-act 업무를 모두 잡지 못합니다. 결정적 반례 뒤 stress·다양한 지연을 더하고 이력 검증에는 불확정 timeout 연산을 포함합니다. 통과는 모든 스케줄의 증명이 아닙니다. 이 노트는 실험 설계이며 실제 cluster에 장애를 주입한 결과는 아닙니다.
