---
id: consumer-inbox
title: 소비자 Inbox의 단일 효과와 사건 정체성
topic: 분산 시스템
summary: DB commit 뒤 ACK 유실을 추적하고 unique inbox·소비 목적·업무 effect key·payload 충돌·기록 보관·다른 정상 이벤트의 동시성을 설명합니다.
questionIds: [message-consumer-idempotency, event-versus-business-dedup-key, duplicate-event-payload-conflict]
---

# 소비자 Inbox의 단일 효과와 사건 정체성

메시지 처리에서 중요한 경계는 “몇 번 전달됐는가”가 아니라 “업무 효과가 몇 번 확정됐는가”입니다. Inbox는 전달 중복을 흡수하는 내구 기록이고, 원장 거래와 ACK의 순서를 분리해 보면 재전달·동시성·정정의 실패를 예측할 수 있습니다.

## 수신 횟수와 포인트 지급 횟수의 구분

소비자가 포인트를 DB에 반영한 뒤 ACK 전에 죽으면 broker는 같은 이벤트를 다시 보낼 수 있습니다.

상태를 순서대로 적으면 E 수신→포인트 +10→프로세스 종료→ACK 없음→E 재전달입니다. `(consumer,E)`가 이미 commit됐고 포인트 변경과 같은 transaction이었다면 두 번째 처리는 기존 결과를 반환합니다. 반대로 inbox만 먼저 commit됐다면 두 번째 전달은 “처리됨”으로 오인해 포인트가 누락될 수 있으므로, marker와 effect의 원자 경계가 설계의 핵심입니다. 전달을 물리적으로 한 번으로 만들려고 ACK를 먼저 보내면 DB 실패 때 이벤트를 잃습니다. 내구 효과를 먼저 확정하고 재전달을 멱등하게 처리하는 경계를 설계합니다.

inbox는 어떤 논리 이벤트를 처리했는지 기록하는 저장소입니다. 메모리 집합만 사용하면 재시작 뒤 사라지므로 원장과 같은 내구성 요구를 확인합니다.

## 처리 마커와 실제 효과의 원자적 결합

```text
begin transaction
  insert inbox(consumer, event_id, fingerprint) with unique constraint
  if duplicate:
      validate same fingerprint and committed prior result
      return existing result without another effect
  validate current account and allowed transition
  update points using atomic domain operation
  record stable processing result
  append outbox if downstream work is needed
commit
send broker ACK
```

특정 DB는 unique 오류 후 거래 전체가 failed 상태가 되므로 rollback 후 확인하거나 지원되는 conflict 처리 구문·savepoint를 사용합니다. 다른 worker의 미커밋 삽입 때문에 timeout한 것을 “이미 성공”으로 취급하면 안 됩니다. 확정 결과를 확인하지 못하면 재시도 가능한 상태로 남깁니다.

| 실패 위치 | 안전한 같은 거래 | 잘못 분리한 경우 |
| --- | --- | --- |
| inbox 후 효과 전 | 둘 다 rollback | 마커만 남아 효과 누락 |
| 효과 후 commit 전 | 둘 다 rollback | 효과만 남아 재지급 |
| commit 후 ACK 전 | 둘 다 남아 재전달 흡수 | 처리 기록 없으면 중복 |

```diagram
{"title":"같은 DB Commit이 마커와 효과를 함께 확정합니다","caption":"화살표는 처리 순서입니다. 외부 결제 API는 이 로컬 DB transaction에 자동 포함되지 않으며 별도 멱등·조회가 필요합니다.","rows":[[{"id":"event","label":"논리 이벤트 E 수신"}],[{"id":"tx","label":"DB transaction","detail":["inbox E + 포인트 변경","결과 + 필요한 outbox"]}],[{"id":"ack","label":"내구 commit 뒤 ACK"}]],"edges":[{"from":"event","to":"tx","label":"unique 경쟁"},{"from":"tx","to":"ack","label":"효과 확정"}]}
```

## Event ID와 업무 키의 중복 단위

분석과 보상 서비스가 같은 이벤트를 각각 처리해야 하면 inbox namespace를 consumer별로 분리합니다. 같은 테이블이면 `(consumer_name,event_id)` 같은 key를 둘 수 있습니다. 반면 producer 버그로 같은 시즌 보상을 서로 다른 event ID로 두 번 만든 경우에는 `(account,season,reward_kind)` 같은 실제 지급 권리 key가 추가로 필요할 수 있습니다.

주문 ID 하나로 승인·부분 환불·배송을 전부 dedup하면 정상 사건을 잃습니다. 무엇이 한 번만 존재해야 하는지 정의하고 event ID·effect key·aggregate ID·물리 시도 ID를 구분합니다. 같은 payload의 두 의도된 구매도 자동으로 하나로 합치면 안 됩니다.

## 동일 ID Payload 충돌과 정정의 구분

기존 이벤트의 fingerprint·schema version·발행자·주체와 대조합니다. canonical 의미의 hash를 쓰면 정규화 규칙도 버전 관리하고 바이트 서명과 의미 동일성 hash를 혼동하지 않습니다. 내용이 다르면 기존 성공을 조용히 반환하거나 새 payload로 다시 효과를 적용하지 말고 격리·원본 발행 원장 대사·경고를 남깁니다.

정상 정정은 별도 event ID와 원래 사건 참조·허용 전이로 표현할 수 있습니다. 경보에 민감 원문 전체를 복사하지 않고 필요한 식별자·차이 분류·제한된 진단 경로를 사용합니다.

## 보관 만료와 서로 다른 정상 이벤트의 동시성

inbox가 만료된 뒤 오래된 메시지를 재생하면 다시 지급할 수 있습니다. 최대 broker retention·수동 replay·복구 창과 처리 기록 수명을 맞추고 더 오래 남는 업무 unique 원장 또는 오래된 자동 처리 거절을 설계합니다. 무한 보관은 비용·개인정보 요구와 조정합니다.

서로 다른 정상 event ID 두 개가 동시에 들어오면 둘 다 inbox를 통과합니다. 두 worker가 points=10을 읽고 각각 5를 더해 15를 SET하면 기대한 20 대신 마지막 쓰기만 남는 lost update가 생기므로, 원자 증가·version 조건·허용 sequence·거래 불변식 중 필요한 장치를 사용합니다. 중복 제거는 같은 사건을 한 번만 처리할 뿐, 서로 다른 사건의 순서나 금지된 중간 상태까지 자동으로 보호하지 않습니다.

외부 API 효과는 로컬 inbox와 원자적이지 않습니다. 안정된 외부 idempotency key·상태 조회·outbox·보상·수동 대사를 사용하고 로컬 마커만으로 결제 성공을 확정하지 않습니다.

## 동시 중복과 정상 이중 사건의 비교

같은 E를 두 worker가 동시에 처리, 다른 E1·E2가 같은 계정을 변경, 같은 E의 payload 충돌, commit 후 ACK 유실, 보관 만료 뒤 replay를 각각 시험합니다. 최종 원장·잔액·outbox·ACK 수를 따로 셉니다. 본문은 처리 설계이며 특정 broker·DB 조합의 실제 동시성 실행 결과는 아닙니다.
