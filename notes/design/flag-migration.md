---
id: flag-migration
title: Feature Flag·Strangler의 쓰기 권위와 Rollback
topic: 설계
summary: 안정 cohort·실제 노출·조직 공유 데이터를 고려하고 shadow 효과 격리·단일 쓰기 owner·증분 cutover·늦은 event·호환 복구·레거시 제거를 설명합니다.
questionIds: [feature-flag-rollout, feature-flag-assignment-unit, feature-rollback-late-event, strangler-migration, shadow-write-side-effect-isolation, service-data-owner-migration]
---

# Feature Flag·Strangler의 쓰기 권위와 Rollback

## 스위치를 꺼도 이미 저장한 Paused는 남습니다

새 코드가 status=paused를 저장했고 옛 코드가 active/closed만 알면 flag off 뒤에도 오류가 남습니다. flag는 이후 경로를 선택할 뿐 데이터·event·메일·결제를 되돌리지 않습니다. 새 값을 읽을 호환 코드→확장 schema→전환/백필→옛 경로 제거처럼 순서를 준비하고 rollback 가능한 데이터 표현을 먼저 확인합니다.

## 배정 단위는 공유 데이터와 맞춥니다

개인 데이터면 사용자 단위가 단순하지만 조직 구성원이 같은 문서를 바꾸면 혼합 규칙이 충돌할 수 있어 조직 단위가 더 적합할 수 있습니다. hash(실험 ID, 배정 ID)를 고정 구간에 배치해 비율 확대 때 기존 대상이 불필요하게 오가지 않게 합니다. 배정 version과 실제 노출을 기록합니다.

조직 단위 실험에 사용자 10000명이 있어도 독립 표본 10000개인 것은 아닙니다. 조직 크기·네트워크 효과·동일 공유 자원·cohort별 오류를 고려합니다. 작은 cohort 장애는 전체 평균에서 숨을 수 있습니다.

## Shadow는 두 번째 실제 실행이 아닙니다

레거시가 권위 응답을 만들고 새 경로는 read-only·가상 sink·독립 데이터로 비교합니다. shadow 결제·메일·webhook·쓰기·log egress를 차단해야 합니다. 같은 요청을 관리자 자격으로 새 경로에 복제하는 것은 안전한 비교가 아닙니다.

비결정적 timestamp·순서 차이는 계약상 허용된 범위에서 정규화하고 금액·권한·누락 같은 의미 차이는 유지합니다. 새 결과가 더 좋아 보인다고 자동 채택하지 않고 정한 authority와 승인 절차로 전환합니다.

```diagram
{"title":"비교 경로와 권위 있는 실행을 분리합니다","caption":"화살표는 트래픽 전달입니다. shadow는 격리된 효과로 비교하며 두 시스템이 동시에 같은 데이터를 권위 있게 수정하지 않습니다.","rows":[[{"id":"router","label":"안정 cohort·전환 generation"}],[{"id":"old","label":"현재 권위 경로"},{"id":"shadow","label":"새 경로 · 격리 shadow"}],[{"id":"ledger","label":"단일 권위 저장·event 원장"},{"id":"compare","label":"의미·오류·지연 비교"}]],"edges":[{"from":"router","to":"old","label":"실제 실행"},{"from":"router","to":"shadow","label":"허용된 비교"},{"from":"old","to":"ledger","label":"현재 owner"},{"from":"shadow","to":"compare","label":"중복 외부 효과 없음"}]}
```

## Strangler 전환은 라우팅과 Data Owner를 함께 옮깁니다

진입 router에서 일부 기능·계정부터 새 시스템으로 옮기고 현재 외부 계약을 유지합니다. 상대 DB 직접 조회를 API·event·read model로 바꾸고 batch·관리 도구·복구 procedure의 숨은 접근도 조사합니다. 두 곳 직접 write는 한쪽 성공/실패·역순·중복을 만들므로 한쪽을 source of truth로 하고 다른 쪽은 outbox/CDC 등 재처리 가능한 파생 경로로 둡니다.

새 read model의 초기 적재·동시 증분·삭제·순서·대사를 준비한 뒤 마지막 반영 위치를 확인하고 write authority generation을 전환합니다. 같은 계정이 매 요청 무작위로 옛/새 저장소를 권위로 읽지 않게 합니다. 옛 generation writer는 실제 저장 경계에서 거절합니다.

## Flag Off 뒤의 Event도 해석해야 합니다

이미 발행된 신version event는 계속 도착할 수 있습니다. consumer는 필요한 구/신 schema를 지원하거나 명시적 격리·보정 경로로 처리합니다. event ID dedup과 현재 상태의 허용 전이를 검사하고 노출 version·주문 원장·사용자 결과를 연결합니다. off라는 이유로 event를 무조건 버리면 완료한 권리를 잃을 수 있습니다.

rollback은 새 데이터의 역표현·옛 read 경로·필요한 증분 반영·신규 write 제한을 확인해야 합니다. 불가능하면 호환 patch·전진 복구·대사로 피해를 줄입니다. 코드 경로 복귀·사용자 서비스 회복·손상 데이터 대사 완료를 별도 상태로 둡니다.

## 전파 장애와 최종 제거도 완료 조건에 넣습니다

설정 store 장애의 마지막 정상값·local cache·강제 안전값 우선순위를 정하고 여러 service가 한 거래에서 서로 다른 flag를 쓰지 않도록 결정 전달/호환을 관리합니다. 지원 조합을 제한하고 owner·제거 기한을 둡니다. 완전 전환 뒤 옛 endpoint·자격·batch·복구 의존이 사라진 증거를 확인해야 완료입니다.

혼합 cohort·shadow 차이·전환 중 실패·옛 writer·늦은 event·rollback·설정 유실을 시험합니다. 이 노트는 전환 설계이며 실제 서비스 migration을 수행한 결과는 아닙니다.
