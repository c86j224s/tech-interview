---
id: model-ownership
title: 서비스 불변식·CQRS·Event Sourcing의 원본
topic: 설계
summary: 모듈과 process 경계를 구분하고 데이터 write owner·중간 상태·command/query 모델·projection 지연·역사 사실·snapshot replay·외부 효과 격리를 설명합니다.
questionIds: [service-boundary-design, cqrs-read-write-models, event-sourcing-replay]
---

# 서비스 불변식·CQRS·Event Sourcing의 원본

## 테이블 셋이 Service 셋을 뜻하지는 않습니다

주문·결제·재고가 즉시 함께 확정돼야 하는지, 재고 예약→결제 승인→확정과 만료/보상을 허용할지 먼저 정합니다. 후자는 process 분리를 가능하게 할 수 있지만 중간 사용자 상태·늦은 승인·응답 유실·보상 실패를 새로 관리해야 합니다.

앞서 정한 즉시 확정 또는 중간 상태 허용 여부를 바탕으로, 공동 변경·transaction·데이터 owner·보안/규제·확장 패턴을 기준으로 경계를 정합니다. 초기에는 같은 process의 강한 module/port 경계로 결합을 드러낼 수 있습니다. 로그인 한 번에 연쇄 RPC 열 번이나 매번 공동 배포가 필요하면 별도 DB를 가졌어도 독립성이 낮습니다. 필요하면 다시 합치는 것도 합리적입니다.

## 쓰기 원본과 읽기 표현은 다릅니다

각 owner가 자기 데이터의 권위 쓰기를 맡고 다른 service는 API/event를 사용합니다. 직접 상대 DB schema를 읽으면 그 내부 변경에 결합됩니다. **CQRS**는 command와 query의 책임·model 분리이며 별도 DB·process·event sourcing을 강제하지 않습니다. 같은 DB에서 command invariant와 조회 DTO를 나누는 작은 형태도 가능합니다.

| 경계 | 책임 |
| --- | --- |
| command model | 인가·불변식·transaction·멱등 |
| query model | 화면 filter·집계·정렬·공개 필드 |
| 별도 projection | 중복·순서·삭제·재구축·lag |
| source owner | 원본 사실·write 권위·복구 |

재고 확정 command가 성공했는데 조회 projection이 아직 이전 값이면, 빠르게 읽힌 화면을 확정 상태의 근거로 쓰지 않습니다. 응답에 command가 확정한 값과 version을 함께 주거나, 조회가 그 최소 version을 적용할 때까지 기다린 뒤 결과를 반환하는 read-your-writes 계약을 선택합니다. 사용자가 화면을 저장 실패로 오해해 같은 요청을 다시 보내도 command의 안정 key를 다시 사용해 중복을 막습니다.

```diagram
{"title":"원본 변경과 파생 조회 모델을 구분합니다","caption":"화살표는 상태 반영입니다. 같은 DB에서도 역할을 나눌 수 있고 별도 projection이면 반영 지연·중복·복구 책임이 추가됩니다.","rows":[[{"id":"command","label":"Command · 업무 조건·인가"}],[{"id":"source","label":"권위 상태 또는 원본 이벤트"}],[{"id":"projection","label":"조회 projection·적용 위치"}],[{"id":"query","label":"Query · 화면 결과·version"}]],"edges":[{"from":"command","to":"source","label":"원자적 기록"},{"from":"source","to":"projection","label":"명시적 반영 계약"},{"from":"projection","to":"query","label":"지연을 가진 조회"}]}
```

## Event Sourcing은 당시 사실을 충분히 저장해야 합니다

Event Sourcing에서는 상태를 덮어쓴 결과 대신 상태 변화 event를 원본으로 저장하고, event를 순서대로 적용해 현재 상태를 다시 만듭니다. 예를 들어 ‘10 입금’은 중복 적용하면 10이 두 번 더해질 수 있지만 ‘잔액을 100으로 설정’은 중복 적용해도 같은 값입니다.

두 event의 적용 순서도 결과를 바꿀 수 있으므로, 각 event의 순서·중복 처리 의미를 따로 정해야 합니다. 당시 가격을 event에 남기지 않은 채 replay에서 현재 가격 API를 호출하면 같은 주문의 과거 상태가 달라집니다.

따라서 당시 결정을 재현하는 데 필요한 사실과 policy/code version, 오래된 schema를 현재 형태로 읽는 schema upcaster를 함께 정합니다.

snapshot은 특정 event 위치까지 반영한 파생 상태입니다. snapshot version·포함한 마지막 event와 그 이후 replay를 연결하고 중복·누락·순서 오류를 검사합니다. 원본 event가 틀렸다고 자동 정답으로 복구되지는 않습니다. 정정 event를 추가할 수 있으나 그 의미와 이후 상태 영향도 검토합니다.

## Replay는 외부 결제·메일을 다시 실행하는 과정이 아닙니다

projection 계산과 외부 effect handler를 분리하고 replay 환경에서 실제 egress·자격을 차단합니다. 단순 replay flag만 믿지 않고 실행 경계를 보호합니다. 민감정보 삭제와 불변 로그 보관은 충돌할 수 있어 민감 필드 분리·암호화·보존·삭제 정책을 처음부터 정해야 합니다. 로그에 저장됐다고 법적·업무 삭제 요구가 사라지지 않습니다.

## 분리의 가치는 실제 운영 비용으로 판정합니다

단일 model 기준선과 조회 지연·command 복잡성·projection lag·재구축 시간·공동 변경·RPC 왕복·보상·장애 전파·팀 owner를 비교합니다. 오래된 event·snapshot 연결·삭제·중복·외부 자료 변경·부분 실패를 시험합니다. 이 노트는 구조 설계이며 실제 event store migration이나 replay를 실행한 결과는 아닙니다.
