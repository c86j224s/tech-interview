---
id: distributed-commit
title: 2PC의 In-doubt와 Saga의 의미적 보상
topic: 분산 시스템
summary: prepare·내구 결정·복구 대기를 설명하고 별도 로컬 commit·보상 실패·조정 방식·예약 만료와 늦은 결제의 원자 전이를 비교합니다.
questionIds: [db-two-phase-commit, saga-compensation, saga-orchestration-choreography, reservation-hold-confirm-race]
---

# 2PC의 In-doubt와 Saga의 의미적 보상

## 이미 커밋된 결제를 로컬 Rollback으로 지울 수는 없습니다

재고 예약과 결제가 각 서비스에서 커밋됐는데 배송 생성이 실패했습니다. 하나의 DB 거래였다면 미확정 변경을 rollback할 수 있지만 별도 시스템의 성공은 이미 외부에서 관찰됐습니다. 원자적 분산 commit을 요구할지, 중간 commit과 의미적 보상을 허용할지 명확히 선택해야 합니다.

2PC와 saga는 이름이 다른 같은 보장이 아닙니다. 참여자·장애 복구·잠금·중간 상태·보상 가능성의 비용이 다릅니다.

## 2PC의 Prepare는 최종 결정을 기다릴 약속입니다

참여자는 prepare에서 commit할 준비를 내구 기록하고 필요한 자원을 유지한 뒤 yes를 응답합니다. 조정자는 모든 필요한 yes를 얻어 commit 결정 또는 abort 결정을 내구 기록하고 전달합니다. 동일 transaction ID로 재전달해도 같은 결정을 적용해야 합니다.

| 시점 | 참여자 상태 | 임의로 해서는 안 되는 것 |
| --- | --- | --- |
| prepare 전 | 로컬 작업·투표 준비 | 최종 성공으로 응답 |
| prepared yes 뒤 | 결정 대기·자원 보유 | timeout만 보고 독자 abort |
| coordinator commit 내구 기록 | 최종 결정 존재 | 다른 참가자에 abort 선택 |
| 일부 participant commit | 나머지는 in-doubt일 수 있음 | 응답 유실을 미결정으로 단정 |

A만 commit 결정을 받고 B는 못 받았을 때 B가 timeout으로 abort하면 전체 원자성이 깨집니다. coordinator 로그·participant 복구 프로토콜로 결정을 알아야 합니다. in-doubt 동안 lock·버전·자원이 남아 다른 거래를 막을 수 있습니다. heuristic 강제 결정을 지원하는 제품도 그것이 불일치·대사를 요구할 수 있음을 명시해야 합니다.

```diagram
{"title":"Prepare 뒤에는 내구 최종 결정을 복구해야 합니다","caption":"화살표는 2PC의 두 단계입니다. coordinator가 중단되면 prepared 참여자는 자기 timeout만으로 반대 결정을 내려서는 안 됩니다.","rows":[[{"id":"coord","label":"Coordinator prepare 요청"}],[{"id":"a","label":"DB A prepared·yes"},{"id":"b","label":"DB B prepared·yes"}],[{"id":"decision","label":"최종 commit 결정 내구 기록"}],[{"id":"apply","label":"모든 참여자에 결정 재전달"}]],"edges":[{"from":"coord","to":"a","label":"준비 요청"},{"from":"coord","to":"b","label":"준비 요청"},{"from":"a","to":"decision","label":"내구 yes"},{"from":"b","to":"decision","label":"내구 yes"},{"from":"decision","to":"apply","label":"commit·복구 재시도"}]}
```

합의로 coordinator를 복제하면 결정 가용성을 개선할 수 있지만 2PC 참여자의 prepare·원자 commit 의미와 합의 로그의 역할은 구분합니다. 두 DB를 하나의 로컬 거래 경계로 합칠 수 있는지도 먼저 검토합니다.

## Saga는 이미 확정한 효과를 새 변경으로 상쇄합니다

예약→결제→배송에서 배송이 영구 실패하면 예약 해제·결제 취소를 수행할 수 있습니다. 원래 잔액을 과거 값으로 SET하면 그 뒤 다른 정상 거래를 지우므로 해당 승인·예약 ID의 효과만 취소해야 합니다. 이미 전송한 메일·취소 수수료·배송된 물건은 단순 역연산으로 사라지지 않습니다.

일시 배송 장애라면 제한된 재시도가 보상보다 맞을 수 있습니다. 응답 유실이면 배송이 이미 생성됐을 수 있어 먼저 같은 요청 ID로 조회합니다. 불확정 성공에 바로 환불을 시작하면 실제 배송과 취소가 겹칠 수 있습니다.

## 진행·보상·수동 복구를 내구 상태로 관리합니다

각 단계의 입력·멱등 키·결과·다음 시도·기한·보상 가능 조건을 기록합니다. compensation도 별도의 안정 ID로 한 번의 환불 효과를 유지하고 실패하면 cancelling·needs_review 같은 실제 상태를 남깁니다. 사용자가 볼 상태와 운영자가 해결할 미완료 책임을 연결합니다.

중앙 orchestration은 전체 단계·보상 추적이 직접적이지만 coordinator 상태·가용성·정책 결합을 관리해야 합니다. choreography는 서비스별 이벤트 반응으로 나누지만 숨은 순환·전체 진행·오류 소유자를 놓치기 쉽습니다. 어느 방식이든 outbox·inbox·correlation ID·정체 경보·복구 절차가 필요합니다.

## 예약 만료와 늦은 결제는 같은 전이 경계에서 경합합니다

좌석 hold H, generation=7이 만료되어 다른 사용자에게 재할당됐는데 H의 결제 성공이 늦게 도착할 수 있습니다. 현재 상태·hold ID·generation·권위 기한을 조건으로 held→confirmed와 held→expired 중 허용 전이를 원자적으로 결정합니다. timer가 늦게 실행됐어도 confirm 시 실제 기한을 검사합니다.

이미 expired·재할당된 좌석을 늦은 결제만 보고 confirmed로 바꾸면 초과 판매입니다. payment_succeeded_but_hold_lost 같은 조정 상태로 두고 멱등 환불·새 예약 제안·수동 확인을 정책과 승인 범위에 맞춰 수행합니다. 원래 계정의 최신 상태를 과거 값으로 복원하지 않습니다.

## 중간 상태의 격리는 별도 설계입니다

saga에서는 결제됐지만 배송 전인 상태가 다른 요청에 보일 수 있습니다. 취소 중 주문의 추가 변경 제한·예약 권리·만료·소유 세대 같은 의미적 잠금을 둘 수 있지만 영구 보류가 되지 않도록 복구 기한을 둡니다. saga를 단일 ACID transaction과 같은 격리라고 말하지 않습니다.

테스트는 prepare 이후 coordinator 손실, 일부 commit, 단계 성공 뒤 응답 유실, 보상 실패, 정상 배송과 취소 경쟁, hold 만료와 늦은 결제를 나눕니다. 현재 작업에서는 두 DB의 2PC나 실제 결제 보상을 실행하지 않았습니다. 본문은 확정과 보상의 설계 비교입니다.
