---
id: invariant-boundaries
title: 객체 불변식·Aggregate·MVC의 책임 경계
topic: 설계
summary: setter 대신 의미 있는 명령으로 상태를 보호하고 복원·동시 저장·여러 객체의 원자 범위·HTTP/consumer adapter·오류와 뷰 모델을 분리합니다.
questionIds: [oop-encapsulation, aggregate-cross-object-invariant, mvc-responsibilities, domain-error-http-mapping]
---

# 객체 불변식·Aggregate·MVC의 책임 경계

## 필드를 숨겨도 아무 값이나 넣을 수 있으면 규칙은 열려 있습니다

주문의 금액은 양수이고 결제 뒤 금액을 바꿀 수 없다는 계약을 생각합니다. private 필드에 `setAmount(-1)`·`setStatus(PAID)`를 제공하면 외부 호출 순서가 규칙을 결정합니다. 생성 경계에서 금액·통화를 검사하고 `approve`, `cancel`, `changeAmount`가 현재 상태와 입력을 함께 검증하게 합니다.

실패 명령은 일부 필드만 바꾸지 않도록 새 상태를 계산·검증한 뒤 적용합니다. 내부 목록은 방어적 복사나 불변 값을 반환하고 가변 원소가 노출되는지도 봅니다. 규칙이 없는 DTO까지 무조건 무거운 객체로 만들 필요는 없습니다. **캡슐화**의 목표는 접근자 수가 아니라 변경 권한과 불변식의 소유입니다.

## 안내 조회는 실제 변경 조건을 대신하지 않습니다

`canCancel()`이 true를 반환한 직후 다른 요청이 결제를 완료하면, 실제 `cancel()` 시점의 조건은 이미 달라져 있습니다. 따라서 안내 조회 결과를 믿고 저장하지 말고 `cancel()` 내부에서 현재 상태를 다시 검사한 뒤, DB 저장에도 `expected version`과 제약을 함께 적용합니다.

객체 하나가 현재 상태를 올바르게 지켜도 두 요청의 `lost update`는 자동으로 막히지 않습니다. 역직렬화와 ORM 복원이 생성자 검증을 우회할 수 있으므로, 그 경계에서도 같은 검증을 적용할 위치를 정합니다.

## 여러 객체의 규칙은 더 큰 원자 범위가 필요합니다

A=100, B=50에서 30을 이체할 때 A=70 저장 후 B 증가가 실패하면 합계가 120으로 줄어듭니다. 각각 비음수라는 규칙은 지켜도 합계 150은 깨집니다. 즉시 함께 확정해야 하는 범위를 aggregate 또는 서비스 transaction으로 정하고 저장소의 원자성을 사용합니다.

이체 대상 A와 B가 서로 다른 시스템에 있으면 로컬 transaction 하나로 두 저장을 묶을 수 없습니다. 이 경우 예약이나 중간 상태를 둘지 정하고, 재시도로 같은 작업이 두 번 적용되지 않게 중복을 억제하며, 한쪽만 반영됐을 때 보상과 대사를 어떻게 할지 계약으로 정합니다. 반대로 모든 관련 객체를 하나의 거대한 aggregate에 넣으면 lock 경합과 변경 결합이 커질 수 있습니다. 그래서 즉시 함께 지켜야 하는 불변식과 나중에 맞춰도 되는 파생 상태를 분리합니다.

```diagram
{"title":"요청 형식과 업무 규칙과 저장을 분리합니다","caption":"화살표는 호출 흐름입니다. HTTP와 메시지 입력은 같은 업무 명령으로 모이고 transaction·인가 규칙을 어댑터마다 복제하지 않습니다.","rows":[[{"id":"http","label":"HTTP controller"},{"id":"consumer","label":"메시지 consumer"}],[{"id":"service","label":"명령·주체·요청 ID · 서비스"}],[{"id":"domain","label":"도메인 불변식·상태 전이"}],[{"id":"store","label":"원자 저장·version·제약"}]],"edges":[{"from":"http","to":"service","label":"입력 변환"},{"from":"consumer","to":"service","label":"입력 변환"},{"from":"service","to":"domain","label":"인가·업무 처리"},{"from":"domain","to":"store","label":"검증된 변경"}]}
```

## MVC는 프로세스 분할보다 UI 책임 분리입니다

controller는 요청 형식·인증된 주체를 해석하고 service를 호출한 뒤 응답을 선택합니다. service/domain은 가격·대상 인가·상태 전이·transaction을 소유하고 repository는 영속화 세부를 맡습니다. view는 결정된 결과를 표현합니다. 얇은 controller의 목적은 줄 수가 아니라 입력·정책·표현의 변경 이유 분리입니다.

HTTP 객체를 domain에 넘기면 메시지 consumer도 가짜 HTTP 요청을 만들어야 합니다. 반대로 view에서 DB를 읽어 재고를 판단하면 같은 규칙이 템플릿으로 샙니다. 공개 필드만 담는 view model을 만들고 HTML escape·접근성은 표현 계층에서 처리합니다. 내부 entity 전체 직렬화는 비밀 필드·lazy loading을 노출할 수 있습니다.

## 오류의 의미는 Domain, 전송 표현은 Adapter가 맡습니다

| 의미 | 처리 방향 |
| --- | --- |
| 입력 형식 오류 | 경계 검증·필드별 수정 정보 |
| 인증·대상 인가 실패 | 해당 전송의 인증/인가 응답 |
| 재고 부족·허용되지 않은 전이 | 명시적인 업무 거절 |
| DB timeout·외부 결과 불확정 | retry/조회 가능성을 보존한 장애 결과 |

HTTP status와 본문은 adapter가 정책에 맞춰 매핑합니다. 모든 domain 객체가 HTTP 응답 타입을 반환할 필요는 없습니다. 내부 SQL·자격을 오류에 노출하지 않고 추적 ID를 제공합니다. 업무 거절을 일시 장애로 바꾸면 client가 불필요하게 재시도할 수 있습니다.

생성·복원·금지 전이·예외 뒤 상태·동시 저장·이체 중간 실패·HTTP/consumer 동일 계약을 시험합니다. 이 노트는 책임 설계이며 실제 주문 서비스를 구현해 검증한 결과는 아닙니다.
