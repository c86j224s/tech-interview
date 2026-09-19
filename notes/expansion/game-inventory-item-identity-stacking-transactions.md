---
id: game-inventory-item-identity-stacking-transactions
title: 게임 Inventory Item Identity·Stacking·Transaction
topic: 게임 서버
summary: >-
  item definition과 개별 instance identity를 분리하고, stack 병합·분할·소비·거래를 원자 전이와 멱등 요청으로
  처리합니다.
questionIds: []
prerequisites:
  - unique-identity
  - state-correction
  - account-rights-merge
related:
  - unique-identity
  - state-correction
  - account-rights-merge
  - distributed-commit
  - transactions
reviewedAt: '2026-09-19'
---
# 게임 Inventory Item Identity·Stacking·Transaction

게임 inventory에서 “철검 2개”라는 표현은 하나의 template을 두 번 보유한다는 뜻일 수도 있고, 강화도·내구도·소유자·거래 이력이 다른 두 개의 실물 item을 뜻할 수도 있습니다. 이 둘을 한 ID로 표현하면 stack 가능한 소비 아이템과 고유 장비의 불변식이 섞이고, 거래 응답 유실 뒤 중복 지급을 막기 어려워집니다. 안정적인 모델은 공통 속성을 정의하는 `item_definition`과 개별 권리를 식별하는 `item_instance` 또는 fungible stack record를 분리합니다.

입력에 기록된 Unity Game Foundation Inventory URL(https://docs.unity.com/ugs/manual/game-foundation/manual/inventory)은 이 검증에서 404로 본문을 읽지 못했습니다. 따라서 Unity API가 definition/instance나 원자 operation을 보장한다고 근거화하지 않습니다. 이 장의 definition·instance·stack 모델과 원자성·멱등성은 게임 서버의 일반 설계 계약으로 제시하며, 선택한 Unity package/service 버전의 문서를 확인한 뒤 별도 adapter 계약으로 확정해야 합니다.

## Definition과 Instance의 수명

`item_definition`에는 `iron_sword`, 표시 이름, 아이콘, 기본 공격력, stack 가능 여부, 최대 stack size 같은 공통 규칙을 둡니다. `item_instance`에는 `instance_id`, `definition_id`, `owner_id`, 위치/컨테이너, 강화 단계, 내구도, 생성 원장 ID, version을 둡니다. definition이 패치되어 기본 설명이나 기본 수치가 바뀌더라도 특정 instance의 강화 이력과 소유권을 새로 만들어서는 안 됩니다.

예를 들어 철검 definition 하나에서 `i-101`은 강화 3, 내구도 70, `i-102`는 강화 7, 내구도 20이라고 하겠습니다. 둘 다 `definition_id=iron_sword`지만 거래에서 선택되는 것은 definition이 아니라 instance입니다. definition ID만 저장하면 “강화 7인 검만 거래”와 “두 검 중 하나만 장착”을 구분할 수 없고, 같은 검을 양쪽 계정이 동시에 보유하는 오류를 찾기 어렵습니다.

반면 포션처럼 개별 metadata가 없는 fungible item은 매번 instance row를 만들기보다 `(owner, container, definition, stack_id, quantity)` record로 저장할 수 있습니다. 그래도 stack record 자체의 ID와 version은 필요합니다. 수량을 단순히 정의 ID에 합쳐 저장하면 두 요청이 각각 읽고 덮어쓰거나, 서로 다른 만료·귀속 정책을 가진 포션이 섞일 수 있습니다.

## Stack 불변식과 전이

stack에는 최소한 다음 불변식이 필요합니다. 수량은 0보다 크고 최대 stack size를 넘지 않아야 하며, 합칠 두 stack은 definition·소유자·귀속·만료·거래 가능 정책이 호환되어야 합니다. split/merge 전후 총수량은 같고, consume은 양수 수량만큼 정확히 감소해야 합니다. source와 destination이 같은 stack인지, 삭제 후 ID가 재사용되는지도 확인합니다.

설명용으로 포션 stack A가 99개이고 최대가 100이라고 하겠습니다. 50개를 split하면 A=49, 새 B=50이며 합은 99입니다. B=50을 다른 C=60에 합치면 C=110이 되어 최대치 100을 위반하므로 전부 성공시키면 안 됩니다. C=50에 합치면 C=100, B는 삭제 또는 0 상태로 정리할 수 있지만, “삭제”의 원장 기록과 재시도 결과도 남겨야 합니다. 이 숫자는 실행한 DB 결과가 아니라 중간 상태를 검산하는 예입니다.

클라이언트가 “최종 quantity=50”을 보내는 API보다 `split(source_id, quantity=50, expected_version=7)`처럼 명령을 받는 편이 안전합니다. 서버가 현재 source quantity, policy, owner를 다시 읽고 조건부로 변경해야 합니다. source version이 8이면 앞선 요청이 이미 바꾼 것이므로 50을 그대로 저장하지 않고 충돌·재계산·재시도 중 하나를 반환합니다.

## 원자적 Split·Merge·Consume

한 stack의 수량 감소와 새 stack 생성은 하나의 transaction 또는 같은 권위 actor의 원자 전이로 묶습니다. 감소만 커밋되고 새 stack 생성이 실패하면 수량이 사라지고, 생성만 남으면 duplication이 되기 때문입니다. 여러 container를 오가는 merge는 source와 destination의 전체 조건을 확인한 뒤 한 경계에서 반영합니다. DB라면 `(stack_id, version)` 조건부 update와 unique instance ID를 함께 사용하고, 영향을 받은 row 수를 검사합니다.

서로 다른 DB/서비스에 걸친 거래는 하나의 로컬 transaction으로 해결되지 않을 수 있습니다. 이 경우 `prepared`, `committing`, `committed`, `reconciling` 같은 상태와 거래 ID를 내구 저장하고, 양쪽 ledger entry를 같은 command ID와 연결합니다. 2PC를 선택한다면 prepare 이후 조정자 장애의 in-doubt를 운영해야 하고, saga를 선택한다면 이미 이전된 item을 새 조정 전이로 되돌리는 정책이 필요합니다. “두 저장소에 모두 쓰면 원자적”이라는 단정은 금물입니다.

```diagram
{"title":"아이템 공통 정의와 개별 권리를 원자 전이로 연결합니다","caption":"definition은 공통 규칙이고 instance/stack은 소유 가능한 상태입니다. 명령은 version·멱등 key를 검사한 뒤 원장과 inventory를 함께 바꿉니다.","rows":[[{"id":"definition","label":"item definition","detail":["공통 규칙·max stack"]}],[{"id":"state","label":"instance 또는 stack","detail":["owner·quantity·version"]}],[{"id":"command","label":"split·merge·trade command","detail":["request/effect ID"]}],[{"id":"atomic","label":"원자 상태 전이","detail":["inventory·ledger"]}],[{"id":"reconcile","label":"결과 조회·대사","detail":["중복·부분 완료"]}]],"edges":[{"from":"definition","to":"state","label":"규칙 참조"},{"from":"state","to":"command","label":"현재 version"},{"from":"command","to":"atomic","label":"조건부 적용"},{"from":"atomic","to":"reconcile","label":"내구 결과"}]}
```

## 거래의 Identity와 멱등성

A의 검 `i-101`을 B에게 옮기는 trade `t-77`을 생각해 보겠습니다. 서버가 소유권 변경을 커밋한 뒤 응답을 보내기 전에 끊기면 클라이언트는 실패로 오해할 수 있습니다. 같은 request를 새 trade로 만들어 재시도하면 A에서 다시 검을 만들거나 B에 두 번 지급하는 문제가 생깁니다. 따라서 `trade_id` 또는 명령의 `idempotency_key`를 거래 원장과 양쪽 inventory transition에 연결하고, 동일 key가 다시 오면 새 전이를 만들지 않고 저장된 상태와 결과를 반환합니다.

멱등 record에는 key, 요청 fingerprint, actor/권한, 현재 상태, 결과 참조, 생성·만료 시각을 둡니다. 동일 key인데 payload가 다르면 성공을 재사용하지 않고 충돌으로 거절·경보를 냅니다. key 만료 뒤 오래된 재시도가 새 거래로 실행될 수 있으므로 key 보존 기간은 클라이언트 retry, queue redelivery, 복구 지연을 포함해야 합니다. 키만 저장하고 실제 inventory 전이와 다른 transaction에 두면 record는 성공인데 아이템은 없는 불일치가 생깁니다.

거래가 여러 단계라면 요청 접수와 실제 효과를 구분합니다. `accepted`는 아직 ownership이 바뀌지 않았고 `committed`만 소유권 전이가 내구화됐다는 식으로 상태를 정의합니다. 응답 유실 때는 `GET /trades/t-77`로 현재 결과를 조회할 수 있어야 하며, “응답을 못 받았으니 실패”를 외부에 전달하지 않습니다.

## Owner·권한·동시성

inventory 명령은 클라이언트가 보낸 owner·instance 상태를 그대로 믿지 않고, 인증 주체가 해당 container와 item을 조작할 권한이 있는지 확인합니다. 두 요청이 같은 instance를 동시에 거래하려 하면 owner/version 조건 하나만 성공해야 합니다. 성공 후 소유자 변경은 이전 owner의 조회 결과가 늦게 도착해도 다시 적용되지 않도록 generation 또는 version을 반환합니다.

여러 stack merge의 lock 순서를 안정화하지 않으면 A→B와 B→A가 교착할 수 있습니다. instance ID 정렬로 lock 순서를 고정하거나, optimistic version으로 충돌을 실패시킨 뒤 전체 명령을 다시 계산합니다. 인기 계정의 inventory에 충돌이 많으면 account별 actor/serial executor로 직렬화할 수 있지만, 두 계정 거래는 교차 계정의 lock 순서와 timeout을 별도로 정해야 합니다.

아이템이 삭제·복구되거나 ID가 재사용되는 시스템에서는 generation을 함께 저장합니다. 단 generation은 해제된 객체 메모리를 안전하게 읽게 하는 장치가 아니며, DB row·immutable snapshot·참조 수명 같은 memory/storage lifetime과 분리해야 합니다. 거래 효과가 외부 메일·보상 서비스까지 전달되면 transactional outbox나 inbox를 두고, 게임 inventory가 성공했다고 외부 전송이 이미 완료됐다고 오인하지 않습니다.

## 실패·정정·대사

부분 완료를 숨기지 말고 어떤 효과가 남았는지 기록합니다. A에서 item을 제거했지만 B에 넣지 못했다면 `in_transit` 또는 `reconciling` 상태로 두고, background repair가 원장과 실제 inventory를 대조합니다. 이미 B가 item을 사용한 뒤 거래를 취소하면 단순히 A에 원본을 되돌리는 대신 사용 효과·보상·경제 원장을 조사하고 별도 correction event를 만듭니다.

stack 수량의 대사는 source와 destination의 모든 원장 entry 합, 현재 quantity, 삭제된 stack의 terminal record를 비교하는 방식으로 합니다. 동일 effect ID가 두 번 보이면 한 번만 반영된 것인지, 외부 결과가 유실됐는지 확인합니다. 대사 job이 정상 명령을 다시 실행하는 위험이 있으므로 repair command도 멱등 key와 승인 단계를 가져야 합니다.

실패 테스트는 split 직후 crash, merge 조건 불일치, trade 응답 유실, 같은 request 재전송, 두 거래의 동일 instance 경쟁, 만료된 멱등 record 재시도, definition 변경 중 거래, 계정 병합 중 ownership 이전을 포함합니다. 정상 경로에서 inventory가 보인다는 것만으로 duplication이 없다고 결론내리지 않습니다.

## 비용·선택 기준

개별 instance row는 내구도·강화·거래 이력을 정확히 표현하지만 row 수와 index 비용이 큽니다. fungible stack은 저장량과 조회가 줄지만 stack 호환 규칙, 만료·귀속 분할, 동시 merge가 복잡해집니다. 작은 stack limit을 두면 같은 포션이 여러 row로 쪼개져 update가 늘고, 지나치게 큰 limit은 한 row의 lock contention과 partial update 충돌을 키울 수 있습니다.

원자 transaction 범위를 넓히면 정확성은 쉬워질 수 있지만 lock hold와 cross-service latency가 커집니다. outbox/inbox로 외부 효과를 분리하면 로컬 inventory 응답은 빨라질 수 있으나 eventual delivery와 retry 대사를 운영해야 합니다. 설계 선택은 item 수, 거래 빈도, 경제 손실 비용, 허용 지연, 보관해야 할 ledger 기간을 기준으로 합니다.

## 참고자료와 확인 범위

- Unity Game Foundation Inventory, https://docs.unity.com/ugs/manual/game-foundation/manual/inventory — 입력에 있던 URL이나 이 배치 검증에서 404로 본문을 확인하지 못했습니다. 따라서 Unity의 definition/instance·transaction 보장 근거로 사용하지 않고, 버전 고정 후 재검증할 출처로만 기록합니다.
- `notes/databases/unique-identity.md` — unique ID, 충돌 경쟁, 요청 소유권을 대조했습니다.
- `notes/databases/transactions.md` 및 `questions/transaction-and-lost-update.md` — 조건부 갱신·version·lost update를 inventory 전이에 적용했습니다.
- `notes/design/state-correction.md` — terminal state를 덮지 않고 correction 전이를 만드는 원칙을 대조했습니다.
- `notes/design/account-rights-merge.md` — 계정 병합과 늦은 권리 반영을 일반 item 거래와 구분했습니다.

이 문서는 Unity 서비스가 제공하는 특정 API의 보증을 확대 해석하지 않습니다. 실제 저장소의 transaction 격리, unique constraint, 멱등 record 보존 기간, 외부 결제·메일 계약은 선택한 버전의 공식 문서와 장애 시험으로 확정해야 합니다.
