---
id: policy-ports
title: 정책 소유 포트·의존성 주입·Composition Root
topic: 설계
summary: DI와 DIP·소스 의존과 런타임 호출을 구분하고 정책 중심 원자 계약·fake/stub/mock·공유/요청 자원·부분 생성 실패·종료 순서를 설명합니다.
questionIds: [dependency-injection-boundaries, solid-dependency-inversion, policy-owned-interface-boundary, composition-root-resource-lifetime]
---

# 정책 소유 포트·의존성 주입·Composition Root

## 생성자 주입만으로 정책의 의존 방향이 바뀌지는 않습니다

CheckoutService의 생성자에 PostgresClient를 넣는 것만으로는 결합이 사라지지 않습니다. 정책 코드가 여전히 SQL 문법·driver 예외·transaction 타입을 처리하면, 호출 대상만 밖에서 바꿔 끼웠을 뿐 기술 세부사항을 알고 있기 때문입니다. **DI**는 필요한 상대를 밖에서 전달하는 조립 방식이고, **DIP**는 고수준 정책이 요구하는 추상 계약을 중심으로 소스 의존을 바꾸는 설계입니다.

정책이 `PaymentRecordStore`라는 port를 사용하고 PostgreSQL adapter가 그 port를 구현하게 할 수 있습니다. 런타임에는 정책이 adapter를 호출해도 소스 import 방향은 adapter→정책 port가 됩니다. 시작점이 양쪽을 알아 연결하는 것은 정상입니다.

## Port는 업무에 필요한 보장을 표현합니다

`exists(key)` 후 `insert(record)` 두 메서드는 중복 검사와 저장 사이 경쟁을 호출자에게 남깁니다. `recordOnce(key, expectedVersion, result)`가 생성·이미 처리됨·충돌·실행 불확정을 반환하는 식으로 필요한 원자 의미를 표현합니다. 단순 CRUD를 interface에 복사했다고 정책 소유 추상화가 되지는 않습니다.

외부 결제 승인과 DB 기록을 한 adapter 호출로 묶더라도 두 시스템의 성공을 하나의 원자 작업으로 확정할 수 없으면, port는 “항상 정확히 한 번 동시에 성공”이라고 말할 수 없습니다. 결제 결과를 아직 조회하지 못한 불확정 상태, 한쪽만 반영된 부분 효과, dedup 기간과 결과 조회 방법을 계약에 포함합니다. SDK 예외를 그대로 밖으로 내보내지 않고 정책이 이해할 수 있는 실패·불확정 결과로 바꿔야 정책이 특정 구현을 다시 알지 않습니다.

```diagram
{"title":"소스 의존은 정책 포트를 향하고 조립은 밖에서 합니다","caption":"화살표는 소스 의존 또는 조립 관계로 라벨에 표시했습니다. 실제 실행 호출은 정책에서 주입된 adapter로 갈 수 있습니다.","rows":[[{"id":"root","label":"Composition Root"}],[{"id":"policy","label":"Checkout 정책"},{"id":"adapter","label":"Postgres adapter"}],[{"id":"port","label":"정책 소유 PaymentRecordStore"}]],"edges":[{"from":"root","to":"policy","label":"객체 조립"},{"from":"root","to":"adapter","label":"구현·수명 소유"},{"from":"policy","to":"port","label":"계약 의존"},{"from":"adapter","to":"port","label":"구현·import"}]}
```

## 변동·실패 경계부터 주입합니다

시계·scheduler·network·file·DB는 테스트에서 통제할 가치가 큽니다. retry에 호출 대상과 대기를 주면 첫 호출 실패→다음 성공을 실제 sleep 없이 재현할 수 있습니다. 순수 금액 계산은 직접 시험하고 모든 작은 내부 타입을 interface로 감싸지 않습니다.

| 대역 | 역할 | 주의점 |
| --- | --- | --- |
| stub | 준비된 응답 제공 | 실제 state·경쟁 없음 |
| fake | 단순 상태 구현 | 실제보다 강한 원자성일 수 있음 |
| mock | 호출 상호작용 확인 | 결과와 무관한 순서까지 고정 가능 |
| 실제 adapter 계약 시험 | DB·API 보장 확인 | 환경·실패 주입 비용 |

결과로 검사할 수 있으면 내부 호출 순서에 과결합하지 않습니다. 다만 중복 전송 금지처럼 횟수가 외부 계약이면 직접 검사합니다. fake가 통과해도 real adapter의 unique constraint·transaction·timeout·부분 성공을 별도로 확인해야 합니다.

## Composition Root는 생성뿐 아니라 종료 책임도 정합니다

Composition Root에서 만든 공유 DB/HTTP pool·logger와 각 요청의 인증 문맥을 별도로 보관합니다. 요청 주체를 process singleton 한 곳에 저장한 상태에서 두 요청이 동시에 처리되면, 한 요청의 문맥이 다른 요청과 섞일 수 있습니다. 정책이 service locator에서 전역 구현을 다시 찾으면 생성자에 드러난 의존성이 사라지므로, 필요한 port와 자원을 명시적으로 주입합니다.

pool 생성 후 worker 생성에 실패했다면 이미 만든 pool만 회수합니다. 종료 때는 새 유입 차단→진행 작업 종료→pool close→남은 진단 flush처럼 의존자가 자원보다 먼저 정리되게 합니다. logger도 이미 닫힌 뒤 destructor가 호출하지 않도록 소유 순서를 정합니다. 테스트마다 새 객체 그래프를 만들면 전역 reset의 병렬 경쟁을 줄일 수 있습니다.

## 구현 교체 뒤 동일한 계약이 유지되어야 합니다

중복 key·다른 인자 충돌·저장 실패·결과 유실·취소·자원 생성 중 예외·종료 중 callback을 시험합니다. interface 위치뿐 아니라 메서드 의미·정책의 SDK import·실제 보장으로 경계를 판정합니다. 이 노트는 구조 설계이며 실제 결제/DB adapter를 교체해 실행한 실험 결과는 아닙니다.
