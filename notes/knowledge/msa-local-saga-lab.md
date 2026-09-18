---
id: msa-local-saga-lab
title: 로컬 다중 프로세스 주문 사가 실습
topic: 설계
summary: 서비스별 SQLite 원장과 안정적인 명령·효과 ID를 사용해 주문·재고·모의 결제·배송 사가의 응답 유실, 재시작 대사와 보상을 재현합니다.
questionIds: []
prerequisites: [msa-foundations, msa-order-workflow, transactional-outbox, consumer-inbox, idempotency, distributed-commit]
related: [database-models, retry-circuit, event-contracts, model-ownership]
reviewedAt: '2026-09-18'
---

# 로컬 다중 프로세스 주문 사가 실습

## 서비스 경계와 로컬 거래

사가에서는 여러 서비스의 변경을 하나의 데이터베이스 롤백으로 되돌릴 수 없습니다. 주문을 접수하고 재고를 예약한 뒤 결제를 승인했다면, 배송 거절은 결제 승인 사실을 지우지 않습니다. 환불과 재고 해제라는 새로운 업무를 실행하고 그 결과도 기록해야 합니다.

이 실습은 Order·Inventory·Payment·Shipping을 독립 Python 프로세스로 실행합니다. 각 서비스는 자신의 SQLite 파일만 변경하고, Coordinator는 loopback HTTP로 명령을 보냅니다. 각 로컬 거래는 짧은 `BEGIN IMMEDIATE` 안에서 명령 결과·업무 효과·outbox를 함께 확정합니다. 서비스는 단일 요청 처리 서버이므로 SQLite 연결을 여러 스레드가 동시에 사용하지 않습니다.

```diagram
{"title":"주문 사가와 불확정 결제","caption":"응답 유실은 실패 확정이 아닙니다. 같은 결제 키로 원장을 조회한 뒤 진행하거나 보상합니다.","rows":[[{"id":"order","label":"주문 접수","detail":["안정적인 주문 ID"]}],[{"id":"hold","label":"재고 예약","detail":["hold:o-17"]}],[{"id":"payment","label":"결제 승인·조회","detail":["payment:o-17","UNKNOWN 대사"]}],[{"id":"shipping","label":"배송 생성","detail":["성공 → COMPLETED"]},{"id":"compensate","label":"환불·재고 해제","detail":["영구 거절 → 보상","완료 → CANCELLED"]}]],"edges":[{"from":"order","to":"hold","label":"명령"},{"from":"hold","to":"payment","label":"HELD"},{"from":"payment","to":"shipping","label":"AUTHORIZED"},{"from":"shipping","to":"compensate","label":"PERMANENT_FAILURE"}]}
```

## 식별자와 중복 처리

`command_id`는 명령 요청을, `effect_id`는 업무 효과를 식별합니다. 같은 명령 ID와 같은 요청은 저장한 결과를 반환하지만, 같은 ID로 금액을 바꾸면 충돌로 거절합니다. 결제 효과에는 `payment:o-17`, 환불에는 `refund:payment:o-17`을 사용합니다. 응답을 받지 못했다는 이유로 새 결제 키를 만들지 않습니다.

| 저장소 | 기록 내용 | 재시작 뒤의 용도 |
| --- | --- | --- |
| `commands` | 정규화한 요청과 결과 | 동일 명령 재전송 처리 |
| `effects` | 업무 효과와 상태 | 중복 승인·배송·해제 방지 |
| `provider_ledger` | 모의 결제 키·금액·통화·승인 번호 | 결제 결과 대사 |
| `provider_refund_ledger` | 환불 키와 원결제 키 | 환불 중복 방지 |
| `outbox` | 거래와 함께 확정한 전달 의도 | 실제 relay를 붙일 때의 출발점 |
| `workflow_state` | 조정 단계와 최종 상태 | 보상 재개·종결 상태 보존 |

`NOT_FOUND` 조회는 현재 원장에 없다는 관찰입니다. 이를 영구적인 명령 결과로 캐시하면 나중에 결제가 확정되어도 계속 없다고 답하므로, 부재 응답은 저장하지 않습니다. `COMPLETED`와 `CANCELLED`인 workflow는 다음 실행에서 외부 단계를 다시 시작하지 않습니다.

## 응답 유실의 단계별 추적

`payment-after-commit`에서는 다음 순서로 진행됩니다.

1. Inventory가 `hold:o-17`을 기록하고 재고를 하나 줄입니다.
2. Payment가 승인 원장·효과·명령 결과·outbox를 한 로컬 거래로 커밋합니다.
3. HTTP 응답 전에 Payment 프로세스가 종료됩니다.
4. Coordinator는 연결 단절을 `PAYMENT_UNKNOWN`으로 해석합니다. 결제 실패나 성공으로 단정하지 않습니다.
5. Payment를 재시작하고 같은 결제 키로 `payment_reconcile`을 호출합니다.
6. 기존 승인 번호를 확인한 뒤 Shipping을 호출하여 `COMPLETED`로 끝냅니다.

관찰 기준은 provider ledger 1건, payment effect 1건, shipping effect 1건입니다. `payment-before-effect`는 승인 삽입 전에 종료하므로, 재시작 조회는 `NOT_FOUND`를 반환합니다. 이때 같은 키로 결제를 다시 요청하여 한 번만 확정합니다.

배송 응답이 유실된 `SHIPPING_UNKNOWN`도 배송 실패가 아닙니다. 코드에서는 이 상태를 별도로 남기고 즉시 환불하지 않습니다. 이미 배송이 생성되었는데 환불까지 실행하는 모순을 피하기 위해서입니다.

## 보상과 재시도

배송 서비스가 영구 거절을 기록하면 workflow는 `COMPENSATING`으로 전환합니다. Coordinator는 먼저 원결제에 대한 환불을 요청하고, `REFUNDED`를 확인한 뒤 재고 예약을 해제합니다. 둘 다 확인되어야 `CANCELLED`입니다.

환불 커밋 전 종료와 커밋 뒤 응답 유실은 각각 `refund-before-effect`, `refund-after-effect`로 재현합니다. 재시작한 Coordinator는 같은 환불·해제 키로 보상을 이어갑니다. 원장을 과거 스냅샷으로 덮어쓰지 않고, 이미 완료된 효과는 재사용합니다. 확인 기준은 환불 1건, 재고 해제 1건, 배송 생성 0건입니다.

## 코드 구성과 실행

[실행 코드](https://github.com/c86j224s/tech-interview/tree/main/examples/knowledge/msa-lab/)는 Python 표준 라이브러리만 사용합니다. `common.py`는 원장과 로컬 거래 도우미, `service.py`는 서비스별 명령, `coordinator.py`는 진행·대사·보상, `run_demo.py`는 프로세스 시작·종료를 담당합니다.

저장소 루트에서 실행합니다.

```sh
cd examples/knowledge/msa-lab
python3 -m unittest discover -s . -p 'test_lab.py' -v
python3 run_demo.py --db-dir .demo-data/after --failpoint payment-after-commit --reconcile-restart
python3 run_demo.py --db-dir .demo-data/before --failpoint payment-before-effect --reconcile-restart
python3 run_demo.py --db-dir .demo-data/refund --failpoint shipping-permanent-failure,refund-after-effect --reconcile-restart
```

데모마다 새 디렉터리를 사용합니다. 기존 디렉터리는 이미 종결된 workflow를 보존하므로 새 장애 시나리오의 초기 상태가 아닙니다. 포트 18081–18084는 loopback에만 열리며 고정 포트이므로 테스트를 병렬로 실행하지 않습니다. 시작 대기는 5초, HTTP 호출은 1.5초이며 종료 시 제한 시간을 넘은 자식 프로세스를 강제 종료합니다.

## 검증 결과와 적용 한계

2026-09-18 macOS 27 arm64, Python 3.9.6에서 7개 테스트를 통과했습니다. 중복 효과·요청 충돌, 결제 커밋 전후 재시작, 환불 커밋 전후 보상 재개, 부재 조회의 갱신, 종결 workflow 재실행 방지, 다중 프로세스 정상 흐름을 검사합니다.

모의 provider 원장은 Payment와 같은 SQLite 거래 안에 있습니다. 실제 외부 결제사는 이 거래에 참여하지 않으므로, 외부 승인과 로컬 기록 사이의 추가 장애 구간을 이 실습이 증명하지 않습니다. SQLite 프로세스 재시작을 시험했지만 전원 손실·파일시스템 내구성 시험은 아닙니다. outbox 행은 기록하지만 broker relay와 consumer inbox 전달은 구현하지 않았습니다. 실제 결제망, TLS·인증, 예약 만료·세대 fencing, 스키마 이전, 운영 부하도 별도 검증이 필요합니다.

## 참고 자료

- [SQLite Atomic Commit](https://www.sqlite.org/atomiccommit.html) — 로컬 거래의 커밋·복구 경계입니다.
- [SQLite WAL](https://www.sqlite.org/wal.html) — WAL 모드의 읽기·쓰기와 체크포인트 제약입니다.
- [Python HTTPServer](https://docs.python.org/3/library/http.server.html) — 교육용 HTTP 서버이며 운영용 서버를 대체하지 않습니다.
- [Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox.html) — 로컬 거래와 메시지 전달을 분리하는 패턴입니다.
