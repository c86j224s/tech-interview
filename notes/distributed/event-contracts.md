---
id: event-contracts
title: 이벤트 적용 순서·Schema 진화·DLQ 복구
topic: 분산 시스템
summary: 전달·완료·효과 순서를 구분하고 키별 직렬화·bounded gap·snapshot/delta·과거 payload 호환·DLQ 보류와 재생 책임을 설명합니다.
questionIds: [message-ordering-scope, out-of-order-buffer-bounds, message-schema-evolution, message-poison-dlq]
---

# 이벤트 적용 순서·Schema 진화·DLQ 복구

## 브로커가 1·2로 줘도 DB에는 2가 먼저 반영될 수 있습니다

이벤트 1을 느린 worker에, 2를 빠른 worker에 넘기면 전달 순서는 맞아도 완료·외부 효과 순서는 뒤집힙니다. offset commit의 연속 완료 watermark는 누락을 막는 장치이지 이미 먼저 실행된 2의 효과를 되돌리는 장치가 아닙니다.

같은 계정의 전이가 순서에 의존하면 key를 같은 전달 흐름으로 보내고 소비에서도 시작부터 효과 확정까지 직렬화하거나 저장소가 expectedSequence를 원자 검사해야 합니다. 콜백 시작만 직렬이고 await 뒤 다음 이벤트를 실행하면 전체 처리 원자성이 아닙니다. 다른 독립 key는 병렬로 진행할 수 있습니다.

## 이벤트 형태에 따라 Gap 처리법이 다릅니다

| 상황 | 적용 규칙 | 위험 |
| --- | --- | --- |
| 현재 6, 완전 snapshot 8 | 이전 상태를 완전히 포함하면 교체 가능 | 중간 외부 효과는 별도 |
| 현재 6, delta 8 | 필요한 7을 기다리거나 재생 | 7을 버리면 누적 누락 |
| 이미 처리한 event ID | fingerprint 확인 후 중복 효과 없음 | 다른 payload를 숨기면 오염 |
| 삭제 뒤 옛 snapshot | 삭제 version·tombstone으로 거절 | 옛 상태 부활 |

키별 다음 sequence·미래 이벤트 map/heap·중복 집합을 관리하고 개수·바이트·최대 번호 거리·대기 시간에 상한을 둡니다. 영원히 오지 않을 7을 기다리며 8 이후를 무한히 메모리에 쌓지 않습니다. 상한에 닿으면 source 재생·검증된 snapshot 재동기화·해당 key 보류를 선택합니다.

```diagram
{"title":"빠진 선행 상태는 제한된 복구 경로로 보냅니다","caption":"화살표는 이벤트 적용 판단입니다. snapshot 재동기화는 해당 상태와 이후 로그의 기준을 연결해야 하며 delta를 무조건 버리는 허가가 아닙니다.","rows":[[{"id":"event","label":"event sequence 8 수신"}],[{"id":"gap","label":"현재 다음 기대 7 · gap"}],[{"id":"buffer","label":"제한된 보류·재생 요청"}],[{"id":"recover","label":"7 도착 또는 snapshot 재동기화"}]],"edges":[{"from":"event","to":"gap","label":"원자 상태 검사"},{"from":"gap","to":"buffer","label":"바이트·시간 상한"},{"from":"buffer","to":"recover","label":"명시 복구"}]}
```

snapshot이 10까지의 상태라면 그 이후 delta만 이어 적용하고 dedup·삭제·계산 version을 유지합니다. source retention을 벗어났다면 단순 재요청으로 복구할 수 없으므로 원본 대사와 repair 상태가 필요합니다.

## Schema는 과거 메시지와 미래 소비자까지 연결합니다

금액 필드를 세전에서 세후로 바꾸어도 타입은 숫자라 parser·schema registry가 통과할 수 있습니다. 구조 호환과 업무 의미 호환은 다릅니다. 단위·default·null·필드 생략·enum 확장·당시 사실/현재 상태의 의미를 version이나 새 event type으로 드러냅니다.

새 producer/옛 consumer, 옛 producer/새 consumer, 오래 보관된 payload/현재 consumer 조합을 시험합니다. registry의 backward·forward·transitive 검사가 어떤 포맷·범위에 적용되는지 확인하고 의미 불변식을 별도 테스트합니다. 모든 소비자가 동시에 배포된다고 가정하지 않습니다.

upcaster·변환 계층을 쓰면 원래 event ID·원본 payload version을 보존하고 변환의 결정성을 유지합니다. 과거 사건에 현재 세율·현재 계정 매핑을 적용해도 되는지 명시합니다. 과거 payload의 개인정보는 schema 변환과 별도로 보관·삭제·접근 통제를 요구합니다.

## DLQ는 정상 경로의 차단을 줄이지만 일을 끝내지 않습니다

영구 schema 오류·참조 부재·일시 하위 장애·코드 결함을 분류하고 시도·시간 상한 뒤 격리할 수 있습니다. DLQ에는 원래 ID·버전·오류·시도·담당·복구 기한을 남깁니다. 자동 retry 한도가 끝난 것이 영구 폐기 승인과 같지는 않습니다.

승인 이벤트가 실패했는데 배송 이벤트를 계속 적용하면 queue는 비워져도 업무가 깨집니다. 해당 key를 보류할지 현재 권위 상태를 조회할지·보상할지 정합니다. 다른 독립 key는 계속 처리할 수 있어야 전체 하나의 partition으로 문제를 숨기지 않습니다.

## 재생은 수정된 원인과 멱등 키를 가지고 작게 시작합니다

원인 수정 없이 DLQ 전체를 redrive하면 같은 실패·중복이 반복됩니다. 작은 batch에서 schema·권한·정상 결과를 확인한 뒤 속도를 늘리고 원래 ID와 효과 기록을 유지합니다. 미해결 나이·사용자 영향·원장 차이를 정상 큐 길이와 따로 봅니다.

느린 첫 이벤트·역순·영구 gap·미래 큰 sequence·재시작·rebalance·옛 payload·부분 효과 후 DLQ를 시험합니다. 최종 합계뿐 아니라 금지된 중간 상태와 각 정상 사건의 보존을 검사합니다. 현재 작업에서는 실제 메시지 시스템의 재생·DLQ를 실행하지 않았습니다. 본문은 적용과 복구 계약의 설명입니다.
